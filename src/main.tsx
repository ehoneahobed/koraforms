import { createApp } from 'korajs'
import { KoraProvider } from '@korajs/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import schema from './schema'
import { authClient } from './auth'
import { App } from './App'
import './index.css'
import koraWorkerUrl from './kora-worker.ts?worker&url'

const syncUrl =
	import.meta.env.VITE_SYNC_URL ||
	`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/kora-sync`

const app = createApp({
	schema,
	sync: {
		url: syncUrl,
		auth: async () => {
			// Return token if authenticated, empty string for anonymous sync.
			// The server accepts both: authenticated users get full access,
			// anonymous users get scoped write access to 'responses' only.
			const token = await authClient.getAccessToken()
			return { token: token ?? '' }
		},
	},
	store: {
		workerUrl: koraWorkerUrl,
	},
	devtools: true,
})

app.ready.then(() => app.sync?.connect())

// Auto sign-out when the server rejects our auth token (e.g. after a database reset)
app.events.on('sync:auth-failed', () => {
	console.warn('Sync auth failed — signing out stale session')
	authClient.signOut()
})

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<KoraProvider
			app={app}
			fallback={
				<div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">
					Loading KoraForms...
				</div>
			}
		>
			<App />
		</KoraProvider>
	</StrictMode>,
)
