import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPublicResponseRejectionLogEvent } from '../../src/domain/publicResponseDiagnostics'

test('public response rejection diagnostics omit answer payloads', () => {
	const event = buildPublicResponseRejectionLogEvent({
		reason: 'payload_invalid',
		status: 422,
		formId: 'public-slug',
		resolvedFormId: 'form_123',
		slug: 'public-slug',
		clientSubmissionId: 'client_abc',
		responseBytes: 4096.9,
		error: 'Response failed validation',
		issues: [
			{ fieldId: 'email', message: 'Invalid email address' },
			{ fieldId: 'secret_answer', message: 'Unknown field' },
		],
		now: 123,
	})

	assert.deepEqual(event, {
		event: 'public_response_rejected',
		reason: 'payload_invalid',
		status: 422,
		at: 123,
		formId: 'public-slug',
		resolvedFormId: 'form_123',
		slug: 'public-slug',
		clientSubmissionIdPresent: true,
		responseBytes: 4096,
		error: 'Response failed validation',
		issues: [
			{ fieldId: 'email', message: 'Invalid email address' },
			{ fieldId: 'secret_answer', message: 'Unknown field' },
		],
	})

	const serialized = JSON.stringify(event)
	assert.equal(serialized.includes('keyboard@example.com'), false)
	assert.equal(serialized.includes('Ada Offline'), false)
})

test('public response rejection diagnostics bound issue count and text length', () => {
	const event = buildPublicResponseRejectionLogEvent({
		reason: 'response_not_accepted',
		status: 403,
		formId: ' x '.repeat(100),
		clientSubmissionId: '',
		responseBytes: Number.NaN,
		error: 'This form is no longer accepting responses.',
		issues: Array.from({ length: 25 }, (_, index) => ({
			fieldId: `field_${index}`,
			message: 'x'.repeat(250),
		})),
		now: 456,
	})

	assert.equal(event.issues.length, 20)
	assert.equal(event.issues[0]?.message.length, 160)
	assert.equal(event.formId.length, 160)
	assert.equal(event.clientSubmissionIdPresent, false)
	assert.equal(event.responseBytes, 0)
})
