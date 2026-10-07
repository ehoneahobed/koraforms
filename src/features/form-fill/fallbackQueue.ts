import { assertPendingSubmissionLimit, isPermanentSubmissionError, type FlushResult, type ResponseSubmissionFlushItem } from './offlineModel'

/**
 * A last-resort durable queue for completed responses, used when Kora's local
 * database cannot open (for example: the respondent went offline before the
 * browser had downloaded sqlite3.wasm on a first visit). It needs no lazily
 * loaded code: IndexedDB first, then localStorage. Items are sent straight to
 * the REST endpoint when the connection returns; the server deduplicates by
 * clientSubmissionId, so a retry can never create a second response.
 */
const DATABASE_NAME = 'koraforms-public-fallback'
const DATABASE_VERSION = 1
const STORE_NAME = 'submissions'
/**
 * localStorage keeps one key per response, so two tabs saving at once never
 * read-modify-write a shared value (each tab writes to its own cached copy of
 * localStorage; a shared array would keep only the last writer's version).
 */
const LOCAL_STORAGE_PREFIX = 'koraforms-public-fallback-submission:'
/** The earlier format: every response in one JSON array. Migrated on read. */
const LEGACY_LOCAL_STORAGE_KEY = 'koraforms-public-fallback-submissions'
const INDEXED_DB_TIMEOUT_MS = 3_000
const FALLBACK_FLUSH_LOCK = 'koraforms-public-fallback-flush'

export interface FallbackSubmission {
	clientSubmissionId: string
	formId: string
	slug: string
	formVersionHash: string
	data: string
	submittedAt: number
	/**
	 * `sent`: the server has it; only the local clean-up (its attachments) is
	 * left, waiting to learn whether Kora's queue owns them. Not counted.
	 */
	status: 'pending' | 'rejected' | 'sent'
	attempts: number
	lastError: string
	updatedAt: number
	/**
	 * Set when Kora's queue may also hold this response (its insert timed out but
	 * could still land). Whether it does is checked, not assumed, before this
	 * copy is sent or its attachments are deleted.
	 */
	mayAlsoBeInKoraQueue?: boolean
}

/** Whether Kora's queue holds a submission; `unknown` when its database cannot be asked. */
export type KoraPresence = 'present' | 'absent' | 'unknown'

/** Kora's queue, as the fallback queue needs to see it for the shared limits. */
export interface PendingElsewhere {
	/** Responses waiting in Kora's queue for `formId`, and on the whole device. */
	counts(formId: string): Promise<{ form: number; total: number }>
	holds(clientSubmissionId: string): Promise<KoraPresence>
}

/** Neither IndexedDB nor localStorage could keep the response. */
export class FallbackStorageError extends Error {
	readonly code = 'FALLBACK_STORAGE_UNAVAILABLE'

	constructor() {
		super('This device could not save your response. Your answers are still on this page: reconnect to the internet and press Submit again.')
		this.name = 'FallbackStorageError'
	}
}

export async function saveFallbackSubmission(params: {
	clientSubmissionId: string
	formId: string
	slug?: string
	formVersionHash?: string
	data: string
	submittedAt: number
	mayAlsoBeInKoraQueue?: boolean
}, options: { pendingElsewhere?: PendingElsewhere } = {}): Promise<FallbackSubmission> {
	const existing = (await listFallbackSubmissions()).find(item => item.clientSubmissionId === params.clientSubmissionId)
	if (existing) return existing

	assertPendingSubmissionLimit(await countPendingAcrossQueues(params.formId, options.pendingElsewhere, params.clientSubmissionId))

	const record: FallbackSubmission = {
		clientSubmissionId: params.clientSubmissionId,
		formId: params.formId,
		slug: params.slug || '',
		formVersionHash: params.formVersionHash || '',
		data: params.data,
		submittedAt: params.submittedAt,
		status: 'pending',
		attempts: 0,
		lastError: '',
		updatedAt: params.submittedAt,
		...(params.mayAlsoBeInKoraQueue ? { mayAlsoBeInKoraQueue: true } : {}),
	}
	await putRecord(record)
	return record
}

/**
 * Responses waiting on this device across Kora's queue and this one, for the
 * per-form and device limits. A response in both queues (a timed-out Kora
 * insert that landed after all) counts once; when Kora cannot be asked it
 * counts twice, so the limits are never under-counted. `excludeId` is the
 * response being saved, which must not count against itself.
 */
export async function countPendingAcrossQueues(
	formId: string,
	elsewhere?: PendingElsewhere,
	excludeId?: string,
): Promise<{ formPendingCount: number; totalPendingCount: number }> {
	const pending = (await listFallbackSubmissions())
		.filter(record => record.status === 'pending' && record.clientSubmissionId !== excludeId)
	const kora = elsewhere ? await elsewhere.counts(formId) : { form: 0, total: 0 }
	let formPendingCount = kora.form
	let totalPendingCount = kora.total
	// The response being saved (a form `formId` response) may already be in Kora's queue.
	if (excludeId && elsewhere && (await elsewhere.holds(excludeId)) === 'present') {
		formPendingCount = Math.max(0, formPendingCount - 1)
		totalPendingCount = Math.max(0, totalPendingCount - 1)
	}
	for (const record of pending) {
		if (record.mayAlsoBeInKoraQueue && elsewhere && (await elsewhere.holds(record.clientSubmissionId)) === 'present') continue
		totalPendingCount += 1
		if (record.formId === formId) formPendingCount += 1
	}
	return { formPendingCount, totalPendingCount }
}

export async function listFallbackSubmissions(): Promise<FallbackSubmission[]> {
	const [fromIndexedDb, fromLocalStorage] = await Promise.all([
		readAllIndexedDb().catch(() => [] as FallbackSubmission[]),
		Promise.resolve(readLocalStorage()),
	])
	const byId = new Map<string, FallbackSubmission>()
	for (const record of [...fromLocalStorage, ...fromIndexedDb]) byId.set(record.clientSubmissionId, record)
	return [...byId.values()].sort((a, b) => a.submittedAt - b.submittedAt)
}

export async function countFallbackSubmissions(formId?: string): Promise<{ pending: number; rejected: number }> {
	const records = (await listFallbackSubmissions()).filter(record => !formId || record.formId === formId)
	return {
		pending: records.filter(record => record.status === 'pending').length,
		rejected: records.filter(record => record.status === 'rejected').length,
	}
}

export interface FallbackFlushOptions {
	/** Whether Kora's queue holds a flagged response. Defaults to `unknown`. */
	koraPresence?: (clientSubmissionId: string) => Promise<KoraPresence>
	/** Deletes the local attachments a response refers to, once nothing else needs them. */
	deleteBlobs?: (data: string) => Promise<void>
	now?: number
}

/**
 * Sends every pending fallback response. A response the server refuses for
 * good is kept as `rejected` (never deleted), like Kora's queue does.
 *
 * A response Kora's queue turns out to hold is left to Kora (it sends it and
 * owns its attachments). After the server accepts a response, it is marked
 * `sent` before its attachments are deleted, so a crash in between leaves a
 * clean-up for the next flush instead of a resend with missing attachments.
 */
export async function flushFallbackSubmissions(
	submit: (item: ResponseSubmissionFlushItem) => Promise<void>,
	options: FallbackFlushOptions = {},
): Promise<FlushResult> {
	const koraPresence = options.koraPresence ?? (async () => 'unknown' as const)
	const deleteBlobs = options.deleteBlobs ?? (async () => undefined)
	const now = options.now ?? Date.now()
	const finishSent = async (record: FallbackSubmission): Promise<void> => {
		const presence = record.mayAlsoBeInKoraQueue ? await koraPresence(record.clientSubmissionId) : 'absent'
		// Kora may still need the attachments: decide on a later flush.
		if (presence === 'unknown') return
		if (presence === 'absent') {
			try {
				await deleteBlobs(record.data)
			} catch {
				return
			}
		}
		await deleteRecord(record.clientSubmissionId)
	}

	const locked = await withFlushLock(async () => {
		let synced = 0
		let failed = 0
		let rejected = 0
		for (const listed of await listFallbackSubmissions()) {
			let item = listed
			if (item.status === 'sent') {
				await finishSent(item).catch(() => undefined)
				continue
			}
			if (item.mayAlsoBeInKoraQueue) {
				const presence = await koraPresence(item.clientSubmissionId)
				// Kora's queue sends it (or keeps it for review) and owns its attachments.
				if (presence === 'present') {
					await deleteRecord(item.clientSubmissionId)
					continue
				}
				if (presence === 'absent') {
					item = withoutKoraClaim(item)
					await putRecord(item).catch(() => undefined)
				}
			}
			if (item.status !== 'pending') continue
			try {
				await submit({
					formId: item.formId,
					data: item.data,
					clientSubmissionId: item.clientSubmissionId,
					submittedAt: item.submittedAt,
					formVersionHash: item.formVersionHash,
				})
			} catch (error) {
				const permanent = isPermanentSubmissionError(error)
				if (permanent) rejected += 1
				else failed += 1
				// Another tab without Web Locks may have finished it meanwhile: never
				// bring a removed response back.
				if (!(await readRecord(item.clientSubmissionId))) continue
				await putRecord({
					...item,
					status: permanent ? 'rejected' : 'pending',
					attempts: item.attempts + 1,
					lastError: error instanceof Error ? error.message : 'Sync failed',
					updatedAt: now,
				}).catch(() => undefined)
				continue
			}
			synced += 1
			const sent: FallbackSubmission = { ...item, status: 'sent', attempts: item.attempts + 1, lastError: '', updatedAt: now }
			await putRecord(sent).catch(() => undefined)
			await finishSent(sent).catch(() => undefined)
		}
		return { synced, failed, rejected }
	})
	const counts = await countFallbackSubmissions()
	return { synced: locked?.synced ?? 0, failed: locked?.failed ?? 0, rejected: locked?.rejected ?? 0, remaining: counts.pending }
}

/**
 * Drops the copy kept here because Kora's queue turned out to hold the
 * response after all. Kora's queue keeps its own copy (also when the server
 * refuses it), so nothing is lost. Waits for any flush in progress, so a
 * response that is being sent right now is never pulled from under it.
 */
export async function forgetFallbackSubmissionHeldByKora(clientSubmissionId: string): Promise<void> {
	await withFlushLock(async () => {
		if (await readRecord(clientSubmissionId)) await deleteRecord(clientSubmissionId)
	}, { wait: true })
}

/**
 * Records how a Kora insert that timed out at submit ended. If it landed,
 * Kora's queue holds the response and the copy here is dropped. If it failed,
 * Kora holds nothing: the copy here is the only one and owns its attachments.
 */
export async function settleLateKoraInsert(clientSubmissionId: string, inserting: Promise<unknown>): Promise<void> {
	let landed: boolean
	try {
		await inserting
		landed = true
	} catch {
		landed = false
	}
	if (landed) {
		await forgetFallbackSubmissionHeldByKora(clientSubmissionId)
		return
	}
	await withFlushLock(async () => {
		const record = await readRecord(clientSubmissionId)
		if (record?.mayAlsoBeInKoraQueue) await putRecord(withoutKoraClaim(record))
	}, { wait: true })
}

function withoutKoraClaim(record: FallbackSubmission): FallbackSubmission {
	const { mayAlsoBeInKoraQueue: _claim, ...rest } = record
	return rest
}

interface FlushLocks {
	request<R>(name: string, options: { ifAvailable?: boolean }, cb: (lock: unknown | null) => R | Promise<R>): Promise<R>
}

/**
 * Web Locks are shared by every tab of the origin, so only one tab flushes at
 * a time. Without them (older browsers) two tabs may both send a response; the
 * server keeps one by its clientSubmissionId.
 */
async function withFlushLock<T>(callback: () => Promise<T>, options: { wait?: boolean } = {}): Promise<T | null> {
	const locks = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { locks?: FlushLocks }).locks
	if (!locks) return callback()
	if (options.wait) return locks.request(FALLBACK_FLUSH_LOCK, {}, () => callback())
	return locks.request(FALLBACK_FLUSH_LOCK, { ifAvailable: true }, lock => (lock ? callback() : null))
}

async function putRecord(record: FallbackSubmission): Promise<void> {
	try {
		await withIndexedDb('readwrite', store => store.put(record))
		removeFromLocalStorage(record.clientSubmissionId)
		return
	} catch {
		// IndexedDB is missing, blocked or full: localStorage is the second tier.
	}
	try {
		globalThis.localStorage.setItem(localStorageKey(record.clientSubmissionId), JSON.stringify(record))
		removeFromLegacyLocalStorage(record.clientSubmissionId)
	} catch {
		throw new FallbackStorageError()
	}
}

async function readRecord(clientSubmissionId: string): Promise<FallbackSubmission | null> {
	const fromIndexedDb = await withIndexedDb('readonly', store => store.get(clientSubmissionId)).catch(() => undefined)
	if (isFallbackSubmission(fromIndexedDb)) return fromIndexedDb
	return readLocalStorage().find(record => record.clientSubmissionId === clientSubmissionId) ?? null
}

async function deleteRecord(clientSubmissionId: string): Promise<void> {
	await withIndexedDb('readwrite', store => store.delete(clientSubmissionId)).catch(() => undefined)
	removeFromLocalStorage(clientSubmissionId)
}

function localStorageKey(clientSubmissionId: string): string {
	return `${LOCAL_STORAGE_PREFIX}${clientSubmissionId}`
}

function getLocalStorage(): Storage | null {
	try {
		return globalThis.localStorage ?? null
	} catch {
		// Some private modes throw on access.
		return null
	}
}

function readLocalStorage(): FallbackSubmission[] {
	const storage = getLocalStorage()
	if (!storage) return []
	const legacy = migrateLegacyLocalStorage(storage)
	const records = new Map<string, FallbackSubmission>()
	for (const record of legacy) records.set(record.clientSubmissionId, record)
	try {
		const keys: string[] = []
		for (let index = 0; index < storage.length; index++) {
			const key = storage.key(index)
			if (key?.startsWith(LOCAL_STORAGE_PREFIX)) keys.push(key)
		}
		for (const key of keys) {
			const record = parseRecord(storage.getItem(key))
			if (record) records.set(record.clientSubmissionId, record)
		}
	} catch {
		// Unreadable storage holds nothing usable.
	}
	return [...records.values()]
}

function parseRecord(raw: string | null): FallbackSubmission | null {
	if (!raw) return null
	try {
		const parsed = JSON.parse(raw) as unknown
		return isFallbackSubmission(parsed) ? parsed : null
	} catch {
		return null
	}
}

/**
 * Moves responses saved in the single-array format to their own keys. The
 * array is removed only once every record is copied and only if no one changed
 * it meanwhile; records that could not be moved are still returned, so a full
 * storage never hides a response.
 */
function migrateLegacyLocalStorage(storage: Storage): FallbackSubmission[] {
	let raw: string | null
	try {
		raw = storage.getItem(LEGACY_LOCAL_STORAGE_KEY)
	} catch {
		return []
	}
	if (!raw) return []
	let records: FallbackSubmission[]
	try {
		const parsed = JSON.parse(raw) as unknown
		records = Array.isArray(parsed) ? parsed.filter(isFallbackSubmission) : []
	} catch {
		return []
	}
	try {
		for (const record of records) {
			if (!storage.getItem(localStorageKey(record.clientSubmissionId))) {
				storage.setItem(localStorageKey(record.clientSubmissionId), JSON.stringify(record))
			}
		}
		if (storage.getItem(LEGACY_LOCAL_STORAGE_KEY) === raw) storage.removeItem(LEGACY_LOCAL_STORAGE_KEY)
		return []
	} catch {
		return records
	}
}

function removeFromLocalStorage(clientSubmissionId: string): void {
	const storage = getLocalStorage()
	if (!storage) return
	try {
		storage.removeItem(localStorageKey(clientSubmissionId))
	} catch {
		// Nothing stored there.
	}
	removeFromLegacyLocalStorage(clientSubmissionId)
}

/** Only reached when a legacy array could not be migrated (storage full). */
function removeFromLegacyLocalStorage(clientSubmissionId: string): void {
	const storage = getLocalStorage()
	if (!storage) return
	try {
		const raw = storage.getItem(LEGACY_LOCAL_STORAGE_KEY)
		if (!raw) return
		const parsed = JSON.parse(raw) as unknown
		if (!Array.isArray(parsed)) return
		const remaining = parsed.filter(item => !(isFallbackSubmission(item) && item.clientSubmissionId === clientSubmissionId))
		if (remaining.length === parsed.length) return
		if (remaining.length === 0) storage.removeItem(LEGACY_LOCAL_STORAGE_KEY)
		else storage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(remaining))
	} catch {
		// Nothing stored there.
	}
}

function readAllIndexedDb(): Promise<FallbackSubmission[]> {
	return withIndexedDb('readonly', store => store.getAll())
		.then(records => (Array.isArray(records) ? records.filter(isFallbackSubmission) : []))
}

function withIndexedDb<T>(mode: IDBTransactionMode, createRequest: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable'))
	return new Promise<T>((resolve, reject) => {
		let settled = false
		const finish = (fn: () => void) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			fn()
		}
		// A blocked or stalled IndexedDB must not hold a respondent's submit.
		const timer = setTimeout(() => finish(() => reject(new Error('IndexedDB timed out'))), INDEXED_DB_TIMEOUT_MS)
		let open: IDBOpenDBRequest
		try {
			open = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
		} catch (error) {
			finish(() => reject(error))
			return
		}
		open.onupgradeneeded = () => {
			if (!open.result.objectStoreNames.contains(STORE_NAME)) {
				open.result.createObjectStore(STORE_NAME, { keyPath: 'clientSubmissionId' })
			}
		}
		open.onerror = () => finish(() => reject(open.error || new Error('IndexedDB open failed')))
		open.onsuccess = () => {
			const db = open.result
			try {
				const tx = db.transaction(STORE_NAME, mode)
				const request = createRequest(tx.objectStore(STORE_NAME))
				tx.oncomplete = () => {
					db.close()
					finish(() => resolve(request.result))
				}
				tx.onerror = () => {
					db.close()
					finish(() => reject(tx.error || new Error('IndexedDB transaction failed')))
				}
				tx.onabort = () => {
					db.close()
					finish(() => reject(tx.error || new Error('IndexedDB transaction aborted')))
				}
			} catch (error) {
				db.close()
				finish(() => reject(error))
			}
		}
	})
}

function isFallbackSubmission(value: unknown): value is FallbackSubmission {
	if (!value || typeof value !== 'object') return false
	const record = value as Record<string, unknown>
	return typeof record.clientSubmissionId === 'string'
		&& typeof record.formId === 'string'
		&& typeof record.data === 'string'
		&& typeof record.submittedAt === 'number'
		&& (record.status === 'pending' || record.status === 'rejected' || record.status === 'sent')
}
