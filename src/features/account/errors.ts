/** The server's error code carried by an auth client error (`context.serverCode`), or null. */
export function serverCodeOf(error: unknown): string | null {
	const context = (error as { context?: { serverCode?: unknown } } | null)?.context
	return typeof context?.serverCode === 'string' ? context.serverCode : null
}

/** What to tell the person for a password reset or change failure. */
export function passwordErrorMessage(error: unknown): string {
	switch (serverCodeOf(error)) {
		case 'RESET_TOKEN_EXPIRED':
			return 'This reset link has expired. Ask for a new one.'
		case 'RESET_TOKEN_INVALID':
			return 'This reset link is not valid or was already used. Ask for a new one.'
		case 'PASSWORD_TOO_SHORT':
			return 'Use at least 8 characters.'
		case 'PASSWORD_TOO_LONG':
			return 'Use at most 128 characters.'
		case 'CURRENT_PASSWORD_INCORRECT':
			return 'Your current password is incorrect.'
		case 'RATE_LIMITED':
			return 'Too many attempts. Wait a minute, then try again.'
		default:
			return (error as { code?: unknown } | null)?.code === 'AUTH_NETWORK_ERROR'
				? 'You are offline. Connect to the internet and try again.'
				: 'Something went wrong. Try again in a moment.'
	}
}

/** A problem with a new password before it is sent, or null. */
export function newPasswordProblem(password: string, confirmation: string): string | null {
	if (password.length < 8) return 'Use at least 8 characters.'
	if (password.length > 128) return 'Use at most 128 characters.'
	if (password !== confirmation) return 'The two passwords do not match.'
	return null
}
