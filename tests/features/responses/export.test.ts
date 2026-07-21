import test from 'node:test'
import assert from 'node:assert/strict'
import { createResponsesCsv, createResponsesJson, createResponsesReportHtml, getExportFields } from '../../../src/features/responses/export'
import type { FormField } from '../../../src/types'

const fields: FormField[] = [
	{ id: 'name', type: 'text', label: 'Your Name', required: true },
	{ id: 'email', type: 'email', label: 'Email', required: true },
	{ id: 'section', type: 'section', label: 'Section', required: false },
	{ id: 'hidden', type: 'hidden', label: 'Hidden', required: false },
]

const responses = [
	{ submittedAt: Date.UTC(2026, 6, 21, 12), data: JSON.stringify({ name: 'Ada "A"', email: 'ada@example.com', hidden: 'campaign' }) },
]

test('getExportFields excludes non-response fields and honors selection', () => {
	assert.deepEqual(getExportFields(fields).map(field => field.id), ['name', 'email'])
	assert.deepEqual(getExportFields(fields, ['email', 'hidden']).map(field => field.id), ['email'])
})

test('createResponsesCsv includes metadata and escapes cells', () => {
	const csv = createResponsesCsv({ fields, responses })
	assert.match(csv, /^"#","Submitted At","Your Name","Email"/)
	assert.match(csv, /"Ada ""A"""/)
	assert.doesNotMatch(csv, /Hidden/)
})

test('createResponsesJson can emit labeled data with or without metadata', () => {
	assert.deepEqual(createResponsesJson({ fields, responses, selectedFieldIds: ['name'], includeMetadata: false }), [
		{ 'Your Name': 'Ada "A"' },
	])
	assert.deepEqual(createResponsesJson({ fields, responses, selectedFieldIds: ['email'], includeMetadata: true }), [
		{
			responseNumber: 1,
			submittedAt: '2026-07-21T12:00:00.000Z',
			data: { Email: 'ada@example.com' },
		},
	])
})

test('createResponsesReportHtml escapes response content and uses metadata for average time', () => {
	const html = createResponsesReportHtml({
		title: '<Demo>',
		fields,
		generatedAt: new Date(2026, 6, 21),
		responses: [
			{
				submittedAt: Date.UTC(2026, 6, 21),
				data: JSON.stringify({ name: '<script>alert(1)</script>', email: 'ada@example.com', _meta: { duration: 30 } }),
			},
			{
				submittedAt: Date.UTC(2026, 6, 20),
				data: JSON.stringify({ name: 'Grace', email: 'grace@example.com', _meta: { duration: 90 } }),
			},
		],
	})

	assert.match(html, /&lt;Demo&gt;/)
	assert.match(html, /1m/)
	assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
	assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
	assert.doesNotMatch(html, /Section/)
})
