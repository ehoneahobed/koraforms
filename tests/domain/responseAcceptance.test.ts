import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluatePublicResponseAcceptance } from '../../src/domain/responseAcceptance'

test('public response acceptance allows ordinary open forms', () => {
	const result = evaluatePublicResponseAcceptance({}, 0, 1_000)

	assert.deepEqual(result, {
		accepted: true,
		code: 'accepted',
		limitPolicy: 'strict',
		status: 200,
		error: '',
	})
})

test('public response acceptance rejects forms after close time', () => {
	const result = evaluatePublicResponseAcceptance({
		closesAt: 1_000,
		closedMessage: 'Registration has closed.',
	}, 0, 1_001)

	assert.deepEqual(result, {
		accepted: false,
		code: 'form_closed',
		limitPolicy: 'strict',
		status: 403,
		error: 'Registration has closed.',
	})
})

test('public response acceptance rejects forms before open time', () => {
	const result = evaluatePublicResponseAcceptance({ opensAt: 2_000 }, 0, 1_999)

	assert.deepEqual(result, {
		accepted: false,
		code: 'form_not_open',
		limitPolicy: 'strict',
		status: 403,
		error: 'This form is not yet open for responses.',
	})
})

test('public response acceptance uses response counter for max response limits', () => {
	const result = evaluatePublicResponseAcceptance({ maxResponses: 10 }, 10, 1_000)

	assert.deepEqual(result, {
		accepted: false,
		code: 'max_responses_reached',
		limitPolicy: 'strict',
		status: 403,
		error: 'This form has reached its maximum number of responses.',
	})
})

test('public response acceptance ignores unset and invalid max response values', () => {
	assert.equal(evaluatePublicResponseAcceptance({ maxResponses: 0 }, 100, 1_000).accepted, true)
	assert.equal(evaluatePublicResponseAcceptance({ maxResponses: undefined }, 100, 1_000).accepted, true)
	assert.equal(evaluatePublicResponseAcceptance({ maxResponses: Number.NaN }, 100, 1_000).accepted, true)
})
