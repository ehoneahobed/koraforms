import { createApp } from 'korajs'
import { createKoraAuthSync } from '@korajs/auth'
import schema from './schema'
import { authClient } from './auth'
import koraWorkerUrl from './kora-worker.ts?worker&url'

const syncUrl =
	import.meta.env.VITE_SYNC_URL ||
	`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/kora-sync`

/**
 * Authenticated creator app. Match official Kora sync templates: do not
 * auto-connect during module init. Open the WebSocket only after the local
 * store is ready and an access token is available.
 */
export const app = createApp({
	schema,
	sync: {
		url: syncUrl,
		authClient: createKoraAuthSync({ authClient, schema }),
		schemaVersion: 19,
		autoConnect: false,
	},
	store: {
		adapter: 'sqlite-wasm',
		workerUrl: koraWorkerUrl,
	},
	devtools: import.meta.env.DEV,
})

let syncBootstrapStarted = false
let connectInFlight: Promise<boolean> | null = null

/**
 * Open sync after local sqlite is ready and auth has a usable token.
 * Safe to call repeatedly; concurrent callers share one in-flight attempt.
 */
export async function ensureSyncConnected(): Promise<boolean> {
	if (connectInFlight) return connectInFlight

	connectInFlight = (async () => {
		await app.ready
		const accessToken = await authClient.getAccessToken()
		if (!accessToken) return false
		await app.sync?.connect()
		return true
	})()

	try {
		return await connectInFlight
	} finally {
		connectInFlight = null
	}
}

/** Wire one-time ready + auth-change reconnect for the creator shell. */
export function bootstrapCreatorSync(): void {
	if (syncBootstrapStarted) return
	syncBootstrapStarted = true

	void ensureSyncConnected().catch((error) => {
		console.warn('Initial sync connect failed', error)
	})

	authClient.onAuthChange(() => {
		void ensureSyncConnected().catch((error) => {
			console.warn('Auth-change sync connect failed', error)
		})
	})
}

export type App = typeof app
