import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildAuditEventRecord,
	recordAuditEvent,
	sanitizeAuditMetadata,
} from '../../../src/features/audit/events'

test('audit event builder creates stable sanitized records', () => {
	const record = buildAuditEventRecord({
		formId: 'form_1',
		actorId: 'user_1',
		eventType: 'form_published',
		summary: 'Published form',
		metadata: {
			slug: 'rsvp',
			accessPassword: 'secret',
			nested: { token: 'abc', safe: 'ok' },
		},
	}, 1234)

	assert.equal(record.formId, 'form_1')
	assert.equal(record.actorId, 'user_1')
	assert.equal(record.actorType, 'user')
	assert.equal(record.createdAt, 1234)
	assert.deepEqual(record.metadata, {
		slug: 'rsvp',
		accessPassword: '[redacted]',
		nested: { token: '[redacted]', safe: 'ok' },
	})
})

test('audit metadata redacts payload-like and answer-like keys', () => {
	const sanitized = sanitizeAuditMetadata({
		payload: { email: 'person@example.com' },
		answers: { name: 'Ada' },
		responseData: { name: 'Ada' },
		count: 2,
	})

	assert.deepEqual(sanitized, {
		payload: '[redacted]',
		answers: '[redacted]',
		responseData: '[redacted]',
		count: 2,
	})
})

test('recordAuditEvent writes valid events and swallows persistence errors', async () => {
	const inserted: unknown[] = []
	await recordAuditEvent({ insert: async record => inserted.push(record) }, {
		formId: 'form_1',
		eventType: 'responses_exported',
		summary: 'Exported responses',
	})
	assert.equal(inserted.length, 1)

	const originalWarn = console.warn
	console.warn = () => {}
	try {
		await recordAuditEvent({ insert: async () => { throw new Error('offline') } }, {
			formId: 'form_1',
			eventType: 'settings_updated',
			summary: 'Updated settings',
		})
	} finally {
		console.warn = originalWarn
	}
})
