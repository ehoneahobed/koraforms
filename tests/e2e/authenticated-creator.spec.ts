import { expect, test } from '@playwright/test'

test.describe('authenticated creator workflow', () => {
	test('signs up, creates from a private template, publishes, and keeps owner tabs addressable', async ({ page }) => {
		await signUpOwner(page, 'creator')

		await page.goto('/dashboard/templates', { waitUntil: 'domcontentloaded' })
		await expect(page.getByRole('heading', { name: /start with structure/i })).toBeVisible()
		await expect(page.getByText(/1-9 of \d+ templates/i)).toBeVisible()

		const rsvpCard = page.locator('article').filter({
			has: page.getByRole('heading', { name: /^rsvp$/i }),
		}).first()
		await expect(rsvpCard).toBeVisible()
		await rsvpCard.getByRole('button', { name: /^start$/i }).click()

		await expect(page).toHaveURL(/\/forms\/[^/]+\/edit$/, { timeout: 20_000 })
		await expect(page.getByRole('heading', { name: /^rsvp$/i }).first()).toBeVisible()
		await expect.poll(() => inputValues(page), { timeout: 10_000 }).toEqual(
			expect.arrayContaining(['Your Name', 'Email']),
		)

		await page.getByRole('button', { name: /^publish$/i }).click()
		await expect(page.getByRole('button', { name: /published|publish changes/i })).toBeVisible({ timeout: 10_000 })
		await closeShareModalIfOpen(page)

		await formTabs(page).getByRole('button', { name: /^url$/i }).click()
		await expect(page).toHaveURL(/[?&]panel=url/)
		await expect(page.getByRole('heading', { name: /public url/i })).toBeVisible()
		await page.reload({ waitUntil: 'domcontentloaded' })
		await expect(page).toHaveURL(/[?&]panel=url/)
		await expect(page.getByRole('heading', { name: /public url/i })).toBeVisible()

		await formTabs(page).getByRole('button', { name: /^share$/i }).click()
		await expect(page).toHaveURL(/[?&]panel=share/)
		await expect(page.getByRole('heading', { name: /^share$/i })).toBeVisible()
		await expect(page.getByText(/public form link/i)).toBeVisible()
		await expect(page.getByText(/^embed$/i)).toBeVisible()

		await formTabs(page).getByRole('button', { name: /^settings$/i }).click()
		await expect(page).toHaveURL(/[?&]panel=settings/)
		await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible()
		await expect(page.getByText(/readiness/i).first()).toBeVisible()
		await expect(page.getByText(/no webhook is configured\. this does not affect readiness/i)).toBeVisible()
		await expect(page.getByText(/prepared for launch, but turned off until resend is configured/i)).toBeVisible()
		await page.getByRole('button', { name: /^add webhook$/i }).click()
		await expect(page.getByPlaceholder(/https:\/\/hooks\.example\.com\/koraforms/i)).toBeVisible()
		await expect(page.getByRole('button', { name: /^test$/i })).toBeVisible()

		await formTabs(page).getByRole('button', { name: /^responses$/i }).click()
		await expect(page).toHaveURL(/\/responses$/)
		await expect(page.getByRole('heading', { name: /^responses$/i })).toBeVisible()
		await expect(page.getByText(/review, organise and understand every submission/i)).toBeVisible()
	})

	test('backs up and restores workspace forms as draft copies', async ({ page }) => {
		await signUpOwner(page, 'backup')

		await page.goto('/forms/new/edit?template=contact-form', { waitUntil: 'domcontentloaded' })
		await expect(page).toHaveURL(/\/forms\/[^/]+\/edit$/, { timeout: 20_000 })
		await expect(page.getByRole('heading', { name: /contact form/i }).first()).toBeVisible()

		await page.getByRole('button', { name: /back to forms/i }).click()
		await expect(page).toHaveURL(/\/dashboard$/)
		await expect(page.getByRole('heading', { name: /^forms$/i })).toBeVisible()
		await expect(page.getByRole('heading', { name: /contact form/i }).first()).toBeVisible()

		const downloadPromise = page.waitForEvent('download')
		await page.getByRole('button', { name: /^backup$/i }).click()
		const download = await downloadPromise
		const backupPath = await download.path()
		expect(backupPath).toBeTruthy()

		const fileChooserPromise = page.waitForEvent('filechooser')
		await page.getByRole('button', { name: /^restore$/i }).click()
		const fileChooser = await fileChooserPromise
		await fileChooser.setFiles(backupPath!)

		await expect(page.getByText(/restored 1 form and 0 responses as draft copies/i)).toBeVisible({ timeout: 15_000 })
		await expect(page.getByRole('heading', { name: /contact form \(restored\)/i })).toBeVisible()
	})
})

async function signUpOwner(page: import('@playwright/test').Page, prefix: string) {
	const unique = `${Date.now()}-${test.info().workerIndex}-${Math.random().toString(36).slice(2)}`
	const email = `${prefix}-${unique}@example.test`
	const password = 'Passw0rd!e2e'

	await page.goto('/signup', { waitUntil: 'domcontentloaded' })
	await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible()

	await page.getByLabel(/name/i).fill('Release Candidate Owner')
	await page.getByLabel(/^email$/i).fill(email)
	await page.getByLabel(/^password$/i).fill(password)
	await page.getByLabel(/confirm password/i).fill(password)
	await page.getByRole('button', { name: /create account/i }).click()

	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 })
	await expect(page.getByRole('heading', { name: /^forms$/i })).toBeVisible()
}

async function closeShareModalIfOpen(page: import('@playwright/test').Page) {
	const modal = page.getByText(/share "rsvp"/i)
	if (await modal.isVisible().catch(() => false)) {
		await page.getByRole('button', { name: /close share dialog/i }).click()
	}
}

async function inputValues(page: import('@playwright/test').Page) {
	return page.locator('input').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))
}

function formTabs(page: import('@playwright/test').Page) {
	return page.getByRole('navigation').filter({
		has: page.getByRole('button', { name: /^build$/i }),
	})
}
