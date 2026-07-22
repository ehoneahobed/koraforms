const KORAFORMS_SHELL_CACHE = 'koraforms-shell-v1'
const KORAFORMS_RUNTIME_CACHE = 'koraforms-runtime-v1'
const KORAFORMS_RUNTIME_URLS = [
	'/assets/sqlite3.wasm',
	'/assets/sqlite3-opfs-async-proxy.js',
]
const SHELL_URLS = [
	'/',
	'/index.html',
	'/site.webmanifest',
	'/logo-icon.png',
	'/icon-192.png',
	'/icon-512.png',
	'/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(KORAFORMS_SHELL_CACHE)
			.then(cache => cache.addAll(SHELL_URLS))
			.then(() => self.skipWaiting()),
	)
})

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then(keys => Promise.all(
				keys
					.filter(key => ![KORAFORMS_SHELL_CACHE, KORAFORMS_RUNTIME_CACHE].includes(key))
					.map(key => caches.delete(key)),
			))
			.then(() => self.clients.claim()),
	)
})

self.addEventListener('fetch', (event) => {
	const request = event.request
	if (request.method !== 'GET') return

	const url = new URL(request.url)
	if (url.origin !== self.location.origin) return

	if (request.mode === 'navigate') {
		event.respondWith(networkFirstNavigation(request))
		return
	}

	if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/kora-sync')) {
		return
	}

	event.respondWith(staleWhileRevalidate(request))
})

self.addEventListener('message', (event) => {
	const data = event.data || {}
	if (data.type !== 'CACHE_CURRENT_RESOURCES' || !Array.isArray(data.urls)) return

	event.waitUntil(
		cacheCurrentResources(data.urls)
			.then(result => {
				event.ports?.[0]?.postMessage({ type: 'CACHE_CURRENT_RESOURCES_COMPLETE', ...result })
			})
			.catch(error => {
				event.ports?.[0]?.postMessage({
					type: 'CACHE_CURRENT_RESOURCES_COMPLETE',
					error: error instanceof Error ? error.message : 'Cache warmup failed',
					cached: 0,
					requested: data.urls.length,
				})
			}),
	)
})

async function networkFirstNavigation(request) {
	try {
		const response = await fetch(request)
		const cache = await caches.open(KORAFORMS_RUNTIME_CACHE)
		cache.put(request, response.clone()).catch(() => {})
		return response
	} catch {
		const cachedPage = await caches.match(request) || await caches.match(request.url)
		if (cachedPage) return cachedPage
		const shell = await caches.match('/index.html')
		if (shell) return shell
		return new Response('KoraForms is unavailable offline until this page has loaded once.', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' },
		})
	}
}

async function cacheCurrentResources(urls) {
	const cache = await caches.open(KORAFORMS_RUNTIME_CACHE)
	const queue = Array.from(new Set([...urls, ...KORAFORMS_RUNTIME_URLS]))
		.map(url => {
			try {
				return new URL(url, self.location.origin)
			} catch {
				return null
			}
		})
		.filter(url => {
			if (!url || url.origin !== self.location.origin) return false
			if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/kora-sync') || url.pathname.startsWith('/auth')) return false
			return true
		})
		.map(url => url.href)

	const seen = new Set()
	let cached = 0

	while (queue.length > 0) {
		const url = queue.shift()
		if (!url || seen.has(url)) continue
		seen.add(url)

		try {
			const response = await fetch(url, { credentials: 'same-origin' })
			if (!response.ok) continue

			await cache.put(url, response.clone())
			cached += 1

			if (!isDiscoverableAsset(url, response)) continue
			const text = await response.text()
			for (const discovered of discoverSameOriginAssetUrls(text, url)) {
				if (!seen.has(discovered)) queue.push(discovered)
			}
		} catch {
			// One missed asset should not prevent the rest of the shell from warming.
		}
	}

	return {
		requested: seen.size,
		cached,
	}
}

function isDiscoverableAsset(url, response) {
	const contentType = response.headers.get('content-type') || ''
	return contentType.includes('text/html')
		|| contentType.includes('javascript')
		|| url.endsWith('.js')
		|| url.endsWith('.html')
}

function discoverSameOriginAssetUrls(text, baseUrl) {
	const urls = new Set()
	const patterns = [
		/(?:src|href)=["']([^"']+)["']/g,
		/["'`]((?:\/assets\/|\.\/)[^"'`]+\.(?:js|css|wasm))["'`]/g,
		/["'`](\/(?:icon|logo|apple-touch-icon|site\.webmanifest)[^"'`]*)["'`]/g,
	]

	for (const pattern of patterns) {
		let match
		while ((match = pattern.exec(text))) {
			try {
				const url = new URL(match[1], baseUrl)
				if (url.origin === self.location.origin) urls.add(url.href)
			} catch {
				// Ignore malformed static references.
			}
		}
	}

	return urls
}

async function staleWhileRevalidate(request) {
	const cache = await caches.open(KORAFORMS_RUNTIME_CACHE)
	const cached = await cache.match(request) || await cache.match(request.url)
	const network = fetch(request)
		.then(response => {
			if (response.ok) cache.put(request, response.clone()).catch(() => {})
			return response
		})
		.catch(() => undefined)

	return cached || await network || new Response('', { status: 504 })
}
