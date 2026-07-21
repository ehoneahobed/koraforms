import test from 'node:test'
import assert from 'node:assert/strict'
import {
	readJsonFromStorage,
	readStringFromStorage,
	removeStorageItem,
	writeJsonToStorage,
	writeStringToStorage,
} from '../../src/utils/storage'

class MemoryStorage {
	private values = new Map<string, string>()

	getItem(key: string): string | null {
		return this.values.get(key) ?? null
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value)
	}

	removeItem(key: string): void {
		this.values.delete(key)
	}
}

const throwingStorage = {
	getItem() {
		throw new Error('blocked')
	},
	setItem() {
		throw new Error('blocked')
	},
	removeItem() {
		throw new Error('blocked')
	},
}

test('storage helpers read and write JSON safely', () => {
	const storage = new MemoryStorage()
	assert.equal(writeJsonToStorage('prefs', { theme: 'dark' }, storage), true)
	assert.deepEqual(readJsonFromStorage('prefs', {}, storage), { theme: 'dark' })
	assert.deepEqual(readJsonFromStorage('missing', { theme: 'light' }, storage), { theme: 'light' })
})

test('storage helpers read and write strings safely', () => {
	const storage = new MemoryStorage()
	assert.equal(writeStringToStorage('theme', 'dark', storage), true)
	assert.equal(readStringFromStorage('theme', 'light', storage), 'dark')
	assert.equal(removeStorageItem('theme', storage), true)
	assert.equal(readStringFromStorage('theme', 'light', storage), 'light')
})

test('storage helpers return fallbacks when storage throws', () => {
	assert.deepEqual(readJsonFromStorage('prefs', { ok: false }, throwingStorage), { ok: false })
	assert.equal(readStringFromStorage('theme', 'light', throwingStorage), 'light')
	assert.equal(writeJsonToStorage('prefs', {}, throwingStorage), false)
	assert.equal(writeStringToStorage('theme', 'dark', throwingStorage), false)
	assert.equal(removeStorageItem('theme', throwingStorage), false)
})
