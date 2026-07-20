import { KoraProvider } from '@korajs/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { app } from './kora'
import { authClient } from './auth'
import { App } from './App'
import './index.css'

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
