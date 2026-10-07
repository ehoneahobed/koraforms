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
const LOCAL_STORAGE_KEY = 'koraforms-public-fallback-submissions'
const INDEXED_DB_TIMEOUT_MS = 3_000
const FALLBACK_FLUSH_LOCK = 'koraforms-public-fallback-flush'

export interface FallbackSubmission {
	clientSubmissionId: string
	formId: string
	slug: string
	formVersionHash: string
	data: string
	submittedAt: number
	status: 'pending' | 'rejected'
	attempts: number
	lastError: string
	updatedAt: number
	/**
	 * Set when Kora's queue may also hold this response (its insert timed out but
	 * could still land). Kora's queue then owns the local attachments.
	 */
	mayAlsoBeInKoraQueue?: boolean
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
}): Promise<FallbackSubmission> {
	const existing = (await listFallbackSubmissions()).find(item => item.clientSubmissionId === params.clientSubmissionId)
	if (existing) return existing

	const counts = await countFallbackSubmissions()
	const formCounts = await countFallbackSubmissions(params.formId)
	assertPendingSubmissionLimit({ formPendingCount: formCounts.pending, totalPendingCount: counts.pending })

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

/**
 * Sends every pending fallback response. A response the server refuses for
 * good is kept as `rejected` (never deleted), like Kora's queue does.
 */
export async function flushFallbackSubmissions(
	submit: (item: ResponseSubmissionFlushItem) => Promise<void>,
	afterAccepted: (item: FallbackSubmission) => Promise<void> = async () => undefined,
	now = Date.now(),
): Promise<FlushResult> {
	const locked = await withFlushLock(async () => {
		let synced = 0
		let failed = 0
		let rejected = 0
		for (const item of (await listFallbackSubmissions()).filter(record => record.status === 'pending')) {
			try {
				await submit({
					formId: item.formId,
					data: item.data,
					clientSubmissionId: item.clientSubmissionId,
					submittedAt: item.submittedAt,
					formVersionHash: item.formVersionHash,
				})
				await deleteRecord(item.clientSubmissionId)
				await afterAccepted(item).catch(() => undefined)
				synced += 1
			} catch (error) {
				const permanent = isPermanentSubmissionError(error)
				if (permanent) rejected += 1
				else failed += 1
				await putRecord({
					...item,
					status: permanent ? 'rejected' : 'pending',
					attempts: item.attempts + 1,
					lastError: error instanceof Error ? error.message : 'Sync failed',
					updatedAt: now,
				}).catch(() => undefined)
			}
		}
		return { synced, failed, rejected }
	})
	const counts = await countFallbackSubmissions()
	return { synced: locked?.synced ?? 0, failed: locked?.failed ?? 0, rejected: locked?.rejected ?? 0, remaining: counts.pending }
}

/**
 * Drops a response that is still waiting here because Kora's queue turned out
 * to hold it after all. Waits for any flush in progress, so a response that is
 * being sent right now is never pulled from under it.
 */
export async function forgetPendingFallbackSubmission(clientSubmissionId: string): Promise<void> {
	await withFlushLock(async () => {
		const record = (await listFallbackSubmissions()).find(item => item.clientSubmissionId === clientSubmissionId)
		if (record?.status === 'pending') await deleteRecord(clientSubmissionId)
	}, { wait: true })
}

interface FlushLocks {
	request<R>(name: string, options: { ifAvailable?: boolean }, cb: (lock: unknown | null) => R | Promise<R>): Promise<R>
}

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
		const records = readLocalStorage().filter(item => item.clientSubmissionId !== record.clientSubmissionId)
		records.push(record)
		globalThis.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records))
	} catch {
		throw new FallbackStorageError()
	}
}

async function deleteRecord(clientSubmissionId: string): Promise<void> {
	await withIndexedDb('readwrite', store => store.delete(clientSubmissionId)).catch(() => undefined)
	removeFromLocalStorage(clientSubmissionId)
}

function readLocalStorage(): FallbackSubmission[] {
	try {
		const raw = globalThis.localStorage?.getItem(LOCAL_STORAGE_KEY)
		if (!raw) return []
		const parsed = JSON.parse(raw) as unknown
		return Array.isArray(parsed) ? parsed.filter(isFallbackSubmission) : []
	} catch {
		return []
	}
}

function removeFromLocalStorage(clientSubmissionId: string): void {
	try {
		const records = readLocalStorage()
		const remaining = records.filter(item => item.clientSubmissionId !== clientSubmissionId)
		if (remaining.length === records.length) return
		if (remaining.length === 0) globalThis.localStorage.removeItem(LOCAL_STORAGE_KEY)
		else globalThis.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remaining))
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
		&& (record.status === 'pending' || record.status === 'rejected')
}
