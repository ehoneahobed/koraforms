import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { PublicFormPage } from './pages/PublicFormPage'
import { PublicResultsPage } from './pages/PublicResultsPage'
import { BrandLoader } from './components/shared/BrandLoader'
import { registerOfflineServiceWorker } from './utils/serviceWorker'
import './index.css'

const AuthenticatedAppShell = lazy(() =>
	import('./AuthenticatedAppShell').then(module => ({
		default: module.AuthenticatedAppShell,
	})),
)

registerOfflineServiceWorker()

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
					<Suspense fallback={<BrandLoader />}>
						<AuthenticatedAppShell />
					</Suspense>
				} />
			</Routes>
		</BrowserRouter>
	</StrictMode>,
)
