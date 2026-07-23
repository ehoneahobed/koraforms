import {
	buildPublicFormVersionRecord,
	buildPublicFormProgressRecord,
	buildPublicOfflineReadiness,
	buildResponseSubmissionRecord,
	assertPendingSubmissionLimit,
	isCacheablePublicForm,
	isPermanentSubmissionError,
	publicFormRecordToForm,
	shouldQueueSubmission,
	stableHash,
	type FlushResult,
	type PublicOfflineDiagnostics,
	type PublicOfflineReadiness,
	type PublicOfflineSubmissionIssue,
	type PublicFormSource,
	type PublicFormProgressRecord,
	type PublicFormVersionRecord,
	type PublicSubmissionStatus,
	type ResponseSubmissionLocalStatus,
	type ResponseSubmissionRecord,
} from './offlineModel'
import { publicApp } from '../../publicKora'
import { deleteLocalBlobsFromResponseJson, getLocalBlobStorageUsage } from './blobStorage'
import { serializeJsonForTransport } from '../../domain/forms'

export {
	buildPublicFormVersionRecord,
	buildPublicFormProgressRecord,
	buildPublicOfflineReadiness,
	buildResponseSubmissionRecord,
	assertPendingSubmissionLimit,
	isCacheablePublicForm,
	isPermanentSubmissionError,
	publicFormRecordToForm,
	shouldQueueSubmission,
	stableHash,
	type FlushResult,
	type PublicOfflineDiagnostics,
	type PublicOfflineReadiness,
	type PublicOfflineSubmissionIssue,
	type PublicFormSource,
	type PublicFormProgressRecord,
	type PublicFormVersionRecord,
	type PublicSubmissionStatus,
	type ResponseSubmissionLocalStatus,
	type ResponseSubmissionRecord,
}

export async function savePublicFormVersion(
	slug: string,
	form: Record<string, unknown>,
	now = Date.now(),
): Promise<PublicFormVersionRecord | null> {
	if (!isCacheablePublicForm(form)) return null
	await publicApp.ready
	const record = buildPublicFormVersionRecord(slug, form, now)
	const existing = await publicApp.public_form_versions
		.where({ slug: record.slug, versionHash: record.versionHash })
		.limit(1)
		.exec()
	if (existing[0]?.id) {
		return await publicApp.public_form_versions.update(existing[0].id, { cachedAt: now })
	}
	return await publicApp.public_form_versions.insert(record)
}

export async function readLatestPublicFormVersion(slug: string): Promise<PublicFormVersionRecord | null> {
	await publicApp.ready
	const records = await publicApp.public_form_versions
		.where({ slug, status: 'published' })
		.orderBy('cachedAt', 'desc')
		.limit(1)
		.exec()
	return records[0] ?? null
}

export async function enqueueResponseSubmission(
	params: {
		formId: string
		slug?: string
		formVersionHash?: string
		data: string
		clientSubmissionId?: string
		now?: number
	},
): Promise<ResponseSubmissionRecord> {
	await publicApp.ready
	const record = buildResponseSubmissionRecord(params)
	const existing = await publicApp.response_submissions
		.where({ clientSubmissionId: record.clientSubmissionId })
		.limit(1)
		.exec()
	if (existing[0]) return existing[0]

	const [formPendingCount, totalPendingCount] = await Promise.all([
		countPendingResponseSubmissions(record.formId),
		countPendingResponseSubmissions(),
	])
	assertPendingSubmissionLimit({ formPendingCount, totalPendingCount })
	return await publicApp.response_submissions.insert(record)
}

export async function savePublicFormProgress(
	params: {
		slug: string
		formId: string
		values: Record<string, string>
		currentIndex: number
		resumeId?: string | null
		resumeUrl?: string
		now?: number
	},
): Promise<PublicFormProgressRecord> {
	await publicApp.ready
	const record = buildPublicFormProgressRecord(params)
	const existing = await publicApp.public_form_progress.where({ slug: params.slug }).limit(1).exec()
	if (existing[0]?.id) {
		return await publicApp.public_form_progress.update(existing[0].id, {
			formId: record.formId,
			answers: record.answers,
			currentIndex: record.currentIndex,
			resumeId: record.resumeId,
			resumeUrl: record.resumeUrl,
			updatedAt: record.updatedAt,
		})
	}
	return await publicApp.public_form_progress.insert(record)
}

export async function readPublicFormProgress(slug: string): Promise<PublicFormProgressRecord | null> {
	await publicApp.ready
	const records = await publicApp.public_form_progress
		.where({ slug })
		.orderBy('updatedAt', 'desc')
		.limit(1)
		.exec()
	return records[0] ?? null
}

export async function clearPublicFormProgress(slug: string): Promise<void> {
	await publicApp.ready
	const records = await publicApp.public_form_progress.where({ slug }).limit(20).exec()
	await Promise.all(records.map(record => record.id ? publicApp.public_form_progress.delete(record.id) : Promise.resolve()))
}

export async function countPendingResponseSubmissions(formId?: string): Promise<number> {
	await publicApp.ready
	const baseWhere = formId ? { formId } : {}
	const submitted = await publicApp.response_submissions.where({ ...baseWhere, localStatus: 'submitted_locally' }).count()
	const failed = await publicApp.response_submissions.where({ ...baseWhere, localStatus: 'failed' }).count()
	const syncing = await publicApp.response_submissions.where({ ...baseWhere, localStatus: 'syncing' }).count()
	return submitted + failed + syncing
}

export async function countRejectedResponseSubmissions(): Promise<number> {
	await publicApp.ready
	return publicApp.response_submissions.where({ localStatus: 'rejected' }).count()
}

export async function getPublicOfflineDiagnostics(now = Date.now()): Promise<PublicOfflineDiagnostics> {
	await publicApp.ready
	const [submittedLocally, syncing, accepted, rejected, failed, blobUsage, recentFailed, recentRejected] = await Promise.all([
		publicApp.response_submissions.where({ localStatus: 'submitted_locally' }).count(),
		publicApp.response_submissions.where({ localStatus: 'syncing' }).count(),
		publicApp.response_submissions.where({ localStatus: 'accepted' }).count(),
		publicApp.response_submissions.where({ localStatus: 'rejected' }).count(),
		publicApp.response_submissions.where({ localStatus: 'failed' }).count(),
		getLocalBlobStorageUsage().catch(() => ({ bytes: 0, count: 0 })),
		publicApp.response_submissions.where({ localStatus: 'failed' }).orderBy('updatedAt', 'desc').limit(10).exec(),
		publicApp.response_submissions.where({ localStatus: 'rejected' }).orderBy('updatedAt', 'desc').limit(10).exec(),
	])
	const recentIssues = [...recentFailed, ...recentRejected]
		.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
		.slice(0, 10)
		.map(toSubmissionIssue)
	return {
		generatedAt: now,
		submissions: {
			submitted_locally: submittedLocally,
			syncing,
			accepted,
			rejected,
			failed,
		},
		pendingSubmissionCount: submittedLocally + syncing + failed,
		localBlobBytes: blobUsage.bytes,
		localBlobCount: blobUsage.count,
		recentIssues,
	}
}

export async function getPublicOfflineReadiness(
	slug: string,
	formSource: PublicFormSource | null = null,
): Promise<PublicOfflineReadiness> {
	let localDatabaseReady = true
	let cachedVersionHash = ''
	try {
		await publicApp.ready
		const local = await readLatestPublicFormVersion(slug)
		cachedVersionHash = local?.versionHash || ''
	} catch {
		localDatabaseReady = false
	}

	const [shell, diagnostics, blobUsage] = await Promise.all([
		getOfflineShellStatus(),
		getPublicOfflineDiagnostics().catch(() => null),
		getLocalBlobStorageUsage().then(
			usage => ({ ready: true, bytes: usage.bytes, count: usage.count }),
			() => ({ ready: false, bytes: 0, count: 0 }),
		),
	])

	return buildPublicOfflineReadiness({
		hasCachedForm: Boolean(cachedVersionHash),
		cachedVersionHash,
		formSource,
		appShellSupported: shell.supported,
		appShellReady: shell.ready,
		localDatabaseReady,
		blobStorageReady: blobUsage.ready,
		pendingSubmissionCount: diagnostics?.pendingSubmissionCount ?? 0,
		rejectedSubmissionCount: diagnostics?.submissions.rejected ?? 0,
		localBlobBytes: blobUsage.bytes,
		localBlobCount: blobUsage.count,
	})
}

export async function flushResponseSubmissions(
	submit: (item: ResponseSubmissionRecord & { data: string }) => Promise<void>,
	now = Date.now(),
): Promise<FlushResult> {
	await publicApp.ready
	const queue = [
		...await publicApp.response_submissions.where({ localStatus: 'submitted_locally' }).orderBy('submittedAt', 'asc').exec(),
		...await publicApp.response_submissions.where({ localStatus: 'failed' }).orderBy('submittedAt', 'asc').exec(),
	]
	let synced = 0
	let failed = 0
	let rejected = 0

	for (const item of queue) {
		if (!item.id) continue
		const attempts = Number(item.attempts || 0) + 1
		await publicApp.response_submissions.update(item.id, {
			localStatus: 'syncing',
			attempts,
			lastError: '',
			updatedAt: now,
		})
		try {
			const data = serializeJsonForTransport(item.data)
			await submit({ ...item, data, attempts, localStatus: 'syncing', updatedAt: now })
			await deleteLocalBlobsFromResponseJson(data).catch(() => {})
			await publicApp.response_submissions.update(item.id, {
				localStatus: 'accepted',
				attempts,
				lastError: '',
				updatedAt: Date.now(),
			})
			synced += 1
		} catch (error) {
			const localStatus = isPermanentSubmissionError(error) ? 'rejected' : 'failed'
			if (localStatus === 'rejected') {
				rejected += 1
			} else {
				failed += 1
			}
			await publicApp.response_submissions.update(item.id, {
				localStatus,
				attempts,
				lastError: error instanceof Error ? error.message : 'Sync failed',
				updatedAt: Date.now(),
			})
		}
	}

	const remaining = await countPendingResponseSubmissions()
	return { synced, failed, rejected, remaining }
}

function toSubmissionIssue(record: ResponseSubmissionRecord): PublicOfflineSubmissionIssue {
	return {
		id: record.id || '',
		clientSubmissionId: record.clientSubmissionId,
		formId: record.formId,
		slug: record.slug,
		status: record.localStatus === 'rejected' ? 'rejected' : 'failed',
		attempts: Number(record.attempts || 0),
		lastError: record.lastError,
		updatedAt: Number(record.updatedAt || 0),
	}
}

async function getOfflineShellStatus(): Promise<{ supported: boolean; ready: boolean }> {
	if (typeof window === 'undefined' || typeof navigator === 'undefined') {
		return { supported: false, ready: false }
	}
	if (!('serviceWorker' in navigator)) {
		return { supported: false, ready: false }
	}

	const shellPromise = (window as Window & { __KORAFORMS_OFFLINE_SHELL_READY__?: Promise<void> }).__KORAFORMS_OFFLINE_SHELL_READY__
	try {
		await Promise.race([
			shellPromise ?? navigator.serviceWorker.ready.then(() => undefined),
			new Promise<void>(resolve => window.setTimeout(resolve, 2_500)),
		])
	} catch {
		return { supported: true, ready: false }
	}

	return {
		supported: true,
		ready: Boolean(navigator.serviceWorker.controller || shellPromise),
	}
}
