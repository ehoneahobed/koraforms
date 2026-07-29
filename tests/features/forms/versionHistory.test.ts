import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPublishedFormVersionRecord, buildVersionRestorePayload, sortPublishedVersions } from '../../../src/features/forms/versionHistory'

test('published form version records snapshot the public form at publish time', () => {
	const record = buildPublishedFormVersionRecord({
		slug: 'field-audit',
		now: 1234,
		form: {
			id: 'form_1',
			title: 'Field Audit',
			description: 'Inspection form',
			theme: 'emerald',
			fields: JSON.stringify([{ id: 'name', type: 'text', label: 'Name' }]),
			settings: JSON.stringify({ publicResults: true, accessPasswordHint: 'never persisted here' }),
		},
	})

	assert.equal(record.formId, 'form_1')
	assert.equal(record.slug, 'field-audit')
	assert.equal(record.publishedAt, 1234)
	assert.equal(record.cachedAt, 1234)
	assert.equal(record.status, 'published')
	assert.equal(record.title, 'Field Audit')
	assert.deepEqual(record.fields, [{ id: 'name', type: 'text', label: 'Name', required: false }])
	assert.equal(typeof record.versionHash, 'string')
})

test('version restore payload restores content as a draft without password fields', () => {
	const payload = buildVersionRestorePayload({
		title: 'Prior form',
		description: 'Prior copy',
		theme: 'violet',
		fields: [{ id: 'email', type: 'email', label: 'Email' }],
		settings: { publicResults: true },
	})

	assert.equal(payload.status, 'draft')
	assert.equal(payload.title, 'Prior form')
	assert.equal(payload.theme, 'violet')
	assert.equal('accessPassword' in payload, false)
	assert.deepEqual(JSON.parse(payload.fields), [{ id: 'email', type: 'email', label: 'Email', required: false }])
	assert.deepEqual(JSON.parse(payload.settings), { publicResults: true })
})

test('published versions sort newest first and ignore revoked records', () => {
	const sorted = sortPublishedVersions([
		{ slug: 'a', formId: 'form', versionHash: 'old', title: 'Old', description: '', fields: [], settings: {}, theme: 'red', status: 'published', cachedAt: 1, publishedAt: 1 },
		{ slug: 'a', formId: 'form', versionHash: 'revoked', title: 'Revoked', description: '', fields: [], settings: {}, theme: 'red', status: 'revoked', cachedAt: 3, publishedAt: 3 },
		{ slug: 'a', formId: 'form', versionHash: 'new', title: 'New', description: '', fields: [], settings: {}, theme: 'red', status: 'published', cachedAt: 2, publishedAt: 2 },
	])

	assert.deepEqual(sorted.map(record => record.versionHash), ['new', 'old'])
})
