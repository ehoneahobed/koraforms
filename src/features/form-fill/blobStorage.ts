import type { BlobRef } from '@korajs/core'
import { createOpfsBlobStore, putBlobForTransfer } from '@korajs/store'
import { assertLocalBlobStorageLimit } from './offlineModel'

export const LOCAL_BLOB_STORAGE_KIND = 'koraforms-local-blob'

const DATABASE_NAME = 'koraforms-public-blobs'
const DATABASE_VERSION = 1
const STORE_NAME = 'blobs'
const KORA_BLOB_STORE_NAME = 'koraforms-public-response-blobs'

export interface LocalBlobManifest {
	kind: typeof LOCAL_BLOB_STORAGE_KIND
	blobId: string
	name: string
	type: string
	size: number
	createdAt: number
	storage?: 'kora-opfs' | 'indexeddb'
	ref?: BlobRef
}

interface StoredLocalBlob extends LocalBlobManifest {
	blob: Blob
}

let koraBlobStorePromise: ReturnType<typeof createOpfsBlobStore> | null = null

export function isLocalBlobManifest(value: unknown): value is LocalBlobManifest {
	if (!value || typeof value !== 'object') return false
	const record = value as Record<string, unknown>
	return record.kind === LOCAL_BLOB_STORAGE_KIND &&
		typeof record.blobId === 'string' &&
		typeof record.name === 'string' &&
		typeof record.type === 'string' &&
		typeof record.size === 'number' &&
		typeof record.createdAt === 'number'
}

export function parseLocalBlobManifest(value: string): LocalBlobManifest | null {
	if (!value) return null
	try {
		const parsed = JSON.parse(value) as unknown
		return isLocalBlobManifest(parsed) ? parsed : null
	} catch {
		return null
	}
}

export function serializeLocalBlobManifest(manifest: LocalBlobManifest): string {
	return JSON.stringify(manifest)
}

export async function saveLocalBlob(
	blob: Blob,
	options: {
		name: string
		type?: string
		now?: number
		replacingBlobId?: string | null
	},
): Promise<LocalBlobManifest> {
	const db = await openBlobDatabase()
	try {
		const [currentBytes, replacingBytes] = await Promise.all([
			getTotalLocalBlobBytes(db),
			options.replacingBlobId ? getLocalBlobBytes(options.replacingBlobId, db) : Promise.resolve(0),
		])
		assertLocalBlobStorageLimit({
			currentBytes,
			nextBlobBytes: blob.size,
			replacingBytes,
		})
	} finally {
		db.close()
	}

	const saved = await saveKoraLocalBlob(blob, options).catch(() => null)
	if (saved) return saved

	const manifest: LocalBlobManifest = {
		kind: LOCAL_BLOB_STORAGE_KIND,
		blobId: createBlobId(),
		name: options.name || 'attachment',
		type: options.type || blob.type || 'application/octet-stream',
		size: blob.size,
		createdAt: options.now ?? Date.now(),
		storage: 'indexeddb',
	}
	const writeDb = await openBlobDatabase()
	try {
		await runStoreRequest(writeDb, 'readwrite', store => store.put({ ...manifest, blob }))
		return manifest
	} finally {
		writeDb.close()
	}
}

export async function readLocalBlob(blobId: string): Promise<StoredLocalBlob | null> {
	const koraRecord = await readKoraLocalBlob(blobId).catch(() => null)
	if (koraRecord) return koraRecord

	const db = await openBlobDatabase()
	try {
		const record = await runStoreRequest(db, 'readonly', store => store.get(blobId))
		return isStoredLocalBlob(record) ? record : null
	} finally {
		db.close()
	}
}

export async function deleteLocalBlob(blobId: string): Promise<void> {
	await deleteKoraLocalBlob(blobId).catch(() => {})
	const db = await openBlobDatabase()
	try {
		await runStoreRequest(db, 'readwrite', store => store.delete(blobId))
	} finally {
		db.close()
	}
}

export async function deleteLocalBlobsFromResponseJson(responseJson: string): Promise<void> {
	const manifests = collectLocalBlobManifestsFromResponseJson(responseJson)
	await Promise.all(manifests.map(manifest => deleteLocalBlob(manifest.blobId)))
}

export async function getLocalBlobStorageUsage(): Promise<{ bytes: number; count: number }> {
	const db = await openBlobDatabase()
	try {
		const [records, koraUsage] = await Promise.all([
			getAllLocalBlobRecords(db),
			getKoraLocalBlobUsage().catch(() => ({ bytes: 0, count: 0 })),
		])
		return {
			bytes: sumBlobBytes(records) + koraUsage.bytes,
			count: records.length + koraUsage.count,
		}
	} finally {
		db.close()
	}
}

export function collectLocalBlobManifestsFromResponseJson(responseJson: string): LocalBlobManifest[] {
	let parsed: unknown
	try {
		parsed = JSON.parse(responseJson) as unknown
	} catch {
		return []
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []

	return Object.values(parsed as Record<string, unknown>)
		.flatMap((value) => {
			if (typeof value !== 'string') return []
			const manifest = parseLocalBlobManifest(value)
			return manifest ? [manifest] : []
		})
}

export async function hydrateLocalBlobValues(responseJson: string): Promise<string> {
	const parsed = JSON.parse(responseJson) as unknown
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return responseJson
	let changed = false
	const hydrated: Record<string, unknown> = {}

	for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
		if (typeof value !== 'string') {
			hydrated[key] = value
			continue
		}
		const manifest = parseLocalBlobManifest(value)
		if (!manifest) {
			hydrated[key] = value
			continue
		}
		const record = await readLocalBlob(manifest.blobId)
		if (!record) {
			throw new Error(`Attachment "${manifest.name}" is no longer available on this device.`)
		}
		hydrated[key] = await blobToDataUrl(withManifestMimeType(record.blob, manifest))
		changed = true
	}

	return changed ? JSON.stringify(hydrated) : responseJson
}

async function saveKoraLocalBlob(
	blob: Blob,
	options: {
		name: string
		type?: string
		now?: number
		replacingBlobId?: string | null
	},
): Promise<LocalBlobManifest> {
	const store = await getKoraBlobStore()
	const bytes = new Uint8Array(await blob.arrayBuffer())
	const { ref } = await putBlobForTransfer(store, bytes, {
		filename: options.name || 'attachment',
		mimeType: options.type || blob.type || 'application/octet-stream',
	})
	if (options.replacingBlobId && options.replacingBlobId !== ref.hash) {
		await deleteLocalBlob(options.replacingBlobId).catch(() => {})
	}
	return {
		kind: LOCAL_BLOB_STORAGE_KIND,
		blobId: ref.hash,
		name: ref.filename || options.name || 'attachment',
		type: ref.mimeType || options.type || blob.type || 'application/octet-stream',
		size: ref.size,
		createdAt: options.now ?? Date.now(),
		storage: 'kora-opfs',
		ref,
	}
}

async function readKoraLocalBlob(blobId: string): Promise<StoredLocalBlob | null> {
	const store = await getKoraBlobStore()
	const bytes = await store.get(blobId)
	if (!bytes) return null
	return {
		kind: LOCAL_BLOB_STORAGE_KIND,
		blobId,
		name: 'attachment',
		type: 'application/octet-stream',
		size: bytes.byteLength,
		createdAt: 0,
		storage: 'kora-opfs',
		ref: { hash: blobId, size: bytes.byteLength },
		blob: new Blob([bytesToArrayBuffer(bytes)]),
	}
}

async function deleteKoraLocalBlob(blobId: string): Promise<void> {
	const store = await getKoraBlobStore()
	await store.delete(blobId)
}

async function getKoraLocalBlobUsage(): Promise<{ bytes: number; count: number }> {
	const store = await getKoraBlobStore()
	const hashes = await store.list()
	const sizes = await Promise.all(hashes.map(async (hash) => {
		const bytes = await store.get(hash)
		return bytes?.byteLength || 0
	}))
	return {
		bytes: sizes.reduce((total, size) => total + size, 0),
		count: hashes.length,
	}
}

function getKoraBlobStore(): ReturnType<typeof createOpfsBlobStore> {
	if (!koraBlobStorePromise) {
		koraBlobStorePromise = createOpfsBlobStore(KORA_BLOB_STORE_NAME)
	}
	return koraBlobStorePromise
}

function openBlobDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
		request.onupgradeneeded = () => {
			const db = request.result
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'blobId' })
			}
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error || new Error('Unable to open local blob store'))
	})
}

function runStoreRequest<T>(
	db: IDBDatabase,
	mode: IDBTransactionMode,
	createRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, mode)
		const request = createRequest(tx.objectStore(STORE_NAME))
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error || new Error('Local blob store request failed'))
		tx.onerror = () => reject(tx.error || new Error('Local blob store transaction failed'))
	})
}

function isStoredLocalBlob(value: unknown): value is StoredLocalBlob {
	return isLocalBlobManifest(value) && (value as { blob?: unknown }).blob instanceof Blob
}

async function getTotalLocalBlobBytes(db: IDBDatabase): Promise<number> {
	const [indexedDbBytes, koraUsage] = await Promise.all([
		getIndexedDbBlobStorageBytes(db),
		getKoraLocalBlobUsage().catch(() => ({ bytes: 0, count: 0 })),
	])
	return indexedDbBytes + koraUsage.bytes
}

async function getIndexedDbBlobStorageBytes(db: IDBDatabase): Promise<number> {
	return sumBlobBytes(await getAllLocalBlobRecords(db))
}

async function getLocalBlobBytes(blobId: string, db: IDBDatabase): Promise<number> {
	const koraRecord = await readKoraLocalBlob(blobId).catch(() => null)
	if (koraRecord) return koraRecord.size
	const record = await runStoreRequest(db, 'readonly', store => store.get(blobId))
	return isStoredLocalBlob(record) ? record.size : 0
}

function getAllLocalBlobRecords(db: IDBDatabase): Promise<StoredLocalBlob[]> {
	return runStoreRequest(db, 'readonly', store => store.getAll())
		.then(records => Array.isArray(records) ? records.filter(isStoredLocalBlob) : [])
}

function sumBlobBytes(records: StoredLocalBlob[]): number {
	return records.reduce((total, record) => total + Math.max(0, Number(record.size) || 0), 0)
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(bytes.byteLength)
	new Uint8Array(buffer).set(bytes)
	return buffer
}

function withManifestMimeType(blob: Blob, manifest: LocalBlobManifest): Blob {
	const type = manifest.type || blob.type || 'application/octet-stream'
	if (blob.type === type) return blob
	return blob.slice(0, blob.size, type)
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result || ''))
		reader.onerror = () => reject(reader.error || new Error('Unable to read attachment'))
		reader.readAsDataURL(blob)
	})
}

function createBlobId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
	return `blob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}
