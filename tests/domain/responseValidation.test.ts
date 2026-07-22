import test from 'node:test'
import assert from 'node:assert/strict'
import { RESPONSE_VALIDATION_LIMITS, validatePublishedResponsePayload } from '../../src/domain/responseValidation'
import type { FormField } from '../../src/types'

const fields: FormField[] = [
	{ id: 'name', type: 'text', label: 'Name', required: true },
	{ id: 'email', type: 'email', label: 'Email', required: true },
	{ id: 'attending', type: 'yesno', label: 'Will you attend?', required: true },
	{
		id: 'guests',
		type: 'number',
		label: 'Number of guests',
		required: true,
		conditions: [{ fieldId: 'attending', operator: 'equals', value: 'yes' }],
	},
	{ id: 'diet', type: 'checkbox', label: 'Diet', required: false, options: 'Vegetarian,Vegan,None' },
	{ id: 'rank', type: 'ranking', label: 'Rank sessions', required: false, options: 'A,B,C' },
	{ id: 'matrix', type: 'matrix', label: 'Rate areas', required: false, matrixRows: 'Speed,Quality', matrixColumns: 'Bad,Good' },
	{ id: 'sig', type: 'signature', label: 'Signature', required: false },
	{ id: 'file', type: 'file', label: 'Photo', required: false },
	{ id: 'section', type: 'section', label: 'Next', required: false },
	{ id: 'secret', type: 'hidden', label: 'Secret', required: false, defaultValue: 'campaign-a' },
	{ id: 'total', type: 'calculated', label: 'Total', required: false, formula: '{Number of guests} * 25' },
]

test('response validator sanitizes accepted payloads and strips display-only fields', () => {
	const result = validatePublishedResponsePayload(fields, JSON.stringify({
		name: ' Ada ',
		email: 'ada@example.com',
		attending: 'yes',
		guests: '2',
		diet: 'Vegetarian,Vegan',
		rank: '["B","A"]',
		matrix: '{"Speed":"Good"}',
		sig: 'data:image/png;base64,abc',
		file: 'data:image/png;base64,abc',
		section: 'should strip',
		secret: '',
		total: '999',
		_meta: {
			duration: 20,
			ua: 'Test UA',
			injected: '<script>',
		},
	}))

	assert.equal(result.valid, true)
	assert.deepEqual(JSON.parse(result.data), {
		name: 'Ada',
		email: 'ada@example.com',
		attending: 'yes',
		guests: '2',
		diet: 'Vegetarian,Vegan',
		rank: '["B","A"]',
		matrix: '{"Speed":"Good"}',
		sig: 'data:image/png;base64,abc',
		file: 'data:image/png;base64,abc',
		secret: 'campaign-a',
		total: '50',
		_meta: {
			duration: 20,
			ua: 'Test UA',
		},
	})
})

test('response validator ignores hidden conditional answers that are no longer visible', () => {
	const result = validatePublishedResponsePayload(fields, JSON.stringify({
		name: 'Ada',
		email: 'ada@example.com',
		attending: 'no',
		guests: '100',
	}))

	assert.equal(result.valid, true)
	assert.deepEqual(JSON.parse(result.data), {
		name: 'Ada',
		email: 'ada@example.com',
		attending: 'no',
		secret: 'campaign-a',
		total: '2500',
	})
})

test('response validator rejects unknown fields and invalid field values', () => {
	const result = validatePublishedResponsePayload(fields, JSON.stringify({
		name: '',
		email: 'not-email',
		attending: 'maybe',
		guests: 'two',
		diet: 'Injected',
		rank: '["A","A"]',
		matrix: '{"Speed":"Great"}',
		sig: 'not-data',
		file: 'not-data',
		unknown: 'x',
	}))

	assert.equal(result.valid, false)
	assert.deepEqual(result.issues.map(issue => issue.fieldId).sort(), [
		'attending',
		'diet',
		'email',
		'file',
		'matrix',
		'name',
		'rank',
		'sig',
		'unknown',
	])
})

test('response validator rejects malformed response JSON', () => {
	const result = validatePublishedResponsePayload(fields, 'not-json')

	assert.equal(result.valid, false)
	assert.deepEqual(result.issues, [{ fieldId: '_root', message: 'Response data must be a JSON object' }])
})

test('response validator enforces form shape and value limits', () => {
	const tooManyFields = Array.from({ length: RESPONSE_VALIDATION_LIMITS.maxFields + 1 }, (_, index): FormField => ({
		id: `field_${index}`,
		type: 'text',
		label: `Field ${index}`,
	}))
	const tooManyOptions: FormField = {
		id: 'choice',
		type: 'radio',
		label: 'Choice',
		options: Array.from({ length: RESPONSE_VALIDATION_LIMITS.maxOptions + 1 }, (_, index) => `Option ${index}`).join(','),
	}
	const tooLargeText: FormField = {
		id: 'message',
		type: 'text',
		label: 'Message',
	}

	assert.equal(validatePublishedResponsePayload(tooManyFields, '{}').valid, false)
	assert.equal(validatePublishedResponsePayload([tooManyOptions], '{}').valid, false)

	const valueResult = validatePublishedResponsePayload([tooLargeText], JSON.stringify({
		message: 'x'.repeat(RESPONSE_VALIDATION_LIMITS.maxChoiceValueLength + 1),
	}))
	assert.equal(valueResult.valid, false)
	assert.deepEqual(valueResult.issues, [{ fieldId: 'message', message: 'Response value is too long' }])
})
