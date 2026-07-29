import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDeliveryStatusSummary } from '../../../src/features/forms/deliveries'

test('delivery status summary counts and sorts webhook deliveries', () => {
	const summary = buildDeliveryStatusSummary([
		{ id: 'old', type: 'webhook', status: 'delivered', target: 'https://hooks.example.com/a', attempts: 1, updatedAt: 100 },
		{ id: 'latest', type: 'webhook', status: 'failed', target: 'https://api.example.com/hook', attempts: 3, lastError: 'Timeout', updatedAt: 300 },
		{ id: 'email', type: 'email', status: 'pending', target: 'owner@example.com', updatedAt: 400 },
	], { type: 'webhook' })

	assert.equal(summary.total, 2)
	assert.equal(summary.delivered, 1)
	assert.equal(summary.failed, 1)
	assert.equal(summary.pending, 0)
	assert.equal(summary.latest[0]?.id, 'latest')
	assert.equal(summary.latest[0]?.targetLabel, 'api.example.com')
	assert.equal(summary.latest[0]?.lastError, 'Timeout')
})

test('delivery status summary ignores malformed records and bounds latest items', () => {
	const summary = buildDeliveryStatusSummary([
		{ id: 'bad-type', type: 'sms', status: 'failed', target: 'https://example.com', updatedAt: 500 },
		{ id: 'bad-status', type: 'webhook', status: 'done', target: 'https://example.com', updatedAt: 400 },
		{ id: 'one', type: 'webhook', status: 'pending', target: 'not-a-url', updatedAt: 300 },
		{ id: 'two', type: 'webhook', status: 'delivering', target: 'https://two.example.com', updatedAt: 200 },
	], { limit: 1 })

	assert.equal(summary.total, 2)
	assert.equal(summary.pending, 1)
	assert.equal(summary.delivering, 1)
	assert.equal(summary.latest.length, 1)
	assert.equal(summary.latest[0]?.id, 'one')
	assert.equal(summary.latest[0]?.targetLabel, 'Webhook endpoint')
})

