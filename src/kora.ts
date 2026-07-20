import { createApp } from 'korajs'
import { createKoraAuthSync } from '@korajs/auth'
import schema from './schema'
import { authClient } from './auth'
import koraWorkerUrl from './kora-worker.ts?worker&url'

const syncUrl =
	import.meta.env.VITE_SYNC_URL ||
	`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/kora-sync`

export const app = createApp({
	schema,
	sync: {
		url: syncUrl,
		authClient: createKoraAuthSync({ authClient, schema }),
		schemaVersion: 4,
		autoConnect: true,
	},
	store: {
		workerUrl: koraWorkerUrl,
	},
	devtools: import.meta.env.DEV,
})

export type App = typeof app
