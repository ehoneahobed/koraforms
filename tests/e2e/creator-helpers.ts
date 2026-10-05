import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { createApp } from 'korajs'
import schema from '../../src/schema'

export interface Account {
	email: string
	password: string
	name: string
}

export function newAccount(prefix: string): Account {
	const unique = `${Date.now()}-${test.info().workerIndex}-${Math.random().toString(36).slice(2, 8)}`
	return { email: `${prefix}-${unique}@example.test`, password: 'Passw0rd!e2e', name: `${prefix} owner` }
}

/** Signs up through the real UI and lands on the dashboard. */
export async function signUpThroughUi(page: Page, account: Account): Promise<void> {
	await page.goto('/signup', { waitUntil: 'domcontentloaded' })
	await page.getByLabel(/name/i).fill(account.name)
	await page.getByLabel(/^email$/i).fill(account.email)
	await page.getByLabel(/^password$/i).fill(account.password)
	await page.getByLabel(/confirm password/i).fill(account.password)
	await page.getByRole('button', { name: /create account/i }).click()
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 })
	await expect(page.getByRole('heading', { name: /^forms$/i })).toBeVisible()
}

/** Creates a blank form through the builder route and returns its id. */
export async function createBlankForm(page: Page): Promise<string> {
	await page.goto('/forms/new/edit', { waitUntil: 'domcontentloaded' })
	await expect(page).toHaveURL(/\/forms\/(?!new\/)[^/]+\/edit/, { timeout: 20_000 })
	const match = /\/forms\/([^/?]+)\/edit/.exec(page.url())
	if (!match?.[1] || match[1] === 'new') throw new Error(`no form id in ${page.url()}`)
	return match[1]
}

export type Device = ReturnType<typeof createApp>

/**
 * A second device for the same account: a node Kora client with its own local
 * database, synced through the real server. Reads what other devices see.
 */
export async function openDevice(
	request: APIRequestContext,
	baseURL: string | undefined,
	account: Account,
	dbPath: string,
): Promise<Device> {
	const signin = await request.post('/auth/signin', { data: { email: account.email, password: account.password } })
	expect(signin.ok(), await signin.text()).toBe(true)
	const token = ((await signin.json()) as { data: { tokens: { accessToken: string } } }).data.tokens.accessToken
	const origin = new URL(baseURL ?? 'http://127.0.0.1:4175')
	const device = createApp({
		schema,
		store: { adapter: 'better-sqlite3', name: dbPath },
		sync: { url: `ws://${origin.host}/kora-sync`, auth: async () => ({ token }), autoConnect: false },
	})
	await device.ready
	await device.sync?.connect()
	return device
}
