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
let publicAppPromise: Promise<PublicApp> | null = null

/**
 * Lazily create the public-only Kora app (local sqlite-wasm, no auth sync).
 */
export function getPublicApp(): Promise<PublicApp> {
	if (!publicAppPromise) {
		publicAppPromise = import('./publicKoraBootstrap').then(({ createPublicApp }) => createPublicApp())
	}
	return publicAppPromise
}

/** Resolve the public app and wait until its store is ready for queries. */
export async function whenPublicAppReady(): Promise<PublicApp> {
	const app = await getPublicApp()
	await app.ready
	return app
}
