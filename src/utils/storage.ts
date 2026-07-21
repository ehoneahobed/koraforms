import { safeJsonParse } from '../domain/forms'

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function getStorage(storage?: BrowserStorage): BrowserStorage | null {
	if (storage) return storage
	if (typeof window === 'undefined') return null
	try {
		return window.localStorage
	} catch {
		return null
	}
}

export function readJsonFromStorage<T>(key: string, fallback: T, storage?: BrowserStorage): T {
	const store = getStorage(storage)
	if (!store) return fallback
	try {
		return safeJsonParse<T>(store.getItem(key), fallback)
	} catch {
		return fallback
	}
}

export function writeJsonToStorage(key: string, value: unknown, storage?: BrowserStorage): boolean {
	const store = getStorage(storage)
	if (!store) return false
	try {
		store.setItem(key, JSON.stringify(value))
		return true
	} catch {
		return false
	}
}

export function readStringFromStorage(key: string, fallback = '', storage?: BrowserStorage): string {
	const store = getStorage(storage)
	if (!store) return fallback
	try {
		return store.getItem(key) ?? fallback
	} catch {
		return fallback
	}
}

export function writeStringToStorage(key: string, value: string, storage?: BrowserStorage): boolean {
	const store = getStorage(storage)
	if (!store) return false
	try {
		store.setItem(key, value)
		return true
	} catch {
		return false
	}
}

export function removeStorageItem(key: string, storage?: BrowserStorage): boolean {
	const store = getStorage(storage)
	if (!store) return false
	try {
		store.removeItem(key)
		return true
	} catch {
		return false
	}
}
