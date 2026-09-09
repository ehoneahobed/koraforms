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

		// If Azure (or the network) drops the socket, retry while the tab is open.
		const onDisconnected = () => {
			window.setTimeout(() => {
				void ensureSyncConnected().catch(() => {})
			}, 1_000)
		}
		app.events.on('sync:disconnected', onDisconnected)

		const retryTimer = window.setInterval(() => {
			const status = app.sync?.getStatus()?.status
			if (status === 'offline' || status === 'error') {
				void ensureSyncConnected().catch(() => {})
			}
		}, 15_000)

		return () => {
			app.events.off('sync:disconnected', onDisconnected)
			window.clearInterval(retryTimer)
		}
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
