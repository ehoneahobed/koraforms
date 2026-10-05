import { expect, test } from '@playwright/test'
import { createApp } from 'korajs'
import schema from '../../src/schema'
import { waitForOfflineRouteCache, waitForServiceWorkerControl } from './offline-helpers'

// 1.2 MB of file bytes become a ~1.6 MB data URL inside the response JSON: the
// POST body is over the 1 MiB createProductionServer default and under the
// app's 2 MiB response limit. Before the server raised maxRequestBodyBytes,
// this offline submission was refused with 413 and marked "needs review".
const ATTACHMENT_BYTES = 1_200_000

test('an offline response with a 1-2 MiB attachment is accepted by the server on reconnect', async ({ page, context, baseURL }, testInfo) => {
	test.setTimeout(120_000)
	const origin = new URL(baseURL ?? 'http://127.0.0.1:4175')
	const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
	const slug = `attachment-${unique}`

	// Seed a published form as a creator through the real auth and sync server.
	const signup = await page.request.post('/auth/signup', {
		data: { email: `attachment-${unique}@example.test`, password: 'Passw0rd!e2e', name: 'Attachment Owner' },
	})
	expect(signup.ok(), await signup.text()).toBe(true)
	const session = (await signup.json()) as { data: { user: { id: string }; tokens: { accessToken: string } } }
	const ownerId = session.data.user.id
	const token = session.data.tokens.accessToken

	const owner = createApp({
		schema,
		store: { adapter: 'better-sqlite3', name: testInfo.outputPath('owner') },
		sync: {
			url: `ws://${origin.host}/kora-sync`,
			auth: async () => ({ token }),
			autoConnect: false,
		},
	})
	try {
		await owner.ready
		await owner.sync?.connect()
		const form = await owner.forms.insert({
			title: 'Attachment Report',
			ownerId,
			slug,
			fields: [
				{ id: 'field_name', type: 'text', label: 'Your name', required: true },
				{ id: 'field_file', type: 'file', label: 'Site photo', required: true, accept: 'text/plain', maxSize: 2 },
			],
			settings: { allowMultiple: true },
		})
		await owner.forms.update(form.id, { status: 'published' })
		await expect.poll(async () => (await page.request.get(`/api/public/forms/${slug}`)).status(), { timeout: 20_000 }).toBe(200)

		await page.goto(`/f/${slug}`)
		await expect(page.getByRole('heading', { name: 'Attachment Report' })).toBeVisible({ timeout: 15_000 })
		await expect(page.getByText('Available offline')).toBeVisible()
		await waitForServiceWorkerControl(page)
		await waitForOfflineRouteCache(page)

		await context.setOffline(true)
		await page.getByRole('button', { name: /start/i }).click()
		await expect(page.getByRole('heading', { name: /your name/i })).toBeVisible()
		await page.getByRole('textbox').fill('Ada Attachment')
		await page.getByRole('button', { name: /ok/i }).click()

		await expect(page.getByRole('heading', { name: /site photo/i })).toBeVisible()
		await page.locator('input[type="file"]').setInputFiles({
			name: 'site-survey.txt',
			mimeType: 'text/plain',
			buffer: Buffer.alloc(ATTACHMENT_BYTES, 'a'),
		})
		await expect(page.getByText(/site-survey\.txt saved locally/i)).toBeVisible()
		await page.getByRole('button', { name: /submit/i }).click()
		await expect(page.getByRole('heading', { name: 'Saved on this device' })).toBeVisible()

		const posted = page.waitForResponse(response => response.url().endsWith('/api/public/responses'), { timeout: 30_000 })
		await context.setOffline(false)
		const response = await posted
		expect(response.status(), await response.text()).toBe(201)
		expect(response.request().postDataBuffer()?.byteLength ?? 0).toBeGreaterThan(1024 * 1024)

		// The creator's device receives the accepted response over sync.
		await expect.poll(async () => {
			const responses = await owner.responses.where({ formId: form.id }).exec()
			return responses.length
		}, { timeout: 20_000 }).toBe(1)
	} finally {
		await owner.close()
	}
})
