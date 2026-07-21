import { dateKey } from './utils'

export interface HeatmapDay {
	date: Date
	key: string
	count: number
	dow: number
}

export interface HeatmapMonthLabel {
	label: string
	weekIndex: number
}

export interface HeatmapModel {
	weeks: HeatmapDay[][]
	maxCount: number
	monthLabels: HeatmapMonthLabel[]
}

export interface HistogramBin {
	from: number
	to: number
	count: number
}

export interface CategoricalBarDatum {
	label: string
	count: number
	widthPct: number
	pctOfTotal: number
}

export function buildHeatmapModel(
	responses: Record<string, unknown>[],
	now = new Date(),
	totalWeeks = 52,
): HeatmapModel {
	const counts: Record<string, number> = {}
	for (const response of responses) {
		if (!response.submittedAt) continue
		const key = dateKey(new Date(Number(response.submittedAt)))
		counts[key] = (counts[key] ?? 0) + 1
	}

	const today = new Date(now)
	today.setHours(0, 0, 0, 0)
	const totalDays = totalWeeks * 7
	const endDay = new Date(today)
	const startDay = new Date(today)
	startDay.setDate(startDay.getDate() - totalDays + 1)
	startDay.setDate(startDay.getDate() - startDay.getDay())

	const weeks: HeatmapDay[][] = []
	let currentWeek: HeatmapDay[] = []
	const cursor = new Date(startDay)
	while (cursor <= endDay || currentWeek.length > 0) {
		const key = dateKey(cursor)
		const dow = cursor.getDay()
		currentWeek.push({ date: new Date(cursor), key, count: counts[key] ?? 0, dow })
		if (dow === 6 || cursor.getTime() === endDay.getTime()) {
			weeks.push(currentWeek)
			currentWeek = []
		}
		cursor.setDate(cursor.getDate() + 1)
		if (cursor > endDay && currentWeek.length === 0) break
	}

	const monthLabels: HeatmapMonthLabel[] = []
	let lastMonth = -1
	for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
		const firstDayOfWeek = weeks[weekIndex]?.[0]
		if (!firstDayOfWeek) continue
		const month = firstDayOfWeek.date.getMonth()
		if (month !== lastMonth) {
			monthLabels.push({
				label: firstDayOfWeek.date.toLocaleDateString(undefined, { month: 'short' }),
				weekIndex,
			})
			lastMonth = month
		}
	}

	return {
		weeks,
		maxCount: Math.max(...Object.values(counts), 1),
		monthLabels,
	}
}

export function heatmapColorClass(count: number, maxCount: number): string {
	if (count === 0) return 'fill-gray-100 dark:fill-gray-800'
	const ratio = count / Math.max(maxCount, 1)
	if (ratio <= 0.15) return 'fill-brand-100 dark:fill-brand-900/50'
	if (ratio <= 0.3) return 'fill-brand-200 dark:fill-brand-800/60'
	if (ratio <= 0.5) return 'fill-brand-300 dark:fill-brand-700/70'
	if (ratio <= 0.75) return 'fill-brand-400 dark:fill-brand-600'
	return 'fill-brand-600 dark:fill-brand-500'
}

export function buildHistogramBins(values: number[], binCount = 5): HistogramBin[] {
	if (values.length === 0) return []
	const sorted = [...values].sort((a, b) => a - b)
	const min = sorted[0] ?? 0
	const max = sorted[sorted.length - 1] ?? 0
	const range = max - min || 1
	const step = range / binCount
	const bins: HistogramBin[] = []

	for (let i = 0; i < binCount; i++) {
		const from = min + step * i
		const to = i === binCount - 1 ? max + 0.001 : min + step * (i + 1)
		const count = sorted.filter(value => value >= from && value < to).length
		bins.push({ from, to: i === binCount - 1 ? max : to, count })
	}
	return bins
}

export function buildCategoricalBarData(counts: [string, number][], total: number): CategoricalBarDatum[] {
	const maxCount = counts[0]?.[1] ?? 1
	return counts.map(([label, count]) => ({
		label,
		count,
		widthPct: maxCount > 0 ? (count / maxCount) * 100 : 0,
		pctOfTotal: total > 0 ? Math.round((count / total) * 100) : 0,
	}))
}
