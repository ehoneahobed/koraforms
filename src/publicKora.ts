import { createApp } from 'korajs'
import schema from './schema'
import koraWorkerUrl from './kora-worker.ts?worker&url'

/**
 * Public respondent runtime.
 *
 * This app intentionally uses Kora's local database without authenticated sync
 * for now. Public submissions are persisted here first and finalized through a
 * narrow REST bridge that performs server-side validation. Once Kora exposes a
 * first-class anonymous validated materialization hook, this file should be the
 * only integration point that needs to change.
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
