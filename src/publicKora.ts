import type { PublicApp } from './publicKoraBootstrap'

export type { PublicApp }

/**
 * Public respondent runtime.
 *
 * Mirrors Koradocs' deferred `getPublicApp()` pattern: the korajs + sqlite-wasm
 * bootstrap module is only downloaded when a public form needs local
 * persistence. Form definitions still load over REST so first paint is not
 * blocked on the store.
 */
/** Raised instead of waiting when the local database is not usable right now. */
export class PublicStoreUnavailableError extends Error {
	readonly code = 'PUBLIC_STORE_UNAVAILABLE'

	constructor(message: string, readonly reason: 'failed' | 'timeout') {
		super(message)
		this.name = 'PublicStoreUnavailableError'
	}
}

/**
 * After a failed open, wait this long before creating a new store while the
 * device is still offline. An open needs files from the network the first time
 * (sqlite3.wasm, the worker), so retrying offline only spawns workers that fail.
 */
const OFFLINE_RETRY_BACKOFF_MS = 30_000

let publicAppPromise: Promise<PublicApp> | null = null
let publicAppReadyPromise: Promise<PublicApp> | null = null
let lastFailure: { error: unknown; at: number } | null = null

function isOffline(): boolean {
	return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Lazily create the public-only Kora app (local sqlite-wasm, no auth sync).
 */
export function getPublicApp(): Promise<PublicApp> {
	if (!publicAppPromise) {
		publicAppPromise = import('./publicKoraBootstrap').then(({ createPublicApp }) => createPublicApp())
	}
	return publicAppPromise
}

/**
 * Resolve the public app and wait until its store is ready for queries.
 *
 * A failed open is not cached for the rest of the page: the next call starts a
 * new store (after a backoff while offline), so a respondent who went offline
 * before the database files arrived gets a working store once they reconnect.
 */
export function whenPublicAppReady(): Promise<PublicApp> {
	if (publicAppReadyPromise) return publicAppReadyPromise
	if (lastFailure && isOffline() && Date.now() - lastFailure.at < OFFLINE_RETRY_BACKOFF_MS) {
		return Promise.reject(lastFailure.error)
	}

	const appPromise = getPublicApp()
	const ready = appPromise
		.then(async (app) => {
			await app.ready
			return app
		})
		.then(
			(app) => {
				lastFailure = null
				return app
			},
			(error: unknown) => {
				lastFailure = { error, at: Date.now() }
				if (publicAppReadyPromise === ready) publicAppReadyPromise = null
				if (publicAppPromise === appPromise) publicAppPromise = null
				// Release the failed store's worker; the next open creates a fresh one.
				void appPromise.then(app => app.close()).catch(() => undefined)
				throw error
			},
		)
	publicAppReadyPromise = ready
	return ready
}

/**
 * Like {@link whenPublicAppReady}, but never waits longer than `timeoutMs` and
 * fails at once when the last open failed. Callers that hold a respondent's
 * answers use this to fall back to another durable store instead of hanging.
 */
export function whenPublicAppReadyWithin(timeoutMs: number): Promise<PublicApp> {
	const ready = whenPublicAppReady()
	return new Promise<PublicApp>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new PublicStoreUnavailableError(
				`The local database did not open within ${Math.round(timeoutMs / 1000)} seconds.`,
				'timeout',
			))
		}, timeoutMs)
		ready.then(
			(app) => {
				clearTimeout(timer)
				resolve(app)
			},
			(error: unknown) => {
				clearTimeout(timer)
				reject(new PublicStoreUnavailableError(
					`The local database could not open: ${error instanceof Error ? error.message : String(error)}`,
					'failed',
				))
			},
		)
	})
}
