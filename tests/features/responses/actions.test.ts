import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildResponsesCsvExport,
	buildResponsesJsonExport,
	buildResponsesReportHtmlExport,
	deleteResponsesMessage,
	responseIdsForDeletion,
} from '../../../src/features/responses/actions'
import type { FormField } from '../../../src/types'

const fields: FormField[] = [
	{ id: 'name', type: 'text', label: 'Name', required: true },
	{ id: 'email', type: 'email', label: 'Email', required: true },
	{ id: 'section', type: 'section', label: 'Details', required: false },
]

const responses: Record<string, unknown>[] = [
	{ id: 'r1', submittedAt: Date.UTC(2026, 6, 21, 12), data: JSON.stringify({ name: 'Ada', email: 'ada@example.com' }) },
]

test('response export builders return null for empty exports', () => {
	assert.equal(buildResponsesCsvExport({ fields, responses: [], formTitle: 'RSVP' }), null)
	assert.equal(buildResponsesJsonExport({ fields, responses: [], formTitle: 'RSVP' }), null)
	assert.equal(buildResponsesReportHtmlExport({ fields, responses: [], formTitle: 'RSVP' }), null)
})

test('CSV export builder creates content and filename from form title', () => {
	const exported = buildResponsesCsvExport({
		fields,
		responses,
		formTitle: 'RSVP',
		selectedFieldIds: ['name'],
		includeMetadata: false,
	})

	assert.equal(exported?.filename, 'RSVP-responses.csv')
	assert.equal(exported?.type, 'text/csv')
	assert.match(exported?.content || '', /^"Name"\n"Ada"/)
	assert.doesNotMatch(exported?.content || '', /Submitted At/)
	assert.doesNotMatch(exported?.content || '', /Email/)
})

test('JSON and report export builders preserve structured response data', () => {
	const exported = buildResponsesJsonExport({ fields, responses, formTitle: '', selectedFieldIds: ['email'], includeMetadata: true })
	assert.equal(exported?.filename, 'form-responses.json')
	assert.deepEqual(exported?.data, [
		{
			responseNumber: 1,
			submittedAt: '2026-07-21T12:00:00.000Z',
			data: {
				Email: 'ada@example.com',
			},
		},
	])

	const html = buildResponsesReportHtmlExport({ fields, responses, formTitle: 'RSVP' })
	assert.match(html || '', /<title>RSVP - Report<\/title>/)
	assert.match(html || '', /<h1>RSVP<\/h1>/)
	assert.match(html || '', /ada@example.com/)
})

test('delete response helpers produce stable messages and ids', () => {
	assert.equal(deleteResponsesMessage(1), 'Delete 1 response?')
	assert.equal(deleteResponsesMessage(3), 'Delete 3 responses?')
	assert.deepEqual(responseIdsForDeletion(new Set(['b', 'a'])), ['b', 'a'])
})
