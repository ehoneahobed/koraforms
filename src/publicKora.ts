import { createApp } from 'korajs'
import schema from './schema'
import koraWorkerUrl from './kora-worker.ts?worker&url'

/**
 * Public respondent runtime.
 *
 * This app intentionally uses Kora's local database without authenticated sync
 * for now. Public submissions are persisted here first and finalized through a
 * narrow REST bridge that performs server-side validation. Kora beta.6 provides
 * durable multi-tab storage through the sqlite-wasm leader/follower path with
 * IndexedDB fallback when OPFS is unavailable, so public forms can remain fully
 * usable for field workers without a network connection.
 */
export const publicApp = createApp({
	schema,
	store: {
		adapter: 'sqlite-wasm',
		name: 'koraforms-public',
		workerUrl: koraWorkerUrl,
	},
	devtools: import.meta.env.DEV,
})

export type PublicApp = typeof publicApp
