import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildDailyCounts,
	buildDeviceBreakdown,
	buildFunnelData,
	buildNpsSummary,
	buildFieldJourneySummary,
	buildFormVersionAnalytics,
	buildRespondentLifecycleSummary,
	buildResponsesAnalyticsSummary,
	buildSavedAnalyticsFilterViewPayload,
	calculateAverageCompletionTime,
	calculateAverageFillRate,
	calculateCompletionRate,
	calculateTrendPct,
	countActiveDays,
	decodeFieldFilters,
	encodeFieldFilters,
	filterResponsesByAdvancedFilters,
	filterResponses,
	filterResponsesByDateRange,
	formatResponseDateRange,
	normalizeCompletionFilter,
	normalizeSavedAnalyticsFilterViews,
	paginateResponses,
	presetDateFilter,
	responseDateFilterLabel,
	searchAndSortResponses,
} from '../../../src/features/responses/summary'
import type { FormField } from '../../../src/types'

const fields: FormField[] = [
	{ id: 'name', type: 'text', label: 'Your Name', required: true },
	{ id: 'email', type: 'email', label: 'Email', required: true },
	{ id: 'section', type: 'section', label: 'Personal details', required: false },
	{ id: 'likely', type: 'scale', label: 'How likely are you to recommend us?', required: false },
]

const day = (offset: number): number => {
	const date = new Date()
	date.setHours(12, 0, 0, 0)
	date.setDate(date.getDate() + offset)
	return date.getTime()
}

const response = (submittedAt: number, data: Record<string, unknown>): Record<string, unknown> => ({
	submittedAt,
	data: JSON.stringify(data),
})

test('buildResponsesAnalyticsSummary returns stable metrics from raw responses', () => {
	const responses = [
		response(day(0), {
			name: 'Ada',
			email: 'ada@example.com',
			likely: '10',
			_meta: { duration: 20, ua: 'Mozilla/5.0 (Macintosh) AppleWebKit Chrome/125.0.0.0 Safari/537.36' },
		}),
		response(day(0), {
			name: 'Grace',
			email: '',
			likely: '4',
			_meta: { duration: 40, ua: 'Mozilla/5.0 (iPhone) AppleWebKit Version/17 Mobile Safari/604.1' },
		}),
	]

	const events = [
		{ type: 'viewed_form', sessionId: 's1', visitorKey: 'v1', occurredAt: day(0), answeredCount: 0 },
		{ type: 'started_form', sessionId: 's1', visitorKey: 'v1', occurredAt: day(0), answeredCount: 0 },
		{ type: 'submitted_form', sessionId: 's1', visitorKey: 'v1', occurredAt: day(0), answeredCount: 2 },
	]

	const summary = buildResponsesAnalyticsSummary(fields, responses, '30d', [], events)
	assert.equal(summary.totalResponses, 2)
	assert.equal(summary.completionRate, 50)
	assert.equal(summary.averageFillRate, 83)
	assert.equal(summary.averageCompletionTime, 30)
	assert.equal(summary.activeDays, 1)
	assert.deepEqual(summary.deviceBreakdown.browsers, [['Chrome', 1], ['Safari', 1]])
	assert.equal(summary.npsData?.nps, 0)
	assert.equal(summary.funnelData.map(step => step.label).includes('Personal details'), false)
	assert.equal(summary.lifecycle.uniqueViewers, 2)
	assert.equal(summary.lifecycle.started, 2)
	assert.equal(summary.lifecycle.completed, 2)
})

test('lifecycle summary counts views, starts, partials, and abandoned sessions', () => {
	const now = new Date(2026, 0, 2, 12).getTime()
	const events = [
		{ type: 'viewed_form', sessionId: 's1', visitorKey: 'v1', occurredAt: now - 60_000, answeredCount: 0 },
		{ type: 'started_form', sessionId: 's1', visitorKey: 'v1', occurredAt: now - 50_000, answeredCount: 0 },
		{ type: 'submitted_form', sessionId: 's1', visitorKey: 'v1', occurredAt: now - 40_000, answeredCount: 2 },
		{ type: 'viewed_form', sessionId: 's2', visitorKey: 'v2', occurredAt: now - 60 * 60_000, answeredCount: 0 },
		{ type: 'started_form', sessionId: 's2', visitorKey: 'v2', occurredAt: now - 59 * 60_000, answeredCount: 0 },
		{ type: 'answered_question', sessionId: 's2', visitorKey: 'v2', occurredAt: now - 58 * 60_000, answeredCount: 1 },
	]

	const summary = buildRespondentLifecycleSummary(events, [], now)
	assert.equal(summary.totalViews, 2)
	assert.equal(summary.uniqueViewers, 2)
	assert.equal(summary.started, 2)
	assert.equal(summary.completed, 1)
	assert.equal(summary.partial, 1)
	assert.equal(summary.abandoned, 1)
	assert.equal(summary.startToCompleteRate, 50)
	assert.equal(summary.dropOffAnsweredCount, 1)
})

test('field journey summary uses analytics sessions and accepted responses without double counting', () => {
	const now = new Date(2026, 0, 2, 12).getTime()
	const journeyFields: FormField[] = [
		{ id: 'name', type: 'text', label: 'Your Name', required: true },
		{ id: 'email', type: 'email', label: 'Email', required: true },
		{ id: 'intro', type: 'section', label: 'Intro', required: false },
		{ id: 'message', type: 'textarea', label: 'Message', required: false },
	]
	const responses = [
		{ id: 'r1', data: JSON.stringify({ name: 'Ada', email: 'ada@example.com', message: 'Hi' }) },
	]
	const events = [
		{ type: 'started_form', sessionId: 's1', occurredAt: now - 120_000, questionIndex: 0 },
		{ type: 'answered_question', sessionId: 's1', occurredAt: now - 110_000, fieldId: 'name', questionIndex: 0 },
		{ type: 'answered_question', sessionId: 's1', occurredAt: now - 100_000, fieldId: 'email', questionIndex: 1 },
		{ type: 'submitted_form', sessionId: 's1', occurredAt: now - 90_000, questionIndex: 2 },
		{ type: 'started_form', sessionId: 's2', occurredAt: now - 60 * 60_000, questionIndex: 0 },
		{ type: 'answered_question', sessionId: 's2', occurredAt: now - 59 * 60_000, fieldId: 'name', questionIndex: 0 },
	]

	const summary = buildFieldJourneySummary(journeyFields, events, responses, now)
	assert.deepEqual(summary.map(step => step.field.id), ['name', 'email', 'message'])
	assert.equal(summary[0]?.reached, 2)
	assert.equal(summary[0]?.answered, 2)
	assert.equal(summary[1]?.reached, 2)
	assert.equal(summary[1]?.abandoned, 1)
	assert.equal(summary[2]?.answered, 1)
})

test('form version analytics separates current and older published revisions', () => {
	const now = new Date(2026, 0, 2, 12).getTime()
	const responses = [
		{ id: 'r1', formVersionHash: 'v2hash', submittedAt: now, data: '{}' },
	]
	const events = [
		{ type: 'viewed_form', formVersionHash: 'v1hash', sessionId: 's1', occurredAt: now - 90_000 },
		{ type: 'started_form', formVersionHash: 'v1hash', sessionId: 's1', occurredAt: now - 80_000 },
		{ type: 'viewed_form', formVersionHash: 'v2hash', sessionId: 's2', occurredAt: now - 70_000 },
		{ type: 'started_form', formVersionHash: 'v2hash', sessionId: 's2', occurredAt: now - 60_000 },
		{ type: 'submitted_form', formVersionHash: 'v2hash', sessionId: 's2', occurredAt: now - 50_000 },
	]

	const versions = buildFormVersionAnalytics(responses, events, 'v2hash')
	assert.deepEqual(versions.map(version => version.versionHash), ['v2hash', 'v1hash'])
	assert.equal(versions[0]?.isCurrent, true)
	assert.equal(versions[0]?.responses, 1)
	assert.equal(versions[0]?.conversionRate, 100)
	assert.equal(versions[1]?.partialSessions, 1)
	assert.equal(versions[1]?.conversionRate, 0)
})

test('filterResponses applies field filters against parsed response data', () => {
	const responses = [
		response(day(0), { name: 'Ada Lovelace' }),
		response(day(0), { name: 'Grace Hopper' }),
	]
	const filtered = filterResponses(responses, '30d', [{ fieldId: 'name', value: 'grace' }])
	assert.equal(filtered.length, 1)
	assert.equal(JSON.parse(String(filtered[0]?.data)).name, 'Grace Hopper')
})

test('advanced response filters support completion and field predicates', () => {
	const responses = [
		{ id: '1', submittedAt: day(0), data: JSON.stringify({ name: 'Ada Lovelace', email: 'ada@example.com', likely: '10' }) },
		{ id: '2', submittedAt: day(0), data: JSON.stringify({ name: 'Grace Hopper', email: '', likely: '' }) },
		{ id: '3', submittedAt: day(0), data: JSON.stringify({ name: '', email: 'unknown@example.com', likely: '4' }) },
	]

	assert.deepEqual(
		filterResponsesByAdvancedFilters(fields, responses, {
			completion: 'complete',
			fieldFilters: [{ fieldId: 'name', operator: 'contains', value: 'ada' }],
		}).map(item => item.id),
		['1'],
	)
	assert.deepEqual(
		filterResponsesByAdvancedFilters(fields, responses, {
			completion: 'partial',
			fieldFilters: [{ fieldId: 'email', operator: 'missing' }],
		}).map(item => item.id),
		['2'],
	)
	assert.deepEqual(
		filterResponsesByAdvancedFilters(fields, responses, {
			completion: 'all',
			fieldFilters: [{ fieldId: 'likely', operator: 'equals', value: '4' }],
		}).map(item => item.id),
		['3'],
	)
	assert.deepEqual(
		filterResponsesByAdvancedFilters(fields, responses, {
			completion: 'all',
			fieldFilters: [{ fieldId: 'email', operator: 'present' }],
		}).map(item => item.id),
		['1', '3'],
	)
})

test('advanced response filter URL encoding is strict and recoverable', () => {
	const encoded = encodeFieldFilters([
		{ fieldId: 'name', operator: 'contains', value: 'Ada' },
		{ fieldId: 'email', operator: 'missing' },
	])
	assert.deepEqual(decodeFieldFilters(encoded), [
		{ fieldId: 'name', operator: 'contains', value: 'Ada' },
		{ fieldId: 'email', operator: 'missing' },
	])
	assert.deepEqual(decodeFieldFilters('%7Bbad-json'), [])
	assert.equal(normalizeCompletionFilter('complete'), 'complete')
	assert.equal(normalizeCompletionFilter('something-else'), 'all')
	assert.equal(encodeFieldFilters([{ fieldId: '', operator: 'contains', value: 'x' }]), '')
})

test('saved analytics filter views normalize persisted records', () => {
	const now = day(0)
	const payload = buildSavedAnalyticsFilterViewPayload({
		formId: 'form-1',
		ownerId: 'user-1',
		name: '  Recent VIPs  ',
		timeRange: '90d',
		filters: [
			{ fieldId: 'name', value: 'Ada' },
			{ fieldId: '', value: 'ignored' },
			{ fieldId: 'email', value: 'example.com' },
		],
		now,
	})

	assert.deepEqual(payload, {
		formId: 'form-1',
		ownerId: 'user-1',
		name: 'Recent VIPs',
		timeRange: '90d',
		filters: [
			{ fieldId: 'name', value: 'Ada' },
			{ fieldId: 'email', value: 'example.com' },
		],
		createdAt: now,
		updatedAt: now,
	})

	const views = normalizeSavedAnalyticsFilterViews([
		{ id: 'old', formId: 'form-1', ownerId: 'user-1', name: 'Older', timeRange: 'bad', filters: 'bad', updatedAt: 1 },
		{ id: 'other-form', formId: 'form-2', ownerId: 'user-1', name: 'Wrong form', updatedAt: 3 },
		{ id: 'new', formId: 'form-1', ownerId: 'user-1', name: 'Newer', timeRange: '7d', filters: [{ fieldId: 'email', value: 'x' }], updatedAt: 2 },
		{ id: 'other-user', formId: 'form-1', ownerId: 'user-2', name: 'Wrong owner', updatedAt: 4 },
		{ id: '', formId: 'form-1', ownerId: 'user-1', name: 'Invalid', updatedAt: 5 },
	], 'form-1', 'user-1')

	assert.deepEqual(views.map(view => [view.id, view.name, view.timeRange, view.filters]), [
		['new', 'Newer', '7d', [{ fieldId: 'email', value: 'x' }]],
		['old', 'Older', '30d', []],
	])
})

test('inbox helpers search, sort, paginate, and format date ranges', () => {
	const jan1 = new Date(2026, 0, 1, 12).getTime()
	const jan2 = new Date(2026, 0, 2, 12).getTime()
	const jan3 = new Date(2026, 0, 3, 12).getTime()
	const responses = [
		{ id: '3', submittedAt: jan3, data: JSON.stringify({ name: 'Grace', score: '2' }) },
		{ id: '1', submittedAt: jan1, data: JSON.stringify({ name: 'Ada', score: '10' }) },
		{ id: '2', submittedAt: jan2, data: JSON.stringify({ name: 'Linus', score: '1' }) },
	]

	assert.deepEqual(searchAndSortResponses(responses, 'ada', { column: '_date', direction: 'desc' }).map(item => item.id), ['1'])
	assert.deepEqual(searchAndSortResponses(responses, '', { column: 'score', direction: 'asc' }).map(item => item.id), ['2', '3', '1'])

	const page = paginateResponses(responses, 2, 2)
	assert.deepEqual(page.items.map(item => item.id), ['2'])
	assert.equal(page.totalPages, 2)
	assert.equal(page.currentPage, 2)
	assert.equal(page.start, 3)
	assert.equal(page.end, 3)
	assert.equal(formatResponseDateRange(responses), 'Jan 1, 2026 - Jan 3, 2026')
})

test('date range helpers drill into submitted responses by day boundaries', () => {
	const jan1 = new Date(2026, 0, 1, 23, 59).getTime()
	const jan2 = new Date(2026, 0, 2, 12).getTime()
	const jan3 = new Date(2026, 0, 3, 0, 1).getTime()
	const responses = [
		{ id: '1', submittedAt: jan1, data: '{}' },
		{ id: '2', submittedAt: jan2, data: '{}' },
		{ id: '3', submittedAt: jan3, data: '{}' },
	]

	assert.deepEqual(
		filterResponsesByDateRange(responses, { from: '2026-01-02', to: '2026-01-02' }).map(item => item.id),
		['2'],
	)
	assert.equal(responseDateFilterLabel({ from: '2026-01-02', to: '2026-01-03' }), 'Jan 2, 2026 - Jan 3, 2026')
	assert.deepEqual(presetDateFilter('today', new Date(2026, 0, 3, 12)), { from: '2026-01-03', to: '2026-01-03' })
})

test('summary helpers calculate completion, fill rate, active days, and trends', () => {
	const allData = [
		{ name: 'Ada', email: 'ada@example.com', likely: '10' },
		{ name: 'Grace', email: '', likely: '' },
	]

	assert.equal(calculateCompletionRate(fields, allData), 50)
	assert.equal(calculateAverageFillRate(fields, allData), 67)
	assert.equal(countActiveDays([response(day(0), {}), response(day(0), {}), response(day(-1), {})]), 2)
	assert.equal(calculateTrendPct(10, 5, '30d'), 100)
	assert.equal(calculateTrendPct(10, 5, 'all'), null)
})

test('metadata helpers use raw response metadata', () => {
	const responses = [
		response(day(0), { _meta: { duration: 10, ua: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/125.0.0.0 Safari/537.36' } }),
		response(day(0), { _meta: { duration: 30, ua: 'Mozilla/5.0 (iPad) AppleWebKit Version/17 Mobile Safari/604.1' } }),
		response(day(0), { _meta: { duration: 90_000 } }),
	]

	assert.equal(calculateAverageCompletionTime(responses), 20)
	const breakdown = buildDeviceBreakdown(responses)
	assert.deepEqual(breakdown.devices, [['Desktop', 1], ['Tablet', 1]])
	assert.deepEqual(breakdown.oses, [['Windows', 1], ['iOS', 1]])
})

test('chart helpers build daily buckets, NPS, and funnel data', () => {
	const now = new Date(2026, 6, 21, 12)
	const responses = [
		response(new Date(2026, 6, 21, 12).getTime(), { name: 'Ada' }),
		response(new Date(2026, 6, 20, 12).getTime(), { name: 'Grace' }),
	]
	const counts = buildDailyCounts(responses, '7d', now)
	assert.equal(counts.length, 7)
	assert.deepEqual(counts.slice(-2).map(count => count.count), [1, 1])

	const nps = buildNpsSummary(fields, [{ likely: '10' }, { likely: '8' }, { likely: '6' }])
	assert.equal(nps?.promoters, 1)
	assert.equal(nps?.passives, 1)
	assert.equal(nps?.detractors, 1)

	const funnel = buildFunnelData(fields, [{ name: 'Ada', email: '' }, { name: 'Grace', email: 'g@example.com' }])
	assert.deepEqual(funnel.map(step => [step.label, step.pct]), [['Your Name', 100], ['Email', 50], ['How likely are you to recommend us?', 0]])
})
