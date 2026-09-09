import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { BrandLoader, InlineLoader } from './components/shared/BrandLoader'
import { registerOfflineServiceWorker } from './utils/serviceWorker'
import './index.css'

const PublicFormPage = lazy(() =>
	import('./pages/PublicFormPage').then(module => ({
		default: module.PublicFormPage,
	})),
)

const PublicResultsPage = lazy(() =>
	import('./pages/PublicResultsPage').then(module => ({
		default: module.PublicResultsPage,
	})),
)

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
				{/* Public form pages — code-split so korajs/sqlite-wasm are not on the critical path */}
				<Route
					path="/f/:formId"
					element={
						<Suspense fallback={<InlineLoader message="Loading form..." />}>
							<PublicFormPage />
						</Suspense>
					}
				/>
				<Route
					path="/f/:slug/results"
					element={
						<Suspense fallback={<InlineLoader message="Loading results..." />}>
							<PublicResultsPage />
						</Suspense>
					}
				/>

				{/* Everything else goes through KoraProvider for offline-first sync */}
				<Route
					path="/*"
					element={
						<Suspense fallback={<BrandLoader />}>
							<AuthenticatedAppShell />
						</Suspense>
					}
				/>
			</Routes>
		</BrowserRouter>
	</StrictMode>,
)
