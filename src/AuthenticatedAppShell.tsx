import { useEffect } from 'react'
import { KoraProvider } from '@korajs/react'
import { App } from './App'
import { authClient } from './auth'
import { BrandLoader } from './components/shared/BrandLoader'
import { app, bootstrapCreatorSync, ensureSyncConnected } from './kora'

let authFailureHandlerBound = false

function bindAuthFailureHandler() {
	if (authFailureHandlerBound) return
	authFailureHandlerBound = true

	app.events.on('sync:auth-failed', () => {
		void (async () => {
			// Give token refresh a chance before treating the session as dead.
			const token = await authClient.getAccessToken().catch(() => null)
			if (token) {
				console.warn('Sync auth failed with a refreshable session — retrying connect')
				await ensureSyncConnected().catch((error) => {
					console.warn('Sync reconnect after auth-failed failed', error)
				})
				return
			}
			console.warn('Sync auth failed - signing out stale session')
			await authClient.signOut()
		})()
	})
}

export function AuthenticatedAppShell() {
	bindAuthFailureHandler()

	useEffect(() => {
		bootstrapCreatorSync()
	}, [])

	return (
		<KoraProvider
			app={app}
			fallback={<BrandLoader />}
		>
			<App />
		</KoraProvider>
	)
}
