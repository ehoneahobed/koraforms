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
	const record = buildPublicFormVersionRecord(slug, form, now)
	writePublicFormRecoverySnapshot(record)
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

const PUBLIC_FORM_PEER_CHANNEL = 'koraforms-public-form-cache'
const PUBLIC_FORM_RECOVERY_PREFIX = 'koraforms-public-form-recovery:'
const PUBLIC_FORM_PROGRESS_CLEARED_PREFIX = 'koraforms-public-form-progress-cleared:'
const PUBLIC_SUBMISSION_HINT_PREFIX = 'koraforms-public-submission-hints:'

interface PublicFormPeerRequest {
	type: 'request-public-form'
	requestId: string
	slug: string
}

interface PublicFormPeerResponse {
	type: 'public-form'
	requestId: string
	slug: string
	form: Record<string, unknown>
	versionHash?: string
}

type PublicFormPeerMessage = PublicFormPeerRequest | PublicFormPeerResponse

interface PublicFormRecoverySnapshot {
	slug: string
	form: Record<string, unknown>
	versionHash: string
	cachedAt: number
}

interface PublicSubmissionStatusHint {
	formId: string
	pending: number
	rejected: number
	updatedAt: number
}

function publicFormRecoveryKey(slug: string): string {
	return `${PUBLIC_FORM_RECOVERY_PREFIX}${slug}`
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

function writePublicFormRecoverySnapshot(record: PublicFormVersionRecord): void {
	if (typeof window === 'undefined') return
	try {
		const snapshot: PublicFormRecoverySnapshot = {
			slug: record.slug,
			form: publicFormRecordToForm(record),
			versionHash: record.versionHash,
			cachedAt: record.cachedAt,
		}
		window.localStorage.setItem(publicFormRecoveryKey(record.slug), JSON.stringify(snapshot))
	} catch {
		// Recovery snapshots are best-effort because Kora remains the primary local data plane.
	}
}

function readPublicFormRecoverySnapshot(slug: string): PublicFormRecoverySnapshot | null {
	if (typeof window === 'undefined') return null
	try {
		const raw = window.localStorage.getItem(publicFormRecoveryKey(slug))
		if (!raw) return null
		const snapshot = JSON.parse(raw) as Partial<PublicFormRecoverySnapshot>
		if (
			snapshot.slug !== slug ||
			typeof snapshot.versionHash !== 'string' ||
			typeof snapshot.cachedAt !== 'number' ||
			!snapshot.form ||
			!isCacheablePublicForm(snapshot.form)
		) {
			return null
		}
		return {
			slug,
			form: snapshot.form,
			versionHash: snapshot.versionHash,
			cachedAt: snapshot.cachedAt,
		}
	} catch {
		return null
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

export function startPublicFormPeerResponder(params: {
	slug: string
	getForm: () => Record<string, unknown> | null
	getVersionHash?: () => string
}): () => void {
	if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return () => {}
	const channel = new BroadcastChannel(PUBLIC_FORM_PEER_CHANNEL)
	channel.addEventListener('message', (event: MessageEvent<PublicFormPeerMessage>) => {
		const message = event.data
		if (!message || message.type !== 'request-public-form' || message.slug !== params.slug) return
		const form = params.getForm()
		if (!form || !isCacheablePublicForm(form)) return
		channel.postMessage({
			type: 'public-form',
			requestId: message.requestId,
			slug: params.slug,
			form,
			versionHash: params.getVersionHash?.() || stableHash(form),
		} satisfies PublicFormPeerResponse)
	})
	return () => channel.close()
}

export async function requestPublicFormFromPeer(
	slug: string,
	timeoutMs = 1_500,
): Promise<{ form: Record<string, unknown>; versionHash: string } | null> {
	if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null
	const requestId = `form_peer_${Date.now()}_${Math.random().toString(36).slice(2)}`
	const channel = new BroadcastChannel(PUBLIC_FORM_PEER_CHANNEL)
	return await new Promise((resolve) => {
		const timeout = window.setTimeout(() => {
			channel.close()
			resolve(null)
		}, timeoutMs)
		channel.addEventListener('message', (event: MessageEvent<PublicFormPeerMessage>) => {
			const message = event.data
			if (
				!message ||
				message.type !== 'public-form' ||
				message.requestId !== requestId ||
				message.slug !== slug ||
				!isCacheablePublicForm(message.form)
			) {
				return
			}
			window.clearTimeout(timeout)
			channel.close()
			resolve({ form: message.form, versionHash: message.versionHash || stableHash(message.form) })
		})
		channel.postMessage({ type: 'request-public-form', requestId, slug } satisfies PublicFormPeerRequest)
	})
}

export function readPublicFormRecovery(
	slug: string,
): { form: Record<string, unknown>; versionHash: string } | null {
	const snapshot = readPublicFormRecoverySnapshot(slug)
	if (!snapshot) return null
	return { form: snapshot.form, versionHash: snapshot.versionHash }
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
