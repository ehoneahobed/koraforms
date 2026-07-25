import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test'

const PUBLIC_FORM_SLUG = 'offline-rsvp'
const PUBLIC_FORM_ID = 'form_e2e_offline_rsvp'
const COMPLEX_FORM_SLUG = 'offline-complex-inspection'
const COMPLEX_FORM_ID = 'form_e2e_offline_complex'
const REJECTED_FORM_SLUG = 'offline-rejected-sync'
const REJECTED_FORM_ID = 'form_e2e_rejected_sync'

const publicForm = {
	id: PUBLIC_FORM_ID,
	slug: PUBLIC_FORM_SLUG,
	title: 'Field Visit Report',
	description: 'Submit reports anywhere, even away from service.',
	fields: [
		{
			id: 'field_name',
			type: 'text',
			label: 'Your name',
			required: true,
		},
		{
			id: 'field_email',
			type: 'email',
			label: 'Email address',
			required: true,
		},
		{
			id: 'field_photo',
			type: 'file',
			label: 'Site photo',
			required: true,
			accept: 'text/plain',
			maxSize: 1,
		},
	],
	settings: {
		allowMultiple: true,
		thankYouMessage: 'Report received.',
	},
	theme: 'red',
	status: 'published',
	createdAt: 1_785_000_000_000,
}

const complexPublicForm = {
	id: COMPLEX_FORM_ID,
	slug: COMPLEX_FORM_SLUG,
	title: 'Offline Inspection',
	description: 'A multi-step form for field teams.',
	fields: [
		{ id: 'intro_section', type: 'section', label: 'Inspection basics', required: false, placeholder: 'Collect the required site details.' },
		{ id: 'inspector', type: 'text', label: 'Inspector name', required: true },
		{ id: 'email', type: 'email', label: 'Inspector email', required: true },
		{ id: 'phone', type: 'phone', label: 'Phone number', required: true },
		{ id: 'guests', type: 'number', label: 'Number of issues', required: true },
		{ id: 'inspection_date', type: 'date', label: 'Inspection date', required: true },
		{ id: 'inspection_time', type: 'time', label: 'Inspection time', required: true },
		{ id: 'site_url', type: 'url', label: 'Site URL', required: true },
		{ id: 'site_type', type: 'select', label: 'Site type', required: true, options: 'Warehouse, Retail, Office' },
		{ id: 'severity', type: 'radio', label: 'Severity', required: true, options: 'Low, Medium, High' },
		{ id: 'follow_up', type: 'yesno', label: 'Need follow up?', required: true },
		{ id: 'follow_note', type: 'textarea', label: 'Follow-up note for {{Inspector name}}', required: true, conditions: [{ fieldId: 'follow_up', operator: 'equals', value: 'yes' }] },
		{ id: 'hidden_region', type: 'hidden', label: 'Region', required: false, defaultValue: 'north' },
		{ id: 'calculated_score', type: 'calculated', label: 'Risk score', required: false, formula: '{Number of issues} * 2' },
		{ id: 'info_statement', type: 'statement', label: 'Final checks', required: false, placeholder: 'Confirm the condition of each area.' },
		{ id: 'areas', type: 'checkbox', label: 'Areas inspected', required: true, options: 'Roof, Storage, Exit' },
		{ id: 'rating', type: 'rating', label: 'Overall rating', required: true },
		{ id: 'confidence', type: 'scale', label: 'Confidence', required: true, options: 'Low,High' },
		{ id: 'priority', type: 'ranking', label: 'Priority order', required: true, options: 'Safety, Cost, Timing' },
		{ id: 'matrix', type: 'matrix', label: 'Area condition', required: true, matrixRows: 'Roof, Storage', matrixColumns: 'Good, Review, Critical' },
		{ id: 'signature', type: 'signature', label: 'Signature', required: true },
		{ id: 'attachment', type: 'file', label: 'Attachment', required: true, accept: 'text/plain', maxSize: 1 },
	],
	settings: { allowMultiple: true },
	theme: 'emerald',
	status: 'published',
	createdAt: 1_785_000_000_001,
}

const rejectedSyncForm = {
	id: REJECTED_FORM_ID,
	slug: REJECTED_FORM_SLUG,
	title: 'Closed Field Report',
	description: 'A form that closes before queued responses sync.',
	fields: [
		{ id: 'field_name', type: 'text', label: 'Your name', required: true },
		{ id: 'field_email', type: 'email', label: 'Email address', required: true },
	],
	settings: { allowMultiple: true },
	theme: 'red',
	status: 'published',
	createdAt: 1_785_000_000_002,
}

test('public respondents can load, complete, queue, and sync a form offline', async ({ page, context }) => {
	const submissions: Array<Record<string, unknown>> = []
	const diagnostics: string[] = []
	let apiOnline = true

	page.on('console', message => {
		if (['error', 'warning'].includes(message.type())) {
			diagnostics.push(`console:${message.type()}: ${message.text()}`)
		}
	})
	page.on('pageerror', error => {
		diagnostics.push(`pageerror: ${error.message}`)
	})
	page.on('requestfailed', request => {
		diagnostics.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`)
	})

	await page.route(`**/api/public/forms/${PUBLIC_FORM_SLUG}`, async route => {
		diagnostics.push(`api:form:${route.request().method()}`)
		if (!apiOnline) {
			await route.abort('internetdisconnected')
			return
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(publicForm),
		})
	})

	await page.route('**/api/public/responses', async route => {
		const payload = route.request().postDataJSON() as Record<string, unknown>
		submissions.push(payload)
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ ok: true }),
		})
	})

	await page.goto(`/f/${PUBLIC_FORM_SLUG}`)
	await expect(page.getByRole('heading', { name: 'Field Visit Report' }), diagnostics.join('\n')).toBeVisible({ timeout: 15_000 })
	await expectVisibleWithPageDiagnostics(page, page.getByText('Available offline'), diagnostics)
	await waitForServiceWorkerControl(page)
	await waitForOfflineRouteCache(page)
	await page.getByRole('button', { name: /prepare/i }).click()
	await expect(page.getByText('Ready offline')).toBeVisible({ timeout: 10_000 })

	apiOnline = false
	await context.setOffline(true)
	await page.reload({ waitUntil: 'domcontentloaded' })

	await expectVisibleWithPageDiagnostics(page, page.getByRole('heading', { name: 'Field Visit Report' }), diagnostics)
	await expect(page.getByText('Loaded from this device')).toBeVisible()

	await page.getByRole('button', { name: /start/i }).click()
	await expect(page.getByRole('heading', { name: /your name/i })).toBeVisible()
	await page.getByRole('textbox').fill('Ada Offline')
	await page.getByRole('button', { name: /ok/i }).click()

	await expect(page.getByRole('heading', { name: /email address/i })).toBeVisible()
	await page.getByRole('textbox').fill('ada@example.com')
	await page.getByRole('button', { name: /ok/i }).click()

	await expect(page.getByRole('heading', { name: /site photo/i })).toBeVisible()
	await page.locator('input[type="file"]').setInputFiles({
		name: 'field-notes.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('offline field note'),
	})
	await expect(page.getByText(/field-notes\.txt saved locally/i)).toBeVisible()
	await page.getByRole('button', { name: /submit/i }).click()

	await expect(page.getByRole('heading', { name: 'Saved on this device' })).toBeVisible()
	await expect(page.getByText(/will sync automatically/i)).toBeVisible()
	expect(submissions).toHaveLength(0)

	apiOnline = true
	await context.setOffline(false)
	await expect.poll(() => submissions.length, { timeout: 15_000 }).toBe(1)

	expect(submissions[0]).toMatchObject({ formId: PUBLIC_FORM_ID })
	const data = JSON.parse(String(submissions[0]?.data || '{}')) as Record<string, unknown>
	expect(data).toMatchObject({
		field_name: 'Ada Offline',
		field_email: 'ada@example.com',
	})
	expect(String(data.field_photo)).toContain('data:text/plain;base64,')
	expect(typeof submissions[0]?.clientSubmissionId).toBe('string')
})

test('public resume links are requested with form slug binding', async ({ page, context }) => {
	const resumeToken = 'resume_token_abcdefghijklmnopqrstuvwxyz123456'
	let requestedSlug = ''

	await context.route(`**/api/public/forms/${PUBLIC_FORM_SLUG}`, async route => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(publicForm),
		})
	})

	await context.route(`**/api/public/partial/${resumeToken}*`, async route => {
		const url = new URL(route.request().url())
		requestedSlug = url.searchParams.get('slug') || ''
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				formId: PUBLIC_FORM_ID,
				slug: PUBLIC_FORM_SLUG,
				data: JSON.stringify({ field_name: 'Ada Resume' }),
				savedAt: Date.now(),
			}),
		})
	})

	await page.goto(`/f/${PUBLIC_FORM_SLUG}?resume=${resumeToken}`)
	await expect(page.getByRole('heading', { name: /email address/i })).toBeVisible({ timeout: 15_000 })
	expect(requestedSlug).toBe(PUBLIC_FORM_SLUG)
})

test('public respondents can complete a form with keyboard only', async ({ page, context }) => {
	const submissions: Array<Record<string, unknown>> = []

	await routeOfflineFormScenario(context, REJECTED_FORM_SLUG, rejectedSyncForm, () => true, submissions)

	await page.goto(`/f/${REJECTED_FORM_SLUG}`)
	await expect(page.getByRole('heading', { name: 'Closed Field Report' })).toBeVisible({ timeout: 15_000 })

	await page.getByRole('button', { name: /start/i }).focus()
	await page.keyboard.press('Enter')

	await typeFocusedTextQuestion(page, /your name/i, 'Keyboard User')
	await typeFocusedTextQuestion(page, /email address/i, 'keyboard@example.com')

	await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible({ timeout: 15_000 })
	await expect.poll(() => submissions.length, { timeout: 15_000 }).toBe(1)

	expect(submissions[0]).toMatchObject({ formId: REJECTED_FORM_ID })
	const data = JSON.parse(String(submissions[0]?.data || '{}')) as Record<string, unknown>
	expect(data).toMatchObject({
		field_name: 'Keyboard User',
		field_email: 'keyboard@example.com',
	})
})

test('offline submissions move to needs review when server later rejects sync', async ({ page, context }) => {
	let apiOnline = true
	let submissionAttempts = 0

	await page.route(`**/api/public/forms/${REJECTED_FORM_SLUG}`, async route => {
		if (!apiOnline) {
			await route.abort('internetdisconnected')
			return
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(rejectedSyncForm),
		})
	})

	await page.route('**/api/public/responses', async route => {
		submissionAttempts += 1
		await route.fulfill({
			status: 409,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'This form is no longer accepting responses.' }),
		})
	})

	await page.goto(`/f/${REJECTED_FORM_SLUG}`)
	await expect(page.getByRole('heading', { name: 'Closed Field Report' })).toBeVisible({ timeout: 15_000 })
	await expect(page.getByText('Available offline')).toBeVisible({ timeout: 15_000 })
	await waitForServiceWorkerControl(page)
	await waitForOfflineRouteCache(page)

	apiOnline = false
	await context.setOffline(true)
	await page.reload({ waitUntil: 'domcontentloaded' })
	await expect(page.getByText('Loaded from this device')).toBeVisible()

	await page.getByRole('button', { name: /start/i }).click()
	await fillTextQuestion(page, /your name/i, 'Ada Rejected')
	await expect(page.getByRole('heading', { name: /email address/i })).toBeVisible()
	await page.locator('input:not([type="file"]), textarea').first().fill('ada.rejected@example.com')
	await page.getByRole('button', { name: /submit/i }).click()

	await expect(page.getByRole('heading', { name: 'Saved on this device' })).toBeVisible()
	await expect(page.getByText(/will sync automatically/i)).toBeVisible()
	expect(submissionAttempts).toBe(0)

	apiOnline = true
	await context.setOffline(false)
	await expect.poll(() => submissionAttempts, { timeout: 15_000 }).toBe(1)
	await expect(page.getByText(/1 response needs review/i)).toBeVisible({ timeout: 15_000 })
})

test('offline queued submissions survive tab close before reconnect', async ({ page, context }) => {
	const submissions: Array<Record<string, unknown>> = []
	let apiOnline = true

	await context.route(`**/api/public/forms/${REJECTED_FORM_SLUG}`, async route => {
		if (!apiOnline) {
			await route.abort('internetdisconnected')
			return
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(rejectedSyncForm),
		})
	})

	await context.route('**/api/public/responses', async route => {
		const payload = route.request().postDataJSON() as Record<string, unknown>
		submissions.push(payload)
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ ok: true }),
		})
	})

	await page.goto(`/f/${REJECTED_FORM_SLUG}`)
	await expect(page.getByRole('heading', { name: 'Closed Field Report' })).toBeVisible({ timeout: 15_000 })
	await expect(page.getByText('Available offline')).toBeVisible({ timeout: 15_000 })
	await waitForServiceWorkerControl(page)
	await waitForOfflineRouteCache(page)

	apiOnline = false
	await context.setOffline(true)
	await page.getByRole('button', { name: /start/i }).click()
	await fillTextQuestion(page, /your name/i, 'Grace Hopper')
	await expect(page.getByRole('heading', { name: /email address/i })).toBeVisible()
	await page.locator('input:not([type="file"]), textarea').first().fill('grace@example.com')
	await page.getByRole('button', { name: /submit/i }).click()
	await expect(page.getByRole('heading', { name: 'Saved on this device' })).toBeVisible()
	expect(submissions).toHaveLength(0)
	await page.close()

	const reopened = await context.newPage()
	await reopened.goto(`/f/${REJECTED_FORM_SLUG}`, { waitUntil: 'domcontentloaded' })
	await expect(reopened.getByRole('heading', { name: 'Closed Field Report' })).toBeVisible({ timeout: 15_000 })
	await expect(reopened.getByText('Loaded from this device')).toBeVisible()
	await expect(reopened.getByText('1 response waiting to sync', { exact: true })).toBeVisible()

	apiOnline = true
	await context.setOffline(false)
	await expect.poll(() => submissions.length, { timeout: 15_000 }).toBe(1)
})

test('offline queued submissions survive browser profile restart before reconnect', async ({}, testInfo) => {
	const userDataDir = testInfo.outputPath('offline-profile')
	const submissions: Array<Record<string, unknown>> = []
	let apiOnline = true

	let context = await chromium.launchPersistentContext(userDataDir, {
		baseURL: 'http://127.0.0.1:4175',
	})
	await routeOfflineFormScenario(context, REJECTED_FORM_SLUG, rejectedSyncForm, () => apiOnline, submissions)
	let page = await context.newPage()

	await page.goto(`/f/${REJECTED_FORM_SLUG}`)
	await expect(page.getByRole('heading', { name: 'Closed Field Report' })).toBeVisible({ timeout: 15_000 })
	await expect(page.getByText('Available offline')).toBeVisible({ timeout: 15_000 })
	await waitForServiceWorkerControl(page)
	await waitForOfflineRouteCache(page)

	apiOnline = false
	await context.setOffline(true)
	await page.getByRole('button', { name: /start/i }).click()
	await fillTextQuestion(page, /your name/i, 'Restart Durable')
	await expect(page.getByRole('heading', { name: /email address/i })).toBeVisible()
	await page.locator('input:not([type="file"]), textarea').first().fill('restart@example.com')
	await page.getByRole('button', { name: /submit/i }).click()
	await expect(page.getByRole('heading', { name: 'Saved on this device' })).toBeVisible()
	expect(submissions).toHaveLength(0)
	await context.close()

	context = await chromium.launchPersistentContext(userDataDir, {
		baseURL: 'http://127.0.0.1:4175',
	})
	await routeOfflineFormScenario(context, REJECTED_FORM_SLUG, rejectedSyncForm, () => apiOnline, submissions)
	await context.setOffline(true)
	page = await context.newPage()
	await page.goto(`/f/${REJECTED_FORM_SLUG}`, { waitUntil: 'domcontentloaded' })
	await expect(page.getByRole('heading', { name: 'Closed Field Report' })).toBeVisible({ timeout: 15_000 })
	await expect(page.getByText('Loaded from this device')).toBeVisible()
	await expect(page.getByText('1 response waiting to sync', { exact: true })).toBeVisible()

	apiOnline = true
	await context.setOffline(false)
	await expect.poll(() => submissions.length, { timeout: 15_000 }).toBe(1)
	await context.close()
})

test('offline queued submissions are visible in another tab on the same device', async ({ page, context }) => {
	const submissions: Array<Record<string, unknown>> = []
	let apiOnline = true

	await routeOfflineFormScenario(context, REJECTED_FORM_SLUG, rejectedSyncForm, () => apiOnline, submissions)

	await page.goto(`/f/${REJECTED_FORM_SLUG}`)
	await expect(page.getByRole('heading', { name: 'Closed Field Report' })).toBeVisible({ timeout: 15_000 })
	await expect(page.getByText('Available offline')).toBeVisible({ timeout: 15_000 })
	await waitForServiceWorkerControl(page)
	await waitForOfflineRouteCache(page)

	apiOnline = false
	await context.setOffline(true)
	await page.getByRole('button', { name: /start/i }).click()
	await fillTextQuestion(page, /your name/i, 'Second Tab')
	await expect(page.getByRole('heading', { name: /email address/i })).toBeVisible()
	await page.locator('input:not([type="file"]), textarea').first().fill('second.tab@example.com')
	await page.getByRole('button', { name: /submit/i }).click()
	await expect(page.getByRole('heading', { name: 'Saved on this device' })).toBeVisible()
	expect(submissions).toHaveLength(0)

	const secondTab = await context.newPage()
	await secondTab.goto(`/f/${REJECTED_FORM_SLUG}`, { waitUntil: 'domcontentloaded' })
	try {
		await expect(secondTab.getByRole('heading', { name: 'Closed Field Report' })).toBeVisible({ timeout: 15_000 })
	} catch (error) {
		const bodyText = await secondTab.locator('body').innerText({ timeout: 1_000 }).catch(() => '')
		throw new Error([
			error instanceof Error ? error.message : String(error),
			`body: ${bodyText.slice(0, 1000)}`,
		].join('\n\n'))
	}
	await expect(secondTab.getByText('Loaded from this device')).toBeVisible()
	await expect(secondTab.getByText('1 response waiting to sync', { exact: true })).toBeVisible()

	apiOnline = true
	await context.setOffline(false)
	await expect.poll(() => submissions.length, { timeout: 15_000 }).toBe(1)
})

test('public respondents can complete complex field types offline', async ({ page, context }) => {
	test.setTimeout(60_000)

	const submissions: Array<Record<string, unknown>> = []
	let apiOnline = true

	await page.route(`**/api/public/forms/${COMPLEX_FORM_SLUG}`, async route => {
		if (!apiOnline) {
			await route.abort('internetdisconnected')
			return
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(complexPublicForm),
		})
	})

	await page.route('**/api/public/responses', async route => {
		const payload = route.request().postDataJSON() as Record<string, unknown>
		submissions.push(payload)
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ ok: true }),
		})
	})

	await page.goto(`/f/${COMPLEX_FORM_SLUG}`)
	await expect(page.getByRole('heading', { name: 'Offline Inspection' })).toBeVisible({ timeout: 15_000 })
	await expect(page.getByText('Available offline')).toBeVisible({ timeout: 15_000 })
	await waitForServiceWorkerControl(page)
	await waitForOfflineRouteCache(page)

	apiOnline = false
	await context.setOffline(true)
	await page.reload({ waitUntil: 'domcontentloaded' })
	await expect(page.getByText('Loaded from this device')).toBeVisible()

	await page.getByRole('button', { name: /start/i }).click()
	await expect(page.getByRole('heading', { name: 'Inspection basics' })).toBeVisible()
	await page.getByRole('button', { name: /continue/i }).click()

	await fillTextQuestion(page, /inspector name/i, 'Ada Field')
	await fillTextQuestion(page, /inspector email/i, 'ada.field@example.com')
	await fillTextQuestion(page, /phone number/i, '+233 555 000 111')
	await fillTextQuestion(page, /number of issues/i, '4')
	await fillTextQuestion(page, /inspection date/i, '2026-07-21')
	await fillTextQuestion(page, /inspection time/i, '14:30')
	await fillTextQuestion(page, /site url/i, 'https://example.com/site')

	await chooseOptionQuestion(page, /site type/i, 'Warehouse')
	await chooseOptionQuestion(page, /severity/i, 'High')
	await chooseOptionQuestion(page, /need follow up\?/i, 'Yes')
	await fillTextQuestion(page, /follow-up note for ada field/i, 'Bring replacement locks.')

	await expect(page.getByRole('heading', { name: /risk score/i })).toBeVisible()
	await expect(page.getByText('8')).toBeVisible()
	await page.getByRole('button', { name: /ok/i }).click()

	await expect(page.getByRole('heading', { name: 'Final checks' })).toBeVisible()
	await page.getByRole('button', { name: /continue/i }).click()

	await expect(page.getByRole('heading', { name: /areas inspected/i })).toBeVisible()
	await page.getByRole('button', { name: 'Roof' }).click()
	await page.getByRole('button', { name: 'Storage' }).click()
	await page.getByRole('button', { name: /ok/i }).click()

	await expect(page.getByRole('heading', { name: /overall rating/i })).toBeVisible()
	await page.getByRole('button', { name: '4 stars' }).click()
	await page.getByRole('button', { name: /ok/i }).click()

	await expect(page.getByRole('heading', { name: /confidence/i })).toBeVisible()
	await page.getByRole('button', { name: '8' }).click()
	await page.getByRole('button', { name: /ok/i }).click()

	await expect(page.getByRole('heading', { name: /priority order/i })).toBeVisible()
	await page.getByRole('button', { name: /ok/i }).click()

	await expect(page.getByRole('heading', { name: /area condition/i })).toBeVisible()
	await page.locator('tr', { hasText: 'Roof' }).getByRole('button').nth(1).click()
	await page.locator('tr', { hasText: 'Storage' }).getByRole('button').nth(2).click()
	await page.getByRole('button', { name: /ok/i }).click()

	await expect(page.getByRole('heading', { name: /signature/i })).toBeVisible()
	const canvas = page.locator('canvas')
	const box = await canvas.boundingBox()
	expect(box).not.toBeNull()
	await page.mouse.move(box!.x + 20, box!.y + 20)
	await page.mouse.down()
	await page.mouse.move(box!.x + 120, box!.y + 80)
	await page.mouse.up()
	await expect(page.getByRole('button', { name: /clear/i })).toBeVisible()
	await page.getByRole('button', { name: /ok/i }).click()

	await expect(page.getByRole('heading', { name: /attachment/i })).toBeVisible()
	await page.locator('input[type="file"]').setInputFiles({
		name: 'inspection-note.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('complex offline note'),
	})
	await expect(page.getByText(/inspection-note\.txt saved locally/i)).toBeVisible()
	await page.getByRole('button', { name: /submit/i }).click()

	await expect(page.getByRole('heading', { name: 'Saved on this device' })).toBeVisible()
	expect(submissions).toHaveLength(0)

	apiOnline = true
	await context.setOffline(false)
	await expect.poll(() => submissions.length, { timeout: 15_000 }).toBe(1)

	const data = JSON.parse(String(submissions[0]?.data || '{}')) as Record<string, unknown>
	expect(data).toMatchObject({
		inspector: 'Ada Field',
		email: 'ada.field@example.com',
		phone: '+233 555 000 111',
		guests: '4',
		inspection_date: '2026-07-21',
		inspection_time: '14:30',
		site_url: 'https://example.com/site',
		site_type: 'Warehouse',
		severity: 'High',
		follow_up: 'yes',
		follow_note: 'Bring replacement locks.',
		hidden_region: 'north',
		calculated_score: '8',
		areas: 'Roof,Storage',
		rating: '4',
		confidence: '8',
	})
	expect(JSON.parse(String(data.priority))).toEqual(['Safety', 'Cost', 'Timing'])
	expect(JSON.parse(String(data.matrix))).toEqual({ Roof: 'Review', Storage: 'Critical' })
	expect(String(data.signature)).toContain('data:image/png;base64,')
	expect(String(data.attachment)).toContain('data:text/plain;base64,')
	expect(data.intro_section).toBeUndefined()
	expect(data.info_statement).toBeUndefined()
})

async function fillTextQuestion(page: Page, heading: RegExp, value: string): Promise<void> {
	await expect(page.getByRole('heading', { name: heading })).toBeVisible()
	await page.locator('input:not([type="file"]), textarea').first().fill(value)
	await page.getByRole('button', { name: /ok/i }).click()
}

async function typeFocusedTextQuestion(page: Page, heading: RegExp, value: string): Promise<void> {
	await expect(page.getByRole('heading', { name: heading })).toBeVisible()
	const input = page.locator('input:not([type="file"]), textarea').first()
	await expect(input).toBeFocused({ timeout: 5_000 })
	await page.keyboard.type(value)
	await page.keyboard.press('Enter')
}

async function chooseOptionQuestion(page: Page, heading: RegExp, option: string): Promise<void> {
	await expect(page.getByRole('heading', { name: heading })).toBeVisible()
	await page.getByRole('button', { name: option }).click()
	await page.getByRole('button', { name: /ok/i }).click()
}

async function routeOfflineFormScenario(
	context: BrowserContext,
	slug: string,
	form: Record<string, unknown>,
	apiOnline: () => boolean,
	submissions: Array<Record<string, unknown>>,
): Promise<void> {
	await context.route(`**/api/public/forms/${slug}`, async route => {
		if (!apiOnline()) {
			await route.abort('internetdisconnected')
			return
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(form),
		})
	})

	await context.route('**/api/public/responses', async route => {
		const payload = route.request().postDataJSON() as Record<string, unknown>
		submissions.push(payload)
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ ok: true }),
		})
	})
}

async function waitForServiceWorkerControl(page: Page): Promise<void> {
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

async function waitForOfflineRouteCache(page: Page): Promise<void> {
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

async function expectVisibleWithPageDiagnostics(
	page: Page,
	locator: ReturnType<Page['getByRole']>,
	diagnostics: string[],
): Promise<void> {
	try {
		await expect(locator).toBeVisible()
	} catch (error) {
		const bodyText = await page.locator('body').innerText({ timeout: 1_000 }).catch(() => '')
		const url = page.url()
		throw new Error([
			error instanceof Error ? error.message : String(error),
			`url: ${url}`,
			`body: ${bodyText.slice(0, 2000)}`,
			`diagnostics:\n${diagnostics.join('\n')}`,
		].join('\n\n'))
	}
}
