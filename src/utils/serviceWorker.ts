declare global {
	interface Window {
		__KORAFORMS_OFFLINE_SHELL_READY__?: Promise<void>
	}
}

export function registerOfflineServiceWorker(): void {
	if (typeof window === 'undefined') return
	if (!('serviceWorker' in navigator)) return

	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js')
			.then(async (registration) => {
				await navigator.serviceWorker.ready
				warmCurrentOfflineShell(registration)
			})
			.catch((error) => {
				console.warn('KoraForms offline service worker registration failed', error)
			})
	})
}

function warmCurrentOfflineShell(registration: ServiceWorkerRegistration): void {
	const worker = registration.active || registration.waiting || registration.installing
	if (!worker) return

	const sameOriginResources = performance
		.getEntriesByType('resource')
		.map(entry => entry.name)
		.filter((name) => {
			try {
				const url = new URL(name)
				return url.origin === window.location.origin
					&& !url.pathname.startsWith('/api/')
					&& !url.pathname.startsWith('/auth')
					&& !url.pathname.startsWith('/kora-sync')
			} catch {
				return false
			}
		})

	const channel = new MessageChannel()
	const urls = [
		'/',
		'/index.html',
		window.location.href,
		...sameOriginResources,
	]

	window.__KORAFORMS_OFFLINE_SHELL_READY__ = new Promise<void>((resolve) => {
		const timer = window.setTimeout(resolve, 10_000)
		channel.port1.onmessage = () => {
			window.clearTimeout(timer)
			resolve()
		}
	})

	worker.postMessage({ type: 'CACHE_CURRENT_RESOURCES', urls }, [channel.port2])
}
