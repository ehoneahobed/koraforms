import { expect, test } from '@playwright/test'
import { parseFormSettings } from '../../src/domain/forms'
import { createBlankForm, newAccount, openDevice, signUpThroughUi, type Device } from './creator-helpers'

// Every settings control is set, then cleared, through the real UI. The cleared
// state must hold in the browser after a reload, on a second device that syncs
// through the real server, and in what the server serves publicly.
test('form settings can be set and then cleared, and the clear reaches the server and other devices', async ({ page, request, baseURL }, testInfo) => {
	test.setTimeout(120_000)
	const account = newAccount('settings')
	await signUpThroughUi(page, account)
	const formId = await createBlankForm(page)
	await page.goto(`/forms/${formId}/edit?panel=settings`, { waitUntil: 'domcontentloaded' })
	await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible()

	const opens = page.locator('label').filter({ hasText: /^Opens$/ }).locator('input')
	const closes = page.locator('label').filter({ hasText: /^Closes$/ }).locator('input')
	const limit = page.locator('label').filter({ hasText: /^Response limit$/ }).locator('input')
	const thankYou = page.getByPlaceholder('Thanks. Your response has been received.')
	const redirect = page.getByPlaceholder('https://example.com/thank-you')
	const allowMultiple = page.locator('label').filter({ hasText: 'Allow multiple submissions' }).locator('input')
	const publicResults = page.locator('label').filter({ hasText: /^Public results$/ }).locator('input')

	// Set
	await page.getByRole('button', { name: /^live$/i }).click()
	await opens.fill('2026-01-01T09:00')
	await closes.fill('2099-12-31T17:00')
	await limit.fill('5')
	await thankYou.fill('Thanks, see you soon')
	await redirect.fill('https://example.com/done')
	await allowMultiple.click()
	await expect(allowMultiple).not.toBeChecked()
	await publicResults.click()
	await expect(publicResults).toBeChecked()
	await page.getByRole('button', { name: /add webhook/i }).click()
	await page.getByPlaceholder('https://hooks.example.com/koraforms').fill('https://hooks.example.com/a')
	const headers = page.locator('label').filter({ hasText: 'Headers JSON' }).locator('textarea')
	await headers.fill('{"x-team":"field"}')
	await headers.blur()

	const device = await openDevice(request, baseURL, account, testInfo.outputPath('device-b'))
	try {
		await expect.poll(async () => readSettings(device, formId), { timeout: 20_000 }).toMatchObject({
			maxResponses: 5,
			thankYouMessage: 'Thanks, see you soon',
			redirectUrl: 'https://example.com/done',
			allowMultiple: false,
			publicResults: true,
			webhooks: [{ url: 'https://hooks.example.com/a', headers: { 'x-team': 'field' } }],
		})
		const set = await readSettings(device, formId)
		expect(typeof set.opensAt).toBe('number')
		expect(typeof set.closesAt).toBe('number')

		// Clear
		await opens.fill('')
		await closes.fill('')
		await limit.fill('0')
		await thankYou.fill('')
		await redirect.fill('')
		await allowMultiple.click()
		await expect(allowMultiple).toBeChecked()
		await publicResults.click()
		await expect(publicResults).not.toBeChecked()
		await headers.fill('{}')
		await headers.blur()
		// Clearing a nested value (the webhook's headers) keeps the rest of the webhook.
		await expect.poll(async () => (await readSettings(device, formId)).webhooks, { timeout: 20_000 })
			.toEqual([{ url: 'https://hooks.example.com/a', method: 'POST', active: true }])
		await page.getByRole('button', { name: /remove webhook/i }).click()

		const cleared = (settings: Record<string, unknown>) => ({
			opensAt: settings.opensAt ?? null,
			closesAt: settings.closesAt ?? null,
			maxResponses: settings.maxResponses ?? null,
			thankYouMessage: settings.thankYouMessage || '',
			redirectUrl: settings.redirectUrl || '',
			allowMultiple: settings.allowMultiple !== false,
			publicResults: settings.publicResults === true,
			webhooks: settings.webhooks ?? null,
		})
		const expected = {
			opensAt: null,
			closesAt: null,
			maxResponses: null,
			thankYouMessage: '',
			redirectUrl: '',
			allowMultiple: true,
			publicResults: false,
			webhooks: null,
		}
		await expect.poll(async () => cleared(await readSettings(device, formId)), { timeout: 20_000 }).toEqual(expected)

		// What the server serves (it applies the limit and the schedule).
		await expect.poll(async () => {
			const response = await request.get(`/api/public/forms/${formId}`)
			return cleared(parseFormSettings(((await response.json()) as { settings?: unknown }).settings))
		}, { timeout: 20_000 }).toEqual(expected)

		// The browser itself after a reload.
		await page.reload({ waitUntil: 'domcontentloaded' })
		await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible()
		await expect(opens).toHaveValue('')
		await expect(closes).toHaveValue('')
		await expect(limit).toHaveValue('0')
		await expect(thankYou).toHaveValue('')
		await expect(redirect).toHaveValue('')
		await expect(allowMultiple).toBeChecked()
		await expect(publicResults).not.toBeChecked()
		await expect(page.getByText(/no webhook is configured/i)).toBeVisible()
	} finally {
		await device.close()
	}
})

async function readSettings(device: Device, formId: string): Promise<Record<string, unknown>> {
	const form = await device.forms.findById(formId)
	return parseFormSettings(form?.settings) as Record<string, unknown>
}
