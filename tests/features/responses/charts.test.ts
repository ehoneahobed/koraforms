import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildCategoricalBarData,
	buildHeatmapModel,
	buildHistogramBins,
	heatmapColorClass,
} from '../../../src/features/responses/charts'

test('buildHeatmapModel groups responses into week columns and month labels', () => {
	const now = new Date(2026, 6, 21, 12)
	const responses = [
		{ submittedAt: new Date(2026, 6, 21, 10).getTime() },
		{ submittedAt: new Date(2026, 6, 21, 11).getTime() },
		{ submittedAt: new Date(2026, 6, 20, 10).getTime() },
	]

	const model = buildHeatmapModel(responses, now, 2)
	assert.equal(model.maxCount, 2)
	assert.equal(model.weeks.length >= 2, true)
	assert.equal(model.monthLabels.some(label => label.label === 'Jul'), true)
	assert.equal(model.weeks.flat().find(day => day.key === '2026-07-21')?.count, 2)
	assert.equal(model.weeks.flat().find(day => day.key === '2026-07-20')?.count, 1)
})

test('heatmapColorClass maps empty and intense cells predictably', () => {
	assert.match(heatmapColorClass(0, 10), /gray/)
	assert.match(heatmapColorClass(1, 10), /brand-100/)
	assert.match(heatmapColorClass(10, 10), /brand-600/)
})

test('buildHistogramBins creates fixed bins and includes the max value', () => {
	const bins = buildHistogramBins([1, 2, 3, 4, 5], 5)
	assert.equal(bins.length, 5)
	assert.deepEqual(bins.map(bin => bin.count), [1, 1, 1, 1, 1])
	assert.equal(bins[0]?.from, 1)
	assert.equal(bins.at(-1)?.to, 5)
})

test('buildCategoricalBarData returns display percentages', () => {
	const data = buildCategoricalBarData([['Yes', 3], ['No', 1]], 4)
	assert.deepEqual(data.map(item => ({ ...item, widthPct: Math.round(item.widthPct) })), [
		{ label: 'Yes', count: 3, widthPct: 100, pctOfTotal: 75 },
		{ label: 'No', count: 1, widthPct: 33, pctOfTotal: 25 },
	])
})
