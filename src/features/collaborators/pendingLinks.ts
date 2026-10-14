// Invitation and verification tokens arrive in the URL fragment, which a sign-in redirect
// drops: they are kept here until used. An invitation is kept across tabs (the verification
// email it needs usually opens in a new one) and for at most its 7-day lifetime.

const INVITE_KEY = 'kf-pending-invite'
const VERIFY_KEY = 'kf-pending-verify-email'
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function storage(kind: 'local' | 'session'): Storage | null {
	try {
		return kind === 'local' ? window.localStorage : window.sessionStorage
	} catch {
		return null
	}
}

function read(kind: 'local' | 'session', key: string): string {
	try {
		const raw = storage(kind)?.getItem(key) ?? ''
		if (kind === 'session' || !raw) return raw
		const kept = JSON.parse(raw) as { token?: unknown; savedAt?: unknown }
		if (typeof kept.token !== 'string' || typeof kept.savedAt !== 'number' || Date.now() - kept.savedAt > INVITE_TTL_MS) {
			storage(kind)?.removeItem(key)
			return ''
		}
		return kept.token
	} catch {
		return ''
	}
}

function write(kind: 'local' | 'session', key: string, token: string): void {
	try {
		if (!token) storage(kind)?.removeItem(key)
		else storage(kind)?.setItem(key, kind === 'session' ? token : JSON.stringify({ token, savedAt: Date.now() }))
	} catch {
		// Storage unavailable: the user opens the link again after signing in.
	}
}

/** The token in the page's fragment (now kept), or the one kept earlier. */
function take(kind: 'local' | 'session', key: string): string {
	const fromHash = typeof window === 'undefined' ? '' : window.location.hash.slice(1)
	if (fromHash) {
		write(kind, key, fromHash)
		// Out of the address bar, now that it is kept (the router's state stays).
		window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
		return fromHash
	}
	return read(kind, key)
}

export const pendingInvite = {
	take: (): string => take('local', INVITE_KEY),
	peek: (): string => read('local', INVITE_KEY),
	clear: (): void => write('local', INVITE_KEY, ''),
}

export const pendingVerification = {
	take: (): string => take('session', VERIFY_KEY),
	peek: (): string => read('session', VERIFY_KEY),
	clear: (): void => write('session', VERIFY_KEY, ''),
}

/** Where to go after signing in or up when nothing else was asked: a link that waits for it. */
export function pendingLinkPath(): string | null {
	if (pendingVerification.peek()) return '/verify-email'
	if (pendingInvite.peek()) return '/invite'
	return null
}
