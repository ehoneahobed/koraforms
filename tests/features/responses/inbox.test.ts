import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildCompletionStats,
	buildFollowUpReview,
	buildResponseOverview,
	buildResponseQualitySignals,
} from '../../../src/features/responses/inbox'
import type { FormField } from '../../../src/types'

const fields: FormField[] = [
	{ id: 'name', type: 'text', label: 'Your Name', required: true },
	{ id: 'email', type: 'email', label: 'Email', required: true },
	{ id: 'message', type: 'textarea', label: 'Message', required: false },
	{ id: 'intro', type: 'section', label: 'Intro', required: false },
]

const response = (id: string, data: Record<string, unknown>, submittedAt = Date.now()): Record<string, unknown> => ({
	id,
	submittedAt,
	data: JSON.stringify(data),
})

test('buildCompletionStats counts complete and partial responses using required response fields only', () => {
	const responses = [
		response('1', { name: 'Ada', email: 'ada@example.com' }),
		response('2', { name: 'Grace', email: '' }),
	]

	assert.deepEqual(buildCompletionStats(fields, responses), {
		complete: 1,
		partial: 1,
		rate: 50,
		dropOff: 1,
	})
})

test('buildResponseOverview summarizes timing, devices, fill rates, and required gaps', () => {
	const responses = [
		response('1', { name: 'Ada', email: 'ada@example.com', message: 'Hi', _meta: { duration: 20, ua: 'Mozilla/5.0 (iPhone) AppleWebKit Version/17 Mobile Safari/604.1' } }, 3000),
		response('2', { name: 'Grace', email: '', message: '', _meta: { duration: 40, ua: 'Mozilla/5.0 (Macintosh) AppleWebKit Chrome/125.0.0.0 Safari/537.36' } }, 2000),
	]

	const overview = buildResponseOverview(fields, responses)
	assert.equal(overview.lastResponseAt, 3000)
	assert.equal(overview.avgDuration, 30)
	assert.equal(overview.medianDuration, 30)
	assert.equal(overview.mobilePct, 50)
	assert.deepEqual(overview.requiredGaps.map(item => [item.field.id, item.missing]), [['email', 1]])
	assert.equal(overview.lowFillFields.some(item => item.field.id === 'intro'), false)
})

test('buildFollowUpReview identifies incomplete, slow, low-fill, and duplicate responses', () => {
	const responses = [
		response('1', { name: 'Ada', email: 'ada@example.com', message: 'One', _meta: { duration: 60 } }),
		response('2', { name: 'Ada', email: 'ada@example.com', message: '', _meta: { duration: 700 } }),
		response('3', { name: 'Grace', email: '', message: '', _meta: { duration: 70 } }),
	]

	const review = buildFollowUpReview(fields, responses)
	assert.equal(review.incomplete.length, 1)
	assert.equal(review.incomplete[0]?.missingFields[0]?.id, 'email')
	assert.equal(review.slow.length, 1)
	assert.equal(review.slow[0]?.response.id, '2')
	assert.equal(review.lowFillFields.some(item => item.field.id === 'message'), true)
	assert.deepEqual(review.duplicateGroups.map(group => [group.field.id, group.value, group.responses.length]), [
		['name', 'ada', 2],
		['email', 'ada@example.com', 2],
	])
	assert.equal(review.qualitySignals.some(signal => signal.type === 'duplicate_identity'), true)
	assert.equal(review.qualitySignals.some(signal => signal.type === 'slow_submit'), true)
})

test('buildResponseQualitySignals flags fast, duplicate, incomplete, repeated, and attachment responses', () => {
	const qualityFields: FormField[] = [
		{ id: 'name', type: 'text', label: 'Name', required: true },
		{ id: 'email', type: 'email', label: 'Email', required: true },
		{ id: 'city', type: 'text', label: 'City', required: false },
		{ id: 'notes', type: 'textarea', label: 'Notes', required: false },
		{ id: 'file', type: 'file', label: 'Attachment', required: false },
	]
	const parsed = [
		{
			response: response('1', {}),
			data: { name: 'Ada', email: 'ada@example.com', city: 'same', notes: 'same', file: 'blob:1' },
			meta: { duration: 4 },
			completion: 100,
		},
		{
			response: response('2', {}),
			data: { name: 'Ada', email: 'ada@example.com', city: 'same', notes: 'same', file: 'blob:1' },
			meta: { duration: 400 },
			completion: 100,
		},
		{
			response: response('3', {}),
			data: { name: 'Grace', email: '', city: 'x', notes: '', file: '' },
			meta: { duration: 30 },
			completion: 50,
		},
	]

	const signals = buildResponseQualitySignals(qualityFields, parsed, 300)
	const types = new Set(signals.map(signal => signal.type))
	assert.equal(types.has('fast_submit'), true)
	assert.equal(types.has('duplicate_identity'), true)
	assert.equal(types.has('duplicate_payload'), true)
	assert.equal(types.has('incomplete'), true)
	assert.equal(types.has('low_completion'), true)
	assert.equal(types.has('attachment_review'), true)
})
