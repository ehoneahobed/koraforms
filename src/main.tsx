import { KoraProvider } from '@korajs/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { app } from './kora'
import { authClient } from './auth'
import { App } from './App'
import { PublicFormPage } from './pages/PublicFormPage'
import { PublicResultsPage } from './pages/PublicResultsPage'
import { BrandLoader } from './components/shared/BrandLoader'
import './index.css'

// Auto sign-out when the server rejects our auth token (e.g. after a database reset)
app.events.on('sync:auth-failed', () => {
	console.warn('Sync auth failed — signing out stale session')
	authClient.signOut()
})

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter>
			<Routes>
				{/* Public form pages don't need Kora sync — render outside KoraProvider
				    so they work even if the SharedWorker/OPFS init fails */}
				<Route path="/f/:formId" element={<PublicFormPage />} />
				<Route path="/f/:slug/results" element={<PublicResultsPage />} />

				{/* Everything else goes through KoraProvider for offline-first sync */}
				<Route path="/*" element={
					<KoraProvider
						app={app}
						fallback={<BrandLoader />}
					>
						<App />
					</KoraProvider>
				} />
			</Routes>
		</BrowserRouter>
	</StrictMode>,
)
