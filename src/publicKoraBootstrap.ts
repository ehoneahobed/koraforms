import { createApp } from 'korajs'
import schema from './schema'
import koraWorkerUrl from './kora-worker.ts?worker&url'
import { PUBLIC_LOCAL_MAX_OPERATION_BYTES } from './domain/limits'

/**
 * Eager createApp factory used only after dynamic import from `publicKora.ts`.
 * Keeping this in a separate module lets the public form route avoid downloading
 * korajs/sqlite-wasm until offline persistence is actually needed.
 */
export function createPublicApp() {
	return createApp({
		schema,
		store: {
			adapter: 'sqlite-wasm',
			name: 'koraforms-public',
			workerUrl: koraWorkerUrl,
			// This database never syncs; its largest write is one queued response.
			maxOperationBytes: PUBLIC_LOCAL_MAX_OPERATION_BYTES,
		},
		devtools: import.meta.env.DEV,
	})
}

export type PublicApp = ReturnType<typeof createPublicApp>
