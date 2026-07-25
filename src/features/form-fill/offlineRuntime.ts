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
	type PublicStoreIssue,
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
	type PublicStoreIssue,
	type PublicSubmissionStatus,
	type ResponseSubmissionLocalStatus,
	type ResponseSubmissionRecord,
}

const MAX_STORE_ISSUES = 5
const PUBLIC_RESPONSE_FLUSH_LOCK = 'koraforms-public-response-flush'
const publicStoreIssues: PublicStoreIssue[] = []

interface StorageFallbackEvent {
	type: 'store:storage-fallback'
	dbName: string
	from: 'opfs' | 'sqlite-wasm'
	to: 'indexeddb'
	reason: 'lock-conflict' | 'timeout' | 'unsupported'
	message: string
}

const publicStoreEvents = publicApp.events as typeof publicApp.events & {
	on(type: 'store:storage-fallback', handler: (event: StorageFallbackEvent) => void): void
}

interface PublicFlushLocks {
	request<T>(
		name: string,
		options: { ifAvailable: true },
		callback: (lock: unknown | null) => T | Promise<T>,
	): Promise<T>
}

async function withPublicResponseFlushLock<T>(callback: () => Promise<T>): Promise<T | null> {
	if (typeof navigator === 'undefined') return callback()
	const locks = (navigator as Navigator & { locks?: PublicFlushLocks }).locks
	if (!locks) return callback()
	return locks.request(PUBLIC_RESPONSE_FLUSH_LOCK, { ifAvailable: true }, lock => {
		if (!lock) return null
		return callback()
	})
}

function rememberPublicStoreIssue(issue: Omit<PublicStoreIssue, 'seenAt'>): void {
	publicStoreIssues.unshift({ ...issue, seenAt: Date.now() })
	publicStoreIssues.splice(MAX_STORE_ISSUES)
}

publicApp.events.on('store:opfs-unavailable', event => {
	rememberPublicStoreIssue({
		type: 'opfs-unavailable',
		dbName: event.dbName,
		reason: event.reason,
		message: event.message,
		blocking: true,
	})
})

publicStoreEvents.on('store:storage-fallback', event => {
	rememberPublicStoreIssue({
		type: 'storage-fallback',
		dbName: event.dbName,
		reason: event.reason,
		from: event.from,
		to: event.to,
		message: event.message,
		blocking: false,
	})
})

publicApp.events.on('store:db-name-collision', event => {
	rememberPublicStoreIssue({
		type: 'db-name-collision',
		dbName: event.dbName,
		message: event.message,
		blocking: true,
	})
})

publicApp.events.on('store:persistence-error', event => {
	rememberPublicStoreIssue({
		type: 'persistence-error',
		dbName: event.dbName,
		reason: event.code,
		message: event.message,
		blocking: true,
	})
})

publicApp.events.on('store:quota-exceeded', event => {
	rememberPublicStoreIssue({
		type: 'quota-exceeded',
		dbName: event.dbName,
		message: event.message,
		blocking: true,
	})
})

export function getPublicStoreIssues(): PublicStoreIssue[] {
	return publicStoreIssues.slice()
}

export async function savePublicFormVersion(
	slug: string,
	form: Record<string, unknown>,
	now = Date.now(),
): Promise<PublicFormVersionRecord | null> {
	if (!isCacheablePublicForm(form)) return null
	const record = buildPublicFormVersionRecord(slug, form, now)
	await publicApp.ready
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

// Metadata-only recovery aids. Kora's SQLite store remains the source of truth
// for public form payloads, respondent progress, and queued submissions.
const PUBLIC_FORM_PROGRESS_CLEARED_PREFIX = 'koraforms-public-form-progress-cleared:'
const PUBLIC_SUBMISSION_HINT_PREFIX = 'koraforms-public-submission-hints:'

interface PublicSubmissionStatusHint {
	formId: string
	pending: number
	rejected: number
	updatedAt: number
}

function publicFormProgressClearedKey(slug: string): string {
	return `${PUBLIC_FORM_PROGRESS_CLEARED_PREFIX}${slug}`
}

function readPublicFormProgressClearedAt(slug: string): number {
	if (typeof window === 'undefined') return 0
	try {
		return Number(window.localStorage.getItem(publicFormProgressClearedKey(slug)) || 0)
	} catch {
		return 0
	}
}

function forgetPublicFormProgressClearedAt(slug: string): void {
	if (typeof window === 'undefined') return
	try {
		window.localStorage.removeItem(publicFormProgressClearedKey(slug))
	} catch {
		// Tombstones are a recovery aid; Kora remains the primary progress store.
	}
}

function markPublicFormProgressCleared(slug: string, now = Date.now()): void {
	if (typeof window === 'undefined') return
	try {
		window.localStorage.setItem(publicFormProgressClearedKey(slug), String(now))
	} catch {
		// Tombstones are a recovery aid; Kora remains the primary progress store.
	}
}

function publicSubmissionHintKey(formId: string): string {
	return `${PUBLIC_SUBMISSION_HINT_PREFIX}${formId}`
}

function readPublicSubmissionStatusHint(formId: string): PublicSubmissionStatusHint {
	if (typeof window === 'undefined') {
		return { formId, pending: 0, rejected: 0, updatedAt: 0 }
	}
	try {
		const raw = window.localStorage.getItem(publicSubmissionHintKey(formId))
		if (!raw) return { formId, pending: 0, rejected: 0, updatedAt: 0 }
		const hint = JSON.parse(raw) as Partial<PublicSubmissionStatusHint>
		return {
			formId,
			pending: Math.max(0, Number(hint.pending || 0)),
			rejected: Math.max(0, Number(hint.rejected || 0)),
			updatedAt: Number(hint.updatedAt || 0),
		}
	} catch {
		return { formId, pending: 0, rejected: 0, updatedAt: 0 }
	}
}

function adjustPublicSubmissionStatusHint(
	formId: string,
	delta: { pending?: number; rejected?: number },
	now = Date.now(),
): void {
	if (typeof window === 'undefined' || !formId) return
	try {
		const current = readPublicSubmissionStatusHint(formId)
		const next: PublicSubmissionStatusHint = {
			formId,
			pending: Math.max(0, current.pending + (delta.pending || 0)),
			rejected: Math.max(0, current.rejected + (delta.rejected || 0)),
			updatedAt: now,
		}
		window.localStorage.setItem(publicSubmissionHintKey(formId), JSON.stringify(next))
	} catch {
		// Hints are metadata-only and best-effort; Kora remains the source of truth.
	}
}

export function getPublicSubmissionStatusHint(formId: string): { pending: number; rejected: number } {
	const hint = readPublicSubmissionStatusHint(formId)
	return { pending: hint.pending, rejected: hint.rejected }
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
	const inserted = await publicApp.response_submissions.insert(record)
	adjustPublicSubmissionStatusHint(record.formId, { pending: 1 }, record.submittedAt)
	return inserted
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
	forgetPublicFormProgressClearedAt(params.slug)
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
	const record = records[0] ?? null
	if (!record) return null
	const clearedAt = readPublicFormProgressClearedAt(slug)
	return clearedAt >= record.updatedAt ? null : record
}

export async function clearPublicFormProgress(slug: string): Promise<void> {
	markPublicFormProgressCleared(slug)
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
		storeIssues: getPublicStoreIssues(),
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
		storeIssues: getPublicStoreIssues(),
	})
}

export async function flushResponseSubmissions(
	submit: (item: ResponseSubmissionRecord & { data: string }) => Promise<void>,
	now = Date.now(),
): Promise<FlushResult> {
	const locked = await withPublicResponseFlushLock(() => drainResponseSubmissions(submit, now))
	if (locked) return locked
	return {
		synced: 0,
		failed: 0,
		rejected: 0,
		remaining: await countPendingResponseSubmissions(),
	}
}

async function drainResponseSubmissions(
	submit: (item: ResponseSubmissionRecord & { data: string }) => Promise<void>,
	now: number,
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
			adjustPublicSubmissionStatusHint(item.formId, { pending: -1 })
			synced += 1
		} catch (error) {
			const localStatus = isPermanentSubmissionError(error) ? 'rejected' : 'failed'
			if (localStatus === 'rejected') {
				rejected += 1
				adjustPublicSubmissionStatusHint(item.formId, { pending: -1, rejected: 1 })
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
