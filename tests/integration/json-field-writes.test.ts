import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from 'korajs'
import schema from '../../src/schema'
import { parseFormFields, parseFormSettings, serializeFormFields, serializeFormSettings } from '../../src/domain/forms'
import { serializeArchiveSettings } from '../../src/features/forms/dashboard'
import { buildAuditEventRecord } from '../../src/features/audit/events'
import { buildPublicFormProgressRecord } from '../../src/features/form-fill/offlineModel'
import type { FormField, FormSettings } from '../../src/types'

// These run the app's real write helpers against the real beta.13 local store
// (better-sqlite3 adapter), then read back after the write and after reopening.

const openApps = new Set<ReturnType<typeof createApp>>()

function openApp(dir: string) {
	const app = createApp({ schema, store: { adapter: 'better-sqlite3', name: join(dir, 'creator') } })
	openApps.add(app)
	const close = app.close.bind(app)
	app.close = async () => {
		openApps.delete(app)
		await close()
	}
	return app
}

async function withDir(run: (dir: string) => Promise<void>): Promise<void> {
	const dir = mkdtempSync(join(tmpdir(), 'koraforms-json-'))
	try {
		await run(dir)
	} finally {
		// A failed assertion must not leave a database open (the runner would hang).
		for (const app of [...openApps]) await app.close().catch(() => {})
		rmSync(dir, { recursive: true, force: true })
	}
}

test('clearing settings keys the way the settings panels do persists, also after reopening', () => withDir(async dir => {
	let app = openApp(dir)
	await app.ready
	const form = await app.forms.insert({
		title: 'Limits',
		ownerId: 'u1',
		settings: {
			maxResponses: 5,
			opensAt: 1,
			closesAt: 2,
			notifyEmail: 'owner@example.test',
			webhooks: [{ url: 'https://hooks.example.test/a', headers: { 'x-a': '1' } }],
			languages: ['en', 'fr'],
		},
	})
	// FormSettingsPanel / FormSettings clear a value by assigning undefined.
	const current = parseFormSettings((await app.forms.findById(form.id))?.settings)
	const cleared: FormSettings = {
		...current,
		maxResponses: undefined,
		opensAt: undefined,
		closesAt: undefined,
		notifyEmail: undefined,
		webhooks: [{ url: 'https://hooks.example.test/a', headers: undefined }],
		languages: undefined,
	}
	await app.forms.update(form.id, { settings: serializeFormSettings(cleared) })
	const expected = { webhooks: [{ url: 'https://hooks.example.test/a' }] }
	assert.deepEqual((await app.forms.findById(form.id))?.settings, expected)
	await app.close()

	app = openApp(dir)
	await app.ready
	assert.deepEqual((await app.forms.findById(form.id))?.settings, expected)
	await app.close()
}))

test('restore removes the archived flag, including on a row whose settings are a legacy JSON string', () => withDir(async dir => {
	const app = openApp(dir)
	await app.ready
	for (const initial of [{ publicResults: true }, JSON.stringify({ publicResults: true, archived: true })]) {
		// A JSON string is what builds before beta.13 stored; the type no longer allows it.
		const form = await app.forms.insert({ title: 'Archive', ownerId: 'u1', settings: initial as FormSettings })
		let row = await app.forms.findById(form.id)
		await app.forms.update(form.id, { settings: serializeArchiveSettings(row?.settings, true) })
		row = await app.forms.findById(form.id)
		assert.equal(parseFormSettings(row?.settings).archived, true)
		await app.forms.update(form.id, { settings: serializeArchiveSettings(row?.settings, false) })
		row = await app.forms.findById(form.id)
		assert.deepEqual(row?.settings, { publicResults: true })
	}
	await app.close()
}))

test('builder autosave succeeds after removing conditions or the camera choice', () => withDir(async dir => {
	const app = openApp(dir)
	await app.ready
	const form = await app.forms.insert({ title: 'Fields', ownerId: 'u1', fields: [] })
	const fields: FormField[] = [
		{ id: 'a', type: 'text', label: 'A', required: false, conditions: undefined, conditionLogic: undefined },
		{ id: 'b', type: 'file', label: 'B', required: false, capture: undefined, placeholder: undefined },
	]
	await app.forms.update(form.id, { fields: serializeFormFields(fields) })
	const stored = parseFormFields((await app.forms.findById(form.id))?.fields)
	assert.deepEqual(stored, [
		{ id: 'a', type: 'text', label: 'A', required: false },
		{ id: 'b', type: 'file', label: 'B', required: false },
	])
	await app.close()
}))

test('audit metadata and respondent progress with undefined members are stored', () => withDir(async dir => {
	const app = openApp(dir)
	await app.ready
	const audit = buildAuditEventRecord({
		formId: 'f1',
		actorId: 'u1',
		eventType: 'settings_updated',
		summary: 'Updated',
		metadata: { publicResults: true, hint: undefined },
	})
	const stored = await app.audit_events.insert(audit)
	assert.deepEqual(stored.metadata, { publicResults: true })
	const progress = await app.public_form_progress.insert(buildPublicFormProgressRecord({
		slug: 's',
		formId: 'f1',
		values: { a: 'x', b: undefined as unknown as string },
		currentIndex: 0,
	}))
	assert.deepEqual(progress.answers, { a: 'x' })
	await app.close()
}))
