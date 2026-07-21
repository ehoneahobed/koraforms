import test from 'node:test'
import assert from 'node:assert/strict'
import {
	daysForRange,
	dateKey,
	fieldLabel,
	formatDuration,
	formatResponseValue,
	formatTimeSince,
	isFilledValue,
	median,
	parseUA,
	responseCompletionPct,
	responseFields,
	staticFieldLabel,
} from '../../../src/features/responses/utils'
import type { FormField } from '../../../src/types'

const fields: FormField[] = [
	{ id: 'name', type: 'text', label: 'Your Name', required: true },
	{ id: 'email', type: 'email', label: 'Email', required: true },
	{ id: 'intro', type: 'statement', label: 'Intro', required: false },
]

test('time range and formatting helpers are deterministic', () => {
	assert.equal(daysForRange('14d'), 14)
	assert.equal(daysForRange('all'), null)
	assert.equal(dateKey(new Date(2026, 6, 21)), '2026-07-21')
	assert.equal(median([3, 1, 2]), 2)
	assert.equal(median([4, 1, 2, 3]), 2.5)
	assert.equal(formatDuration(75), '1m 15s')
	assert.equal(formatDuration(7200), '2h 0m')
	assert.equal(formatTimeSince(1_000_000, 1_120_000), '2m ago')
})

test('parseUA classifies common browsers and devices', () => {
	assert.deepEqual(parseUA('Mozilla/5.0 (Macintosh) AppleWebKit Safari/605.1.15'), {
		browser: 'Safari',
		os: 'macOS',
		device: 'Desktop',
	})
	assert.deepEqual(parseUA('Mozilla/5.0 (iPhone) AppleWebKit Version/17 Mobile Safari/604.1'), {
		browser: 'Safari',
		os: 'iOS',
		device: 'Mobile',
	})
})

test('response field and completion helpers ignore display-only fields', () => {
	assert.deepEqual(responseFields(fields).map(field => field.id), ['name', 'email'])
	assert.equal(responseCompletionPct(fields, { name: 'Ada' }), 50)
	assert.equal(responseCompletionPct(fields, { name: 'Ada', email: 'ada@example.com' }), 100)
	assert.equal(isFilledValue(''), false)
	assert.equal(isFilledValue('0'), true)
})

test('field labels support answer piping and static cleanup', () => {
	assert.equal(fieldLabel({ id: 'q2', type: 'text', label: 'Hi {{Your Name}}', required: false }, { name: 'Ada' }, fields), 'Hi Ada')
	assert.equal(staticFieldLabel({ id: 'q2', type: 'text', label: 'Apart from your name {{Your Name}} is there another?', required: false }), 'Apart from Your Name is there another?')
})

test('formatResponseValue presents special field values consistently', () => {
	assert.deepEqual(formatResponseValue({ type: 'checkbox' }, 'A, B'), { kind: 'list', values: ['A', 'B'] })
	assert.deepEqual(formatResponseValue({ type: 'rating' }, '1'), { kind: 'text', values: ['1 star'] })
	assert.deepEqual(formatResponseValue({ type: 'signature' }, 'data:image/png;base64,abc'), { kind: 'text', values: ['Signature captured'] })
	assert.deepEqual(formatResponseValue({ type: 'text' }, ''), { kind: 'empty', values: [] })
})
