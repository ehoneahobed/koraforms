import { verifySecretValue } from '@korajs/core'
import type { FormSettings } from '../types'

export function hasFormAccessPasswordSecret(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0
}

export function clearFormAccessPassword(settings: FormSettings): FormSettings {
	return { ...settings }
}

export function stripFormAccessSecrets(settings: FormSettings): FormSettings {
	return clearFormAccessPassword(settings)
}

export async function verifyFormAccessPasswordSecret(secret: unknown, password: string | undefined): Promise<boolean> {
	if (!hasFormAccessPasswordSecret(secret)) return true
	if (!password) return false
	return verifySecretValue(password, secret)
}
