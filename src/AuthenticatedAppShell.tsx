import { KoraProvider } from '@korajs/react'
import { App } from './App'
import { authClient } from './auth'
import { BrandLoader } from './components/shared/BrandLoader'
import { app } from './kora'

let authFailureHandlerBound = false

function bindAuthFailureHandler() {
	if (authFailureHandlerBound) return
	authFailureHandlerBound = true

	app.events.on('sync:auth-failed', () => {
		console.warn('Sync auth failed - signing out stale session')
		authClient.signOut()
	})
}

export function AuthenticatedAppShell() {
	bindAuthFailureHandler()

	return (
		<KoraProvider
			app={app}
			fallback={<BrandLoader />}
		>
			<App />
		</KoraProvider>
	)
}
