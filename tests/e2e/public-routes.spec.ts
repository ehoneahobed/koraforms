import { expect, test, type Page } from '@playwright/test'

const PUBLIC_ROUTES = [
	{ path: '/', heading: /build forms that work anywhere/i },
	{ path: '/templates', heading: /start with the right structure/i },
	{ path: '/templates/rsvp', heading: /^rsvp$/i },
	{ path: '/how-it-works', heading: /how koraforms works/i },
	{ path: '/help', heading: /help center/i },
	{ path: '/privacy', heading: /privacy policy/i },
	{ path: '/terms', heading: /terms of service/i },
]

test.beforeEach(async ({ page }) => {
	await mockAnonymousAuth(page)
})

test.describe('public release routes', () => {
	for (const viewport of [
		{ name: 'desktop', width: 1440, height: 1000 },
		{ name: 'mobile', width: 390, height: 844 },
	]) {
		test(`render without horizontal overflow on ${viewport.name}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height })

			for (const route of PUBLIC_ROUTES) {
				await page.goto(route.path, { waitUntil: 'domcontentloaded' })
				await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible({ timeout: 15_000 })
				await expectPageHasSeoMetadata(page)
				await expectNoHorizontalOverflow(page)
			}
		})
	}

	test('template preview stays modal-first and details route can return to public templates', async ({ page }) => {
		await page.goto('/templates', { waitUntil: 'domcontentloaded' })
		await expect(page.getByRole('heading', { name: /start with the right structure/i })).toBeVisible({ timeout: 15_000 })

		await page.getByRole('button', { name: /rsvp/i }).first().click()
		const dialog = page.getByRole('dialog')
		await expect(dialog).toBeVisible()
		await expect(dialog.getByRole('heading', { name: /^rsvp$/i })).toBeVisible()

		const box = await dialog.boundingBox()
		const viewport = page.viewportSize()
		expect(box).not.toBeNull()
		expect(viewport).not.toBeNull()
		if (box && viewport) {
			const modalCenter = box.x + box.width / 2
			expect(Math.abs(modalCenter - viewport.width / 2)).toBeLessThan(8)
		}

		await dialog.getByRole('button', { name: /view full details/i }).click()
		await expect(page).toHaveURL(/\/templates\/rsvp$/)
		await expect(page.getByRole('heading', { name: /^rsvp$/i })).toBeVisible()

		await page.getByRole('button', { name: /back to templates/i }).click()
		await expect(page).toHaveURL(/\/templates$/)
	})
})

async function mockAnonymousAuth(page: Page) {
	await page.route('**/auth/**', async route => {
		await route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'Not authenticated' }),
		})
	})
	await page.route('**/api/auth/**', async route => {
		await route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'Not authenticated' }),
		})
	})
}

async function expectPageHasSeoMetadata(page: Page) {
	await expect.poll(() => page.title(), { timeout: 5_000 }).not.toBe('')
	const description = await page.locator('meta[name="description"]').getAttribute('content')
	expect(description?.trim().length || 0).toBeGreaterThan(20)
}

async function expectNoHorizontalOverflow(page: Page) {
	const metrics = await page.evaluate(() => ({
		viewportWidth: document.documentElement.clientWidth,
		documentWidth: document.documentElement.scrollWidth,
		bodyWidth: document.body.scrollWidth,
	}))

	expect(metrics.documentWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.viewportWidth + 1)
	expect(metrics.bodyWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.viewportWidth + 1)
}
