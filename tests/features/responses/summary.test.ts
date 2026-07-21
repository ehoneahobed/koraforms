import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildDailyCounts,
	buildDeviceBreakdown,
	buildFunnelData,
	buildNpsSummary,
	buildResponsesAnalyticsSummary,
	calculateAverageCompletionTime,
	calculateAverageFillRate,
	calculateCompletionRate,
	calculateTrendPct,
	countActiveDays,
	filterResponses,
	formatResponseDateRange,
	paginateResponses,
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

	const summary = buildResponsesAnalyticsSummary(fields, responses, '30d', [])
	assert.equal(summary.totalResponses, 2)
	assert.equal(summary.completionRate, 50)
	assert.equal(summary.averageFillRate, 83)
	assert.equal(summary.averageCompletionTime, 30)
	assert.equal(summary.activeDays, 1)
	assert.deepEqual(summary.deviceBreakdown.browsers, [['Chrome', 1], ['Safari', 1]])
	assert.equal(summary.npsData?.nps, 0)
	assert.equal(summary.funnelData.map(step => step.label).includes('Personal details'), false)
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
