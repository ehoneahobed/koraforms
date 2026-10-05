import { expect, type Page } from '@playwright/test'

export async function waitForServiceWorkerControl(page: Page): Promise<void> {
	await page.evaluate(async () => {
		if (!('serviceWorker' in navigator)) return
		await navigator.serviceWorker.ready
		if (!navigator.serviceWorker.controller) {
			await new Promise<void>((resolve) => {
				navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
				setTimeout(resolve, 5_000)
			})
		}
	})
}

export async function waitForOfflineRouteCache(page: Page): Promise<void> {
	await expect.poll(
		() => page.evaluate(() => Boolean((window as Window & { __KORAFORMS_OFFLINE_SHELL_READY__?: Promise<void> }).__KORAFORMS_OFFLINE_SHELL_READY__)),
		{ timeout: 10_000 },
	).toBe(true)
	await page.evaluate(async () => {
		await (window as Window & { __KORAFORMS_OFFLINE_SHELL_READY__?: Promise<void> }).__KORAFORMS_OFFLINE_SHELL_READY__
	})
	await expect.poll(
		() => page.evaluate(async () => {
			if (!('caches' in window)) return false
			const documentAssets = [
				...Array.from(document.scripts).map(script => script.src).filter(Boolean),
				...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(link => link.href).filter(Boolean),
			]
			const required = [window.location.href, '/index.html', ...documentAssets]
			for (const url of required) {
				if (!await caches.match(url)) return false
			}
			return true
		}),
		{ timeout: 10_000 },
	).toBe(true)
}
