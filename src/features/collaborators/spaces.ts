import { createSpaces } from '@korajs/spaces/client'
import { authClient } from '../../auth'
import { app } from '../../kora'

/**
 * Sharing actions (invite, change a role, remove, leave, accept). Each is one request to
 * the server, which decides it: offline they throw `SpacesOfflineError` and nothing is queued.
 */
export const spaces = createSpaces(app, {
	baseUrl: import.meta.env.VITE_AUTH_URL || undefined,
	headers: async (): Promise<Record<string, string>> => {
		const token = await authClient.getAccessToken()
		return token ? { authorization: `Bearer ${token}` } : {}
	},
})

/** The sharing space of a form. */
export function formSpace(formId: string): readonly ['forms', string] {
	return ['forms', formId]
}

/** A message for a failed sharing action. */
export function sharingErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback
}
