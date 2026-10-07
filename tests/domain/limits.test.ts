import test from 'node:test'
import assert from 'node:assert/strict'
import {
	MAX_PUBLIC_RESPONSE_BODY_BYTES,
	MAX_ROUTE_REQUEST_BODY_BYTES,
	PUBLIC_LOCAL_MAX_OPERATION_BYTES,
	resolveRateLimitScale,
} from '../../src/domain/limits'

function publicResponseRequestBody(data: string): string {
	// Same envelope FormFill.tsx posts to /api/public/responses.
	return JSON.stringify({
		formId: 'form-00000000-0000-0000-0000-000000000000',
		data,
		clientSubmissionId: '00000000-0000-0000-0000-000000000000',
		clientSubmittedAt: Date.now(),
		formVersionHash: '4294967295',
	})
}

function responseOfBytes(bytes: number, fill: string): string {
	const prefix = '{"file":"'
	const suffix = '"}'
	return prefix + fill.repeat(Math.floor((bytes - prefix.length - suffix.length) / fill.length)) + suffix
}

test('a maximum-size public response fits the route body limit even when fully escaped', () => {
	const worstCase = responseOfBytes(MAX_PUBLIC_RESPONSE_BODY_BYTES, '\\"')
	assert.ok(Buffer.byteLength(worstCase) <= MAX_PUBLIC_RESPONSE_BODY_BYTES)
	assert.ok(Buffer.byteLength(publicResponseRequestBody(worstCase)) <= MAX_ROUTE_REQUEST_BODY_BYTES)
})

test('a 1.5 MiB attachment response exceeds the framework default but fits the route limit', () => {
	const attachment = responseOfBytes(1.5 * 1024 * 1024, 'QUJD')
	const body = Buffer.byteLength(publicResponseRequestBody(attachment))
	assert.ok(body > 1024 * 1024, 'would be refused by the 1 MiB createProductionServer default')
	assert.ok(body <= MAX_ROUTE_REQUEST_BODY_BYTES)
})

test('the respondent database accepts a maximum-size queued response', () => {
	assert.ok(PUBLIC_LOCAL_MAX_OPERATION_BYTES > MAX_PUBLIC_RESPONSE_BODY_BYTES)
})

test('the test-only rate-limit scale never changes production limits', () => {
	assert.equal(resolveRateLimitScale({ NODE_ENV: 'production', KORAFORMS_TEST_RATE_LIMIT_SCALE: '20' }), 1)
	assert.equal(resolveRateLimitScale({ NODE_ENV: 'test', KORAFORMS_TEST_RATE_LIMIT_SCALE: '20' }), 20)
	assert.equal(resolveRateLimitScale({ NODE_ENV: 'test' }), 1)
	assert.equal(resolveRateLimitScale({ KORAFORMS_TEST_RATE_LIMIT_SCALE: '0' }), 1)
	assert.equal(resolveRateLimitScale({ KORAFORMS_TEST_RATE_LIMIT_SCALE: '2.5' }), 1)
	assert.equal(resolveRateLimitScale({ KORAFORMS_TEST_RATE_LIMIT_SCALE: 'lots' }), 1)
	assert.equal(resolveRateLimitScale({ KORAFORMS_TEST_RATE_LIMIT_SCALE: '100000' }), 100)
})
