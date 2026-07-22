import type { FormSettings } from '../types'

export const FORM_PASSWORD_ALGORITHM = 'pbkdf2-sha256'
export const FORM_PASSWORD_ITERATIONS = 210_000

export function hasFormAccessPassword(settings: FormSettings): boolean {
	return !!(settings.passwordHash && settings.passwordSalt) || !!settings.password
}

export function clearFormAccessPassword(settings: FormSettings): FormSettings {
	const next = { ...settings }
	delete next.password
	delete next.passwordHash
	delete next.passwordSalt
	delete next.passwordAlgorithm
	delete next.passwordIterations
	return next
}

export function stripFormAccessSecrets(settings: FormSettings): FormSettings {
	return clearFormAccessPassword(settings)
}

export async function withFormAccessPasswordHash(settings: FormSettings, password: string): Promise<FormSettings> {
	const trimmed = password.trim()
	if (!trimmed) return clearFormAccessPassword(settings)
	const salt = randomBytes(16)
	const key = await derivePasswordKey(trimmed, salt, FORM_PASSWORD_ITERATIONS)
	return {
		...clearFormAccessPassword(settings),
		passwordHash: bytesToBase64(key),
		passwordSalt: bytesToBase64(salt),
		passwordAlgorithm: FORM_PASSWORD_ALGORITHM,
		passwordIterations: FORM_PASSWORD_ITERATIONS,
	}
}

async function derivePasswordKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	if (!globalThis.crypto?.subtle) {
		throw new Error('Secure password hashing is unavailable in this browser')
	}
	const encoded = new TextEncoder().encode(password)
	const saltBuffer = salt.slice().buffer as ArrayBuffer
	const keyMaterial = await globalThis.crypto.subtle.importKey(
		'raw',
		encoded,
		{ name: 'PBKDF2' },
		false,
		['deriveBits'],
	)
	const bits = await globalThis.crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: 'SHA-256',
			salt: saltBuffer,
			iterations,
		},
		keyMaterial,
		256,
	)
	return new Uint8Array(bits)
}

function randomBytes(length: number): Uint8Array {
	const bytes = new Uint8Array(length)
	globalThis.crypto.getRandomValues(bytes)
	return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	if (typeof btoa === 'function') return btoa(binary)
	return Buffer.from(bytes).toString('base64')
}
