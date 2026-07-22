import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOpsDiagnosticsSnapshot } from '../../src/domain/opsDiagnostics'

test('ops diagnostics aggregates health without exposing payloads or secrets', () => {
	const diagnostics = buildOpsDiagnosticsSnapshot({
		forms: [
			{ status: 'published' },
			{ status: 'draft' },
			{ status: 'closed' },
		],
		responses: [
			{ clientSubmissionId: 'client-1', data: '{"secret":"answer"}' },
			{ clientSubmissionId: '' },
		],
		resumeLinks: [
			{ status: 'active', token: 'resume-secret' },
			{ status: 'expired' },
			{ status: 'revoked' },
		],
		sideEffects: [
			{
				id: 'delivery-1',
				responseId: 'response-1',
				formId: 'form-1',
				type: 'webhook',
				status: 'failed',
				attempts: 3,
				lastError: 'x'.repeat(400),
				target: 'https://hooks.example.com/path?token=secret',
				updatedAt: 200,
				nextAttemptAt: 300,
				payload: '{"secret":"body"}',
			},
			{ id: 'delivery-2', type: 'email', status: 'delivered', target: 'owner@example.com', updatedAt: 100 },
			{ id: 'delivery-3', type: 'webhook', status: 'pending', target: 'https://other.example.com' },
		],
	}, 123)

	assert.equal(diagnostics.generatedAt, 123)
	assert.deepEqual(diagnostics.forms, { total: 3, published: 1, draft: 1, closed: 1 })
	assert.deepEqual(diagnostics.responses, { accepted: 2, withClientSubmissionId: 1 })
	assert.deepEqual(diagnostics.resumeLinks, { active: 1, expired: 1, revoked: 1 })
	assert.deepEqual(diagnostics.sideEffects.byStatus, { pending: 1, delivering: 0, delivered: 1, failed: 1 })
	assert.deepEqual(diagnostics.sideEffects.byType, { webhook: 2, email: 1 })
	assert.equal(diagnostics.sideEffects.recentFailures.length, 1)
	assert.equal(diagnostics.sideEffects.recentFailures[0]?.targetHost, 'hooks.example.com')
	assert.equal(diagnostics.sideEffects.recentFailures[0]?.lastError.length, 300)

	const serialized = JSON.stringify(diagnostics)
	assert.equal(serialized.includes('answer'), false)
	assert.equal(serialized.includes('resume-secret'), false)
	assert.equal(serialized.includes('token=secret'), false)
	assert.equal(serialized.includes('body'), false)
})
