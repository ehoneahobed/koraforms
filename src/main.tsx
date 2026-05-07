import { createApp } from 'korajs'
import { KoraProvider } from '@korajs/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import schema from './schema'
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
	},
	store: {
		workerUrl: koraWorkerUrl,
	},
	devtools: true,
})

app.ready.then(() => app.sync?.connect())

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
