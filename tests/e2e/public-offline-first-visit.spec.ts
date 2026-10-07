import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { createApp } from 'korajs'
import schema from '../../src/schema'

// A respondent's first visit, in a fresh (Incognito-like) context, with no
// reload under the service worker. The local database has to download
// sqlite3.wasm and its worker before it can open; a respondent who goes offline
// before that finishes must still be able to submit, and the response must
// reach the creator once the connection returns.

const WASM = /\/assets\/sqlite3[^/]*\.wasm$/

interface CreatorSession {
	user: { id: string }
	tokens: { accessToken: string }
}

let session: Promise<CreatorSession> | undefined

interface SeededForm {
	slug: string
	formId: string
	owner: ReturnType<typeof createApp<typeof schema>>
}

async function seedPublishedForm(
	page: Page,
	baseURL: string | undefined,
	testInfo: TestInfo,
	fields: Array<Record<string, unknown>>,
): Promise<SeededForm> {
	const origin = new URL(baseURL ?? 'http://127.0.0.1:4175')
	const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
	const slug = `first-visit-${unique}`
	// One creator account for the file: signups are rate limited per server.
	session ??= (async () => {
		const signup = await page.request.post('/auth/signup', {
			data: { email: `first-visit-${unique}@example.test`, password: 'Passw0rd!e2e', name: 'First Visit Owner' },
		})
		expect(signup.ok(), await signup.text()).toBe(true)
		return ((await signup.json()) as { data: CreatorSession }).data
	})()
	const creator = await session
	const owner = createApp({
		schema,
		store: { adapter: 'better-sqlite3', name: testInfo.outputPath('owner') },
		sync: {
			url: `ws://${origin.host}/kora-sync`,
			auth: async () => ({ token: creator.tokens.accessToken }),
			autoConnect: false,
		},
	})
	await owner.ready
	await owner.sync?.connect()
	const form = await owner.forms.insert({
		title: 'Member Registration',
		ownerId: creator.user.id,
		slug,
		fields,
		settings: { allowMultiple: true },
	})
	await owner.forms.update(form.id, { status: 'published' })
	await expect.poll(async () => (await page.request.get(`/api/public/forms/${slug}`)).status(), { timeout: 20_000 }).toBe(200)
	return { slug, formId: form.id, owner }
}

async function ownerResponses(seeded: SeededForm): Promise<Array<Record<string, unknown>>> {
	const responses = await seeded.owner.responses.where({ formId: seeded.formId }).exec()
	return responses.map((response) => {
		const data = response.data as unknown
		return (typeof data === 'string' ? JSON.parse(data) : data) as Record<string, unknown>
	})
}

/** Holds back sqlite3.wasm, like a slow mobile connection on a first visit. */
async function delayDatabaseDownload(context: BrowserContext, delayMs: number): Promise<void> {
	await context.route(WASM, async (route) => {
		await new Promise(resolve => setTimeout(resolve, delayMs))
		await route.continue().catch(() => undefined)
	})
}

async function answerText(page: Page, question: RegExp, value: string, submit = false): Promise<void> {
	await expect(page.getByRole('heading', { name: question })).toBeVisible()
	await page.getByRole('textbox').fill(value)
	await page.getByRole('button', { name: submit ? /submit/i : /ok/i }).click()
}

test('a first visit that goes offline right after the first render still submits, and the response reaches the creator', async ({ page, context, baseURL }, testInfo) => {
	test.setTimeout(90_000)
	const seeded = await seedPublishedForm(page, baseURL, testInfo, [
		{ id: 'f_name', type: 'text', label: 'Your name', required: true },
		{ id: 'f_email', type: 'email', label: 'Email address', required: true },
	])
	try {
		await delayDatabaseDownload(context, 4_000)
		await page.goto(`/f/${seeded.slug}`)
		await expect(page.getByRole('heading', { name: 'Member Registration' })).toBeVisible({ timeout: 15_000 })
		await context.setOffline(true)
		// The database files have not arrived, so the page must not claim offline readiness.
		await expect(page.getByText('Available offline')).toHaveCount(0)

		await page.getByRole('button', { name: /start/i }).click()
		await answerText(page, /your name/i, 'Ada First Visit')
		const submittedAt = Date.now()
		await answerText(page, /email address/i, 'ada.first@example.com', true)
		await expect(page.getByRole('heading', { name: 'Saved on this device' })).toBeVisible({ timeout: 15_000 })
		expect(Date.now() - submittedAt).toBeLessThan(15_000)

		const posted = page.waitForResponse(response => response.url().endsWith('/api/public/responses'), { timeout: 30_000 })
		await context.setOffline(false)
		expect((await posted).status()).toBe(201)
		await expect.poll(async () => (await ownerResponses(seeded)).length, { timeout: 20_000 }).toBe(1)
		expect((await ownerResponses(seeded))[0]).toMatchObject({ f_name: 'Ada First Visit', f_email: 'ada.first@example.com' })
	} finally {
		await seeded.owner.close()
	}
})

test('a first visit that goes offline right after the first render still submits an attachment', async ({ page, context, baseURL }, testInfo) => {
	test.setTimeout(90_000)
	const seeded = await seedPublishedForm(page, baseURL, testInfo, [
		{ id: 'f_name', type: 'text', label: 'Your name', required: true },
		{ id: 'f_file', type: 'file', label: 'Membership card', required: true, accept: 'text/plain', maxSize: 1 },
	])
	try {
		await delayDatabaseDownload(context, 4_000)
		await page.goto(`/f/${seeded.slug}`)
		await expect(page.getByRole('heading', { name: 'Member Registration' })).toBeVisible({ timeout: 15_000 })
		await context.setOffline(true)

		await page.getByRole('button', { name: /start/i }).click()
		await answerText(page, /your name/i, 'Ada Attachment')
		await expect(page.getByRole('heading', { name: /membership card/i })).toBeVisible()
		await page.locator('input[type="file"]').setInputFiles({
			name: 'card.txt',
			mimeType: 'text/plain',
			buffer: Buffer.from('member card offline'),
		})
		await expect(page.getByText(/card\.txt saved locally/i)).toBeVisible()
		await page.getByRole('button', { name: /submit/i }).click()
		await expect(page.getByRole('heading', { name: 'Saved on this device' })).toBeVisible({ timeout: 15_000 })

		const posted = page.waitForResponse(response => response.url().endsWith('/api/public/responses'), { timeout: 30_000 })
		await context.setOffline(false)
		const response = await posted
		expect(response.status()).toBe(201)
		const sent = JSON.parse(String((response.request().postDataJSON() as { data: string }).data)) as Record<string, string>
		expect(sent.f_file).toContain('data:text/plain;base64,')
		expect(Buffer.from(sent.f_file.split(',')[1] ?? '', 'base64').toString()).toBe('member card offline')
		await expect.poll(async () => (await ownerResponses(seeded)).length, { timeout: 20_000 }).toBe(1)
		expect((await ownerResponses(seeded))[0]).toMatchObject({ f_name: 'Ada Attachment' })
	} finally {
		await seeded.owner.close()
	}
})

test('when the local database cannot open, a completed response survives closing the page and is sent later', async ({ page, context, baseURL }, testInfo) => {
	test.setTimeout(90_000)
	const seeded = await seedPublishedForm(page, baseURL, testInfo, [
		{ id: 'f_name', type: 'text', label: 'Your name', required: true },
		{ id: 'f_email', type: 'email', label: 'Email address', required: true },
	])
	try {
		// sqlite3.wasm never arrives: the database cannot open on this device.
		await context.route(WASM, route => route.abort())
		await page.goto(`/f/${seeded.slug}`)
		await expect(page.getByRole('heading', { name: 'Member Registration' })).toBeVisible({ timeout: 15_000 })
		await page.waitForTimeout(3_000)
		await expect(page.getByText('Available offline')).toHaveCount(0)

		await context.setOffline(true)
		await page.getByRole('button', { name: /start/i }).click()
		await answerText(page, /your name/i, 'Ada Fallback')
		const submittedAt = Date.now()
		await answerText(page, /email address/i, 'ada.fallback@example.com', true)
		await expect(page.getByRole('heading', { name: 'Saved on this device' })).toBeVisible({ timeout: 15_000 })
		expect(Date.now() - submittedAt).toBeLessThan(15_000)
		await page.close()

		// Back online, the next visit sends what the closed page kept.
		await context.setOffline(false)
		const next = await context.newPage()
		const posted = next.waitForResponse(response => response.url().endsWith('/api/public/responses'), { timeout: 30_000 })
		await next.goto(`/f/${seeded.slug}`)
		expect((await posted).status()).toBe(201)
		await expect.poll(async () => (await ownerResponses(seeded)).length, { timeout: 20_000 }).toBe(1)
		expect((await ownerResponses(seeded))[0]).toMatchObject({ f_name: 'Ada Fallback', f_email: 'ada.fallback@example.com' })
	} finally {
		await seeded.owner.close()
	}
})
