import { expect, test } from '@playwright/test'
import { createBlankForm, newAccount, signUpThroughUi } from './creator-helpers'

// A second device is a clean browser profile, not a Node client: it starts with
// no local database and has to download what the account already holds.
test('a clean browser profile signing in downloads the account forms and settles', async ({ browser }) => {
	test.setTimeout(120_000)
	const account = newAccount('fresh')

	const first = await (await browser.newContext()).newPage()
	await signUpThroughUi(first, account)
	await createBlankForm(first)
	await createBlankForm(first)
	await first.goto('/dashboard', { waitUntil: 'domcontentloaded' })
	await expect(first.getByText(/syncing/i)).toHaveCount(0, { timeout: 30_000 })

	const second = await (await browser.newContext()).newPage()
	await second.goto('/signin', { waitUntil: 'domcontentloaded' })
	await second.getByPlaceholder('you@example.com').fill(account.email)
	await second.getByPlaceholder('Enter your password').fill(account.password)
	await second.getByRole('button', { name: /^sign in$/i }).click()
	await expect(second).toHaveURL(/\/dashboard$/, { timeout: 20_000 })

	await expect(second.getByRole('button', { name: /^edit$/i })).toHaveCount(2, { timeout: 30_000 })
	await expect(second.getByText(/syncing/i)).toHaveCount(0, { timeout: 30_000 })

	// Settings explains the download, so a stuck one can be diagnosed from the page.
	await second.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' })
	const panel = second.getByTestId('sync-diagnostics')
	await expect(panel).toBeVisible()
	await expect(panel.getByText('Download complete')).toBeVisible()
	await expect(panel.getByText(/^complete$/)).toBeVisible({ timeout: 15_000 })
	await expect(panel.getByText('2 forms, 0 responses')).toBeVisible()

	// The operation count is on request, and says which collection the log is made of.
	await second.getByRole('button', { name: 'Count operations' }).click()
	await expect(panel.getByText('Operations on this device')).toBeVisible()
	await expect(panel.getByText(/^\s*forms\s*$/)).toBeVisible()
})
