import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { parseFormFields, parseFormSettings } from '../../src/domain/forms'
import { createBlankForm, newAccount, openDevice, signUpThroughUi, type Device } from './creator-helpers'

// End-to-end creator and respondent flows against the real beta.13 server.
// A node "device" signed in as the same creator writes the question list
// (so the browser also proves it applies remote json writes) and reads back
// what the server accepted.

const QUESTIONS = [
	{ id: 'q_name', type: 'text' as const, label: 'Your name', required: true },
	{ id: 'q_email', type: 'email' as const, label: 'Email address', required: true },
]

async function setQuestions(device: Device, formId: string): Promise<void> {
	await expect.poll(async () => Boolean(await device.forms.findById(formId)), { timeout: 20_000 }).toBe(true)
	await device.forms.update(formId, { fields: QUESTIONS })
}

async function settingsPanel(page: Page, formId: string): Promise<void> {
	await page.goto(`/forms/${formId}/edit?panel=settings`, { waitUntil: 'domcontentloaded' })
	await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible()
}

async function answerAndSubmit(page: Page, name: string, email: string): Promise<void> {
	await page.getByRole('button', { name: /start/i }).click()
	await expect(page.getByRole('heading', { name: /your name/i })).toBeVisible()
	await page.getByRole('textbox').fill(name)
	await page.getByRole('button', { name: /ok/i }).click()
	await expect(page.getByRole('heading', { name: /email address/i })).toBeVisible()
	await page.getByRole('textbox').fill(email)
	await page.getByRole('button', { name: /submit/i }).click()
}

test('publish, respond, review, export, close and reopen a form', async ({ page, browser, request, baseURL }, testInfo) => {
	test.setTimeout(180_000)
	const account = newAccount('lifecycle')
	await signUpThroughUi(page, account)
	const formId = await createBlankForm(page)
	const device = await openDevice(request, baseURL, account, testInfo.outputPath('device'))
	try {
		await setQuestions(device, formId)
		await settingsPanel(page, formId)
		await page.getByRole('button', { name: /^live$/i }).click()
		await expect.poll(async () => (await device.forms.findById(formId))?.status, { timeout: 20_000 }).toBe('published')
		const slug = String((await device.forms.findById(formId))?.slug || '')
		expect(slug).not.toBe('')

		// Respondent, online, in a separate browser context.
		const respondent = await browser.newContext()
		const fill = await respondent.newPage()
		await fill.goto(`/f/${slug}`)
		await answerAndSubmit(fill, 'Ada Online', 'ada@example.com')
		await expect(fill.getByRole('heading', { name: 'Thank you!' })).toBeVisible({ timeout: 15_000 })

		// Save & continue later creates a real resume link that restores answers.
		const resumePage = await respondent.newPage()
		await resumePage.goto(`/f/${slug}`)
		await resumePage.getByRole('button', { name: /start/i }).click()
		await resumePage.getByRole('textbox').fill('Grace Resumed')
		await resumePage.getByRole('button', { name: /ok/i }).click()
		await expect(resumePage.getByRole('heading', { name: /email address/i })).toBeVisible()
		await resumePage.getByRole('button', { name: /save & continue later/i }).click()
		const resumeUrl = await resumePage.locator('input[readonly]').inputValue()
		expect(resumeUrl).toContain('resume=')
		const resumed = await (await browser.newContext()).newPage()
		await resumed.goto(new URL(resumeUrl).pathname + new URL(resumeUrl).search)
		await expect(resumed.getByRole('heading', { name: /email address/i })).toBeVisible({ timeout: 15_000 })
		await resumed.getByRole('textbox').fill('grace@example.com')
		await resumed.getByRole('button', { name: /submit/i }).click()
		await expect(resumed.getByRole('heading', { name: 'Thank you!' })).toBeVisible({ timeout: 15_000 })

		// The creator sees both responses and can export them.
		await expect.poll(async () => (await device.responses.where({ formId }).exec()).length, { timeout: 20_000 }).toBe(2)
		await page.goto(`/forms/${formId}/responses`, { waitUntil: 'domcontentloaded' })
		await expect(page.getByText('Ada Online').first()).toBeVisible({ timeout: 20_000 })
		await expect(page.getByText('Grace Resumed').first()).toBeVisible()
		await page.getByRole('button', { name: /^export$/i }).first().click()
		const downloadPromise = page.waitForEvent('download')
		await page.getByRole('button', { name: /export 2 responses/i }).click()
		const download = await downloadPromise
		const csv = readFileSync(String(await download.path()), 'utf8')
		expect(csv).toContain('Ada Online')
		expect(csv).toContain('grace@example.com')

		// Public results honour the query string (the limit was ignored before).
		const current = parseFormSettings((await device.forms.findById(formId))?.settings)
		await device.forms.update(formId, { settings: { ...current, publicResults: true } })
		await expect.poll(async () => {
			const results = await request.get(`/api/public/forms/${slug}/results?limit=1`)
			return results.ok() ? ((await results.json()) as { pagination: unknown }).pagination : results.status()
		}, { timeout: 20_000, intervals: [1_000] }).toEqual({ limit: 1, returned: 1, hasMore: true })
		const resultsPage = await respondent.newPage()
		await resultsPage.goto(`/f/${slug}/results`)
		await expect(resultsPage.getByText('2 responses', { exact: true })).toBeVisible({ timeout: 15_000 })
		await expect(resultsPage.getByText(/not available|form not found/i)).toHaveCount(0)

		// Close: the server refuses new responses. Reopen: it accepts them again.
		await settingsPanel(page, formId)
		await page.getByRole('button', { name: /^closed$/i }).click()
		await expect.poll(async () => (await device.forms.findById(formId))?.status, { timeout: 20_000 }).toBe('closed')
		const submitWhile = async () => (await request.post('/api/public/responses', {
			data: { formId: slug, data: JSON.stringify({ q_name: 'Late', q_email: 'late@example.com' }), clientSubmissionId: `late-${Date.now()}-${Math.random()}` },
		})).status()
		// The device saw the status, so the server has it: a closed form is not found publicly.
		expect(await submitWhile()).toBe(404)
		await page.getByRole('button', { name: /^live$/i }).click()
		await expect.poll(async () => (await device.forms.findById(formId))?.status, { timeout: 20_000 }).toBe('published')
		expect(await submitWhile()).toBe(201)
		await respondent.close()
	} finally {
		await device.close()
	}
})

test('duplicate, archive, restore and delete forms from the dashboard', async ({ page, request, baseURL }, testInfo) => {
	test.setTimeout(120_000)
	const account = newAccount('dashboard')
	await signUpThroughUi(page, account)
	const formId = await createBlankForm(page)
	const device = await openDevice(request, baseURL, account, testInfo.outputPath('device'))
	try {
		await setQuestions(device, formId)
		await device.forms.update(formId, { title: 'Site Audit' })
		await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
		const card = (title: string) => page.locator('div.group').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).first()
		const menu = async (title: string, item: RegExp) => {
			await card(title).locator('button').first().click()
			await page.getByRole('button', { name: item }).click()
		}
		await expect(card('Site Audit')).toBeVisible({ timeout: 20_000 })

		await menu('Site Audit', /^duplicate$/i)
		await expect(card('Copy of Site Audit')).toBeVisible({ timeout: 20_000 })
		await expect.poll(async () => {
			const copy = (await device.forms.where({}).exec()).find(form => form.title === 'Copy of Site Audit')
			return copy ? parseFormFields(copy.fields).map(field => field.label) : null
		}, { timeout: 20_000 }).toEqual(['Your name', 'Email address'])

		await menu('Site Audit', /^archive$/i)
		await expect(card('Site Audit')).toBeHidden()
		await page.getByRole('button', { name: /^archived/i }).click()
		await expect(card('Site Audit')).toBeVisible()
		await menu('Site Audit', /^unarchive$/i)
		await page.getByRole('button', { name: /^all$/i }).click()
		await expect(card('Site Audit')).toBeVisible()
		await expect.poll(async () => {
			const settings = (await device.forms.findById(formId))?.settings
			return typeof settings === 'object' && settings !== null && 'archived' in settings
		}, { timeout: 20_000 }).toBe(false)

		await menu('Copy of Site Audit', /^delete$/i)
		await expect(card('Copy of Site Audit')).toBeHidden()
		await expect.poll(async () => (await device.forms.where({}).exec()).some(form => form.title === 'Copy of Site Audit'), { timeout: 20_000 }).toBe(false)
	} finally {
		await device.close()
	}
})

test('invite a collaborator who accepts, then sign out', async ({ page, browser, baseURL }, testInfo) => {
	test.setTimeout(120_000)
	const owner = newAccount('owner')
	const collaborator = newAccount('editor')
	await signUpThroughUi(page, owner)
	const formId = await createBlankForm(page)
	// The invite route checks ownership on the server: wait until the new form has synced.
	const ownerDevice = await openDevice(page.request, baseURL, owner, testInfo.outputPath('owner-device'))
	await expect.poll(async () => Boolean(await ownerDevice.forms.findById(formId)), { timeout: 20_000 }).toBe(true)
	await ownerDevice.close()
	await page.goto(`/forms/${formId}/edit?panel=collaborators`, { waitUntil: 'domcontentloaded' })
	await page.getByPlaceholder('Email address').fill(collaborator.email)
	const invited = page.waitForResponse(response => response.url().endsWith('/api/forms/collaborators/invite'))
	await page.getByRole('button', { name: /invite|send/i }).last().click()
	const invite = await invited
	expect(invite.status(), await invite.text()).toBe(200)
	const { inviteToken } = (await invite.json()) as { inviteToken: string }
	await expect(page.getByText(collaborator.email)).toBeVisible({ timeout: 20_000 })

	const other = await (await browser.newContext()).newPage()
	await signUpThroughUi(other, collaborator)
	await other.goto(`/invite/${inviteToken}`, { waitUntil: 'domcontentloaded' })
	await expect(other.getByRole('heading', { name: /you're in/i })).toBeVisible({ timeout: 20_000 })
	await other.getByRole('button', { name: /open form/i }).click()
	await expect(other).toHaveURL(new RegExp(`/forms/${formId}/edit`))

	// Sign out from the sidebar user menu.
	await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
	await page.getByRole('button', { name: owner.name }).click()
	await page.getByRole('button', { name: /sign out/i }).click()
	await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
	await expect(page).toHaveURL(/\/signin/, { timeout: 20_000 })
})
