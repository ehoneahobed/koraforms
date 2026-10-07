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
	type PublicOfflineFormDiagnostics,
	type PublicOfflineReadiness,
	type PublicOfflineSubmissionIssue,
	type PublicFormSource,
	type PublicFormProgressRecord,
	type PublicFormVersionRecord,
	type PublicStoreIssue,
	type PublicSubmissionStatus,
	type ResponseSubmissionFlushItem,
	type ResponseSubmissionLocalStatus,
	type ResponseSubmissionRecord,
	PublicOfflineLimitError,
} from './offlineModel'
import { whenPublicAppReady, whenPublicAppReadyWithin, type PublicApp } from '../../publicKora'
import { forgetPendingFallbackSubmission, saveFallbackSubmission } from './fallbackQueue'
import { getPublicStoreIssues } from './publicStoreIssues'
import { deleteLocalBlobsFromResponseJson, getLocalBlobStorageUsage, preloadLocalBlobStore } from './blobStorage'
import { serializeJsonForTransport } from '../../domain/forms'

export { getPublicStoreIssues }

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
	type PublicOfflineFormDiagnostics,
	type PublicOfflineReadiness,
	type PublicOfflineSubmissionIssue,
	type PublicFormSource,
	type PublicFormProgressRecord,
	type PublicFormVersionRecord,
	type PublicStoreIssue,
	type PublicSubmissionStatus,
	type ResponseSubmissionFlushItem,
	type ResponseSubmissionLocalStatus,
	type ResponseSubmissionRecord,
}

const PUBLIC_RESPONSE_FLUSH_LOCK = 'koraforms-public-response-flush'

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

async function readyPublicApp(): Promise<PublicApp> {
	return whenPublicAppReady()
}

export async function savePublicFormVersion(
	slug: string,
	form: Record<string, unknown>,
	now = Date.now(),
): Promise<PublicFormVersionRecord | null> {
	const publicApp = await readyPublicApp()
	if (!isCacheablePublicForm(form)) return null
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
	const publicApp = await readyPublicApp()
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
	const publicApp = await readyPublicApp()
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

/** How long a submit waits for a local database that is still opening. */
const STORE_WAIT_AT_SUBMIT_MS = 4_000
/** How long a submit waits for the queue insert itself. */
const STORE_INSERT_TIMEOUT_MS = 15_000

/**
 * Keeps a completed response on this device until it can be sent. Kora's local
 * database is the normal home; when it is not open within a few seconds (it
 * could not download its files before the connection dropped, or it failed),
 * the response goes to the fallback queue instead of waiting for Kora's
 * 60-second init timeout. Throws only when nothing on the device can keep it,
 * with a message the respondent can act on.
 */
export async function queueResponseSubmissionDurably(params: {
	formId: string
	slug?: string
	formVersionHash?: string
	data: string
	clientSubmissionId: string
	now: number
}): Promise<{ storage: 'kora' | 'fallback' }> {
	const fallback = async (mayAlsoBeInKoraQueue = false): Promise<{ storage: 'fallback' }> => {
		await saveFallbackSubmission({
			clientSubmissionId: params.clientSubmissionId,
			formId: params.formId,
			slug: params.slug,
			formVersionHash: params.formVersionHash,
			data: params.data,
			submittedAt: params.now,
			mayAlsoBeInKoraQueue,
		})
		return { storage: 'fallback' }
	}

	try {
		await whenPublicAppReadyWithin(STORE_WAIT_AT_SUBMIT_MS)
	} catch {
		return fallback()
	}
	const inserting = enqueueResponseSubmission(params)
	try {
		await withTimeout(inserting, STORE_INSERT_TIMEOUT_MS)
		return { storage: 'kora' }
	} catch (error) {
		// The device limit is a decision, not a storage failure: show it.
		if (error instanceof PublicOfflineLimitError) throw error
		const timedOut = error instanceof InsertTimeoutError
		const saved = await fallback(timedOut)
		// A slow insert can still land: then Kora's queue sends the response and
		// the copy kept here is dropped, unless a flush has already sent it (the
		// server ignores the second copy by its clientSubmissionId).
		if (timedOut) {
			void inserting
				.then(() => forgetPendingFallbackSubmission(params.clientSubmissionId))
				.catch(() => undefined)
		}
		return saved
	}
}

class InsertTimeoutError extends Error {
	constructor(timeoutMs: number) {
		super(`The local database did not save the response within ${timeoutMs}ms`)
		this.name = 'InsertTimeoutError'
	}
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new InsertTimeoutError(timeoutMs)), timeoutMs)
		promise.then(
			(value) => {
				clearTimeout(timer)
				resolve(value)
			},
			(error: unknown) => {
				clearTimeout(timer)
				reject(error)
			},
		)
	})
}

/**
 * Loads the attachment store while online, for forms that collect files or
 * signatures. Without it an offline attachment is still kept, in IndexedDB.
 */
export function preloadAttachmentStore(): Promise<boolean> {
	return preloadLocalBlobStore()
}

const RUNTIME_CACHE_NAME = 'koraforms-runtime-v1'
let warmOfflinePromise: Promise<boolean> | null = null

/**
 * Prepares everything an offline submit needs while the page is still online:
 * opens the local database (which downloads sqlite3.wasm and the worker), then
 * copies the database files and this page's scripts
 * into the service worker's cache so a later offline reload finds them. Done in
 * the page because a first visit is not controlled by the service worker yet.
 * Resolves `true` once the local database is open; `false` when it could not
 * open (the respondent can still submit through the fallback queue).
 */
export function warmOfflineSubmitPath(): Promise<boolean> {
	if (!warmOfflinePromise) {
		const warming = whenPublicAppReady().then(
			() => {
				void cacheOfflineSubmitAssets().catch(() => undefined)
				return true
			},
			() => false,
		)
		warmOfflinePromise = warming
		void warming.then((ready) => {
			if (!ready && warmOfflinePromise === warming) warmOfflinePromise = null
		})
	}
	return warmOfflinePromise
}

async function cacheOfflineSubmitAssets(): Promise<void> {
	if (typeof window === 'undefined' || !('caches' in window)) return
	const { PUBLIC_STORE_ASSET_URLS } = await import('../../publicKoraBootstrap')
	const pageScripts = performance
		.getEntriesByType('resource')
		.map(entry => entry.name)
		.filter((name) => {
			try {
				const url = new URL(name)
				return url.origin === window.location.origin
					&& url.pathname.startsWith('/assets/')
					&& /\.(?:js|css|wasm)$/.test(url.pathname)
			} catch {
				return false
			}
		})
	const urls = new Set([...PUBLIC_STORE_ASSET_URLS, ...pageScripts].map(url => new URL(url, window.location.origin).href))
	const cache = await caches.open(RUNTIME_CACHE_NAME)
	for (const url of urls) {
		try {
			if (await cache.match(url)) continue
			// The files were just downloaded for the database open; with their ETag
			// this is a revalidation, not a second download.
			const response = await fetch(url, { credentials: 'same-origin' })
			if (response.ok) await cache.put(url, response)
		} catch {
			// One missing file must not stop the rest; the service worker warms too.
		}
	}
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
	const publicApp = await readyPublicApp()
	forgetPublicFormProgressClearedAt(params.slug)
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
	const publicApp = await readyPublicApp()
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
	const publicApp = await readyPublicApp()
	markPublicFormProgressCleared(slug)
	const records = await publicApp.public_form_progress.where({ slug }).limit(20).exec()
	await Promise.all(records.map(record => record.id ? publicApp.public_form_progress.delete(record.id) : Promise.resolve()))
}

export async function countPendingResponseSubmissions(formId?: string): Promise<number> {
	const publicApp = await readyPublicApp()
	const baseWhere = formId ? { formId } : {}
	const submitted = await publicApp.response_submissions.where({ ...baseWhere, localStatus: 'submitted_locally' }).count()
	const failed = await publicApp.response_submissions.where({ ...baseWhere, localStatus: 'failed' }).count()
	const syncing = await publicApp.response_submissions.where({ ...baseWhere, localStatus: 'syncing' }).count()
	return submitted + failed + syncing
}

export async function countRejectedResponseSubmissions(): Promise<number> {
	const publicApp = await readyPublicApp()
	return publicApp.response_submissions.where({ localStatus: 'rejected' }).count()
}

export async function getPublicOfflineDiagnostics(now = Date.now()): Promise<PublicOfflineDiagnostics> {
	const publicApp = await readyPublicApp()
	const [
		submittedLocally,
		syncing,
		accepted,
		rejected,
		failed,
		blobUsage,
		recentFailed,
		recentRejected,
		submissionRecords,
		progressRecords,
	] = await Promise.all([
		publicApp.response_submissions.where({ localStatus: 'submitted_locally' }).count(),
		publicApp.response_submissions.where({ localStatus: 'syncing' }).count(),
		publicApp.response_submissions.where({ localStatus: 'accepted' }).count(),
		publicApp.response_submissions.where({ localStatus: 'rejected' }).count(),
		publicApp.response_submissions.where({ localStatus: 'failed' }).count(),
		getLocalBlobStorageUsage().catch(() => ({ bytes: 0, count: 0 })),
		publicApp.response_submissions.where({ localStatus: 'failed' }).orderBy('updatedAt', 'desc').limit(10).exec(),
		publicApp.response_submissions.where({ localStatus: 'rejected' }).orderBy('updatedAt', 'desc').limit(10).exec(),
		publicApp.response_submissions.where({}).orderBy('updatedAt', 'desc').limit(1_000).exec(),
		publicApp.public_form_progress.where({}).orderBy('updatedAt', 'desc').limit(1_000).exec(),
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
		savedProgressCount: progressRecords.length,
		localBlobBytes: blobUsage.bytes,
		localBlobCount: blobUsage.count,
		recentIssues,
		storeIssues: getPublicStoreIssues(),
		forms: buildPublicOfflineFormDiagnostics(submissionRecords, progressRecords),
	}
}

export async function getPublicOfflineReadiness(
	slug: string,
	formSource: PublicFormSource | null = null,
): Promise<PublicOfflineReadiness> {
	let localDatabaseReady = true
	let cachedVersionHash = ''
	try {
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
	submit: (item: ResponseSubmissionFlushItem) => Promise<void>,
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
	submit: (item: ResponseSubmissionFlushItem) => Promise<void>,
	now: number,
): Promise<FlushResult> {
	const publicApp = await readyPublicApp()
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
			await submit({
				formId: item.formId,
				data,
				clientSubmissionId: item.clientSubmissionId,
				submittedAt: item.submittedAt,
				formVersionHash: item.formVersionHash || '',
			})
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
		slug: record.slug || '',
		status: record.localStatus === 'rejected' ? 'rejected' : 'failed',
		attempts: Number(record.attempts || 0),
		lastError: record.lastError || '',
		updatedAt: Number(record.updatedAt || 0),
	}
}

function buildPublicOfflineFormDiagnostics(
	submissions: readonly ResponseSubmissionRecord[],
	progressRecords: readonly PublicFormProgressRecord[],
): PublicOfflineFormDiagnostics[] {
	const forms = new Map<string, PublicOfflineFormDiagnostics>()

	const getEntry = (formId: string, slug: string): PublicOfflineFormDiagnostics => {
		const key = formId || slug
		const existing = forms.get(key)
		if (existing) {
			if (!existing.formId && formId) existing.formId = formId
			if (!existing.slug && slug) existing.slug = slug
			return existing
		}
		const entry: PublicOfflineFormDiagnostics = {
			formId,
			slug,
			submitted_locally: 0,
			syncing: 0,
			accepted: 0,
			rejected: 0,
			failed: 0,
			progressCount: 0,
			lastActivityAt: 0,
		}
		forms.set(key, entry)
		return entry
	}

	for (const submission of submissions) {
		const entry = getEntry(String(submission.formId || ''), String(submission.slug || ''))
		entry[submission.localStatus ?? 'submitted_locally'] += 1
		entry.lastActivityAt = Math.max(
			entry.lastActivityAt,
			Number(submission.updatedAt || 0),
			Number(submission.submittedAt || 0),
		)
	}

	for (const progress of progressRecords) {
		const entry = getEntry(String(progress.formId || ''), String(progress.slug || ''))
		entry.progressCount += 1
		entry.lastActivityAt = Math.max(
			entry.lastActivityAt,
			Number(progress.updatedAt || 0),
			Number(progress.savedAt || 0),
		)
	}

	return [...forms.values()]
		.filter(form => form.formId || form.slug)
		.sort((a, b) => b.lastActivityAt - a.lastActivityAt)
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
