import type { FormField } from '../../types'
import { computeCrossInsights, type CrossInsight } from '../../utils/analytics'
import {
	dateKey,
	daysForRange,
	isFilledValue,
	parseResponseData,
	parseResponseMeta,
	parseUA,
	responseFields,
	staticFieldLabel,
	startOfDaysAgo,
	type TimeRange,
} from './utils'

export interface ResponseFilter {
	fieldId: string
	value: string
}

export interface DailyCount {
	date: Date
	count: number
	label: string
}

export interface NpsSummary {
	nps: number
	promoters: number
	passives: number
	detractors: number
	total: number
	fieldLabel: string
}

export interface FunnelStep {
	label: string
	filled: number
	pct: number
}

export interface DeviceBreakdown {
	browsers: [string, number][]
	devices: [string, number][]
	oses: [string, number][]
	hasData: boolean
}

export interface ResponsesAnalyticsSummary {
	filteredResponses: Record<string, unknown>[]
	previousPeriodResponses: Record<string, unknown>[]
	responseData: Record<string, string>[]
	previousResponseData: Record<string, string>[]
	dailyCounts: DailyCount[]
	sparkline7: number[]
	totalResponses: number
	previousTotalResponses: number
	completionRate: number
	previousCompletionRate: number
	averageFillRate: number
	previousAverageFillRate: number
	activeDays: number
	previousActiveDays: number
	averageCompletionTime: number | null
	npsData: NpsSummary | null
	funnelData: FunnelStep[]
	deviceBreakdown: DeviceBreakdown
	crossInsights: CrossInsight[]
	completionSparkline: number[]
	fillRateSparkline: number[]
}

export interface ResponseInboxSort {
	column: string
	direction: 'asc' | 'desc'
}

export interface PaginationResult<T> {
	items: T[]
	totalPages: number
	currentPage: number
	start: number
	end: number
}

export function buildResponsesAnalyticsSummary(
	fields: FormField[],
	responses: Record<string, unknown>[],
	range: TimeRange,
	filters: ResponseFilter[],
): ResponsesAnalyticsSummary {
	const filteredResponses = filterResponses(responses, range, filters)
	const previousPeriodResponses = previousPeriodForRange(responses, range)
	const responseData = filteredResponses.map(parseResponseData)
	const previousResponseData = previousPeriodResponses.map(parseResponseData)
	const dailyCounts = buildDailyCounts(filteredResponses, range)
	const totalResponses = filteredResponses.length
	const previousTotalResponses = previousPeriodResponses.length

	const completionRate = calculateCompletionRate(fields, responseData)
	const previousCompletionRate = calculateCompletionRate(fields, previousResponseData)
	const averageFillRate = calculateAverageFillRate(fields, responseData)
	const previousAverageFillRate = calculateAverageFillRate(fields, previousResponseData)

	return {
		filteredResponses,
		previousPeriodResponses,
		responseData,
		previousResponseData,
		dailyCounts,
		sparkline7: dailyCounts.slice(-7).map(day => day.count),
		totalResponses,
		previousTotalResponses,
		completionRate,
		previousCompletionRate,
		averageFillRate,
		previousAverageFillRate,
		activeDays: countActiveDays(filteredResponses),
		previousActiveDays: countActiveDays(previousPeriodResponses),
		averageCompletionTime: calculateAverageCompletionTime(filteredResponses),
		npsData: buildNpsSummary(fields, responseData),
		funnelData: buildFunnelData(fields, responseData),
		deviceBreakdown: buildDeviceBreakdown(filteredResponses),
		crossInsights: computeCrossInsights(fields, responseData),
		completionSparkline: buildCompletionSparkline(fields, filteredResponses, responseData, dailyCounts),
		fillRateSparkline: buildFillRateSparkline(fields, filteredResponses, responseData, dailyCounts),
	}
}

export function searchAndSortResponses<T extends Record<string, unknown>>(
	responses: T[],
	search: string,
	sort: ResponseInboxSort,
): T[] {
	const query = search.trim().toLowerCase()
	let result = responses

	if (query) {
		result = result.filter(response => {
			const data = parseResponseData(response)
			const submittedAt = response.submittedAt
				? new Date(Number(response.submittedAt)).toLocaleString().toLowerCase()
				: ''
			return submittedAt.includes(query) || Object.values(data).some(value => value.toLowerCase().includes(query))
		})
	}

	if (!sort.column) return result

	return [...result].sort((a, b) => {
		const valueA = sort.column === '_date'
			? String(a.submittedAt || 0)
			: String(parseResponseData(a)[sort.column] || '')
		const valueB = sort.column === '_date'
			? String(b.submittedAt || 0)
			: String(parseResponseData(b)[sort.column] || '')
		const comparison = valueA.localeCompare(valueB, undefined, { numeric: true })
		return sort.direction === 'asc' ? comparison : -comparison
	})
}

export function paginateResponses<T>(items: T[], page: number, perPage: number): PaginationResult<T> {
	const totalPages = Math.max(1, Math.ceil(items.length / perPage))
	const currentPage = Math.min(Math.max(1, page), totalPages)
	const offset = (currentPage - 1) * perPage
	const end = Math.min(currentPage * perPage, items.length)
	return {
		items: items.slice(offset, offset + perPage),
		totalPages,
		currentPage,
		start: items.length === 0 ? 0 : offset + 1,
		end,
	}
}

export function formatResponseDateRange<T extends Record<string, unknown>>(responses: T[]): string {
	if (responses.length === 0) return ''
	const timestamps = responses
		.map(response => Number(response.submittedAt || 0))
		.filter(timestamp => Number.isFinite(timestamp) && timestamp > 0)
	if (timestamps.length === 0) return ''
	const oldest = Math.min(...timestamps)
	const newest = Math.max(...timestamps)
	const format = (timestamp: unknown) => {
		if (!timestamp) return ''
		return new Date(Number(timestamp)).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
	}
	return `${format(oldest)} - ${format(newest)}`
}

export function filterResponses(
	responses: Record<string, unknown>[],
	range: TimeRange,
	filters: ResponseFilter[],
): Record<string, unknown>[] {
	let result = responses
	const days = daysForRange(range)
	if (days !== null) {
		const cutoff = startOfDaysAgo(days)
		result = result.filter(response => {
			if (!response.submittedAt) return true
			return Number(response.submittedAt) >= cutoff
		})
	}

	if (filters.length === 0) return result

	return result.filter(response => {
		const data = parseResponseData(response)
		return filters.every(filter => {
			const value = data[filter.fieldId] ?? ''
			return value.toLowerCase().includes(filter.value.toLowerCase())
		})
	})
}

export function previousPeriodForRange(
	responses: Record<string, unknown>[],
	range: TimeRange,
): Record<string, unknown>[] {
	const days = daysForRange(range)
	if (days === null) return []
	const cutoffCurrent = startOfDaysAgo(days)
	const cutoffPrevious = startOfDaysAgo(days * 2)
	return responses.filter(response => {
		if (!response.submittedAt) return false
		const timestamp = Number(response.submittedAt)
		return timestamp >= cutoffPrevious && timestamp < cutoffCurrent
	})
}

export function buildDailyCounts(
	responses: Record<string, unknown>[],
	range: TimeRange,
	now = new Date(),
): DailyCount[] {
	const counts: Record<string, number> = {}
	for (const response of responses) {
		if (!response.submittedAt) continue
		const key = dateKey(new Date(Number(response.submittedAt)))
		counts[key] = (counts[key] ?? 0) + 1
	}

	const days = daysForRange(range)
	const numDays = days ?? 90
	const today = new Date(now)
	today.setHours(0, 0, 0, 0)

	const result: DailyCount[] = []
	for (let i = numDays - 1; i >= 0; i--) {
		const date = new Date(today)
		date.setDate(date.getDate() - i)
		const label = dateKey(date)
		result.push({ date, count: counts[label] ?? 0, label })
	}
	return result
}

export function calculateTrendPct(current: number, previous: number, range: TimeRange): number | null {
	if (daysForRange(range) === null) return null
	if (previous === 0 && current === 0) return 0
	if (previous === 0) return 100
	return Math.round(((current - previous) / previous) * 100)
}

export function calculateCompletionRate(fields: FormField[], allData: Record<string, string>[]): number {
	const requiredFields = responseFields(fields).filter(field => field.required)
	if (requiredFields.length === 0) return allData.length > 0 ? 100 : 0
	const complete = allData.filter(data => requiredFields.every(field => isFilledValue(data[field.id]))).length
	return allData.length > 0 ? Math.round((complete / allData.length) * 100) : 0
}

export function calculateAverageFillRate(fields: FormField[], allData: Record<string, string>[]): number {
	const dataFields = responseFields(fields)
	if (dataFields.length === 0 || allData.length === 0) return 0

	let totalFill = 0
	for (const field of dataFields) {
		const filled = allData.filter(data => isFilledValue(data[field.id])).length
		totalFill += filled / allData.length
	}
	return Math.round((totalFill / dataFields.length) * 100)
}

export function countActiveDays(responses: Record<string, unknown>[]): number {
	const days = new Set<string>()
	for (const response of responses) {
		if (response.submittedAt) days.add(dateKey(new Date(Number(response.submittedAt))))
	}
	return days.size
}

export function calculateAverageCompletionTime(responses: Record<string, unknown>[]): number | null {
	const durations: number[] = []
	for (const response of responses) {
		const duration = parseResponseMeta(response)?.duration
		if (duration && duration > 0 && duration < 86400) durations.push(duration)
	}
	if (durations.length === 0) return null
	return Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length)
}

export function buildNpsSummary(fields: FormField[], allData: Record<string, string>[]): NpsSummary | null {
	const npsField = fields.find(field => {
		if (field.type !== 'scale' && field.type !== 'rating') return false
		const label = field.label.toLowerCase()
		return label.includes('nps') || label.includes('recommend') || label.includes('likely')
	})
	if (!npsField) return null

	const scores = allData
		.map(data => Number(data[npsField.id]))
		.filter(score => !Number.isNaN(score) && score >= 0 && score <= 10)
	if (scores.length === 0) return null

	const promoters = scores.filter(score => score >= 9).length
	const passives = scores.filter(score => score >= 7 && score <= 8).length
	const detractors = scores.filter(score => score <= 6).length
	const nps = Math.round(((promoters - detractors) / scores.length) * 100)
	return { nps, promoters, passives, detractors, total: scores.length, fieldLabel: staticFieldLabel(npsField) }
}

export function buildFunnelData(fields: FormField[], allData: Record<string, string>[]): FunnelStep[] {
	const dataFields = responseFields(fields)
	if (dataFields.length === 0 || allData.length === 0) return []

	return dataFields.map(field => {
		const filled = allData.filter(data => isFilledValue(data[field.id])).length
		return { label: staticFieldLabel(field), filled, pct: Math.round((filled / allData.length) * 100) }
	})
}

export function buildDeviceBreakdown(responses: Record<string, unknown>[]): DeviceBreakdown {
	const browsers: Record<string, number> = {}
	const devices: Record<string, number> = {}
	const oses: Record<string, number> = {}

	for (const response of responses) {
		const ua = parseResponseMeta(response)?.ua
		if (!ua) continue
		const parsed = parseUA(ua)
		browsers[parsed.browser] = (browsers[parsed.browser] ?? 0) + 1
		devices[parsed.device] = (devices[parsed.device] ?? 0) + 1
		oses[parsed.os] = (oses[parsed.os] ?? 0) + 1
	}

	return {
		browsers: sortBreakdown(browsers),
		devices: sortBreakdown(devices),
		oses: sortBreakdown(oses),
		hasData: Object.keys(browsers).length > 0,
	}
}

export function buildCompletionSparkline(
	fields: FormField[],
	responses: Record<string, unknown>[],
	allData: Record<string, string>[],
	dailyCounts: DailyCount[],
): number[] {
	const requiredFields = responseFields(fields).filter(field => field.required)
	const last7 = dailyCounts.slice(-7)
	if (requiredFields.length === 0) return last7.map(day => (day.count > 0 ? 100 : 0))

	const byDay = groupDataByResponseDay(responses, allData)
	return last7.map(day => {
		const dayResponses = byDay[day.label] ?? []
		if (dayResponses.length === 0) return 0
		const complete = dayResponses.filter(data => requiredFields.every(field => isFilledValue(data[field.id]))).length
		return Math.round((complete / dayResponses.length) * 100)
	})
}

export function buildFillRateSparkline(
	fields: FormField[],
	responses: Record<string, unknown>[],
	allData: Record<string, string>[],
	dailyCounts: DailyCount[],
): number[] {
	const dataFields = responseFields(fields)
	const byDay = groupDataByResponseDay(responses, allData)
	return dailyCounts.slice(-7).map(day => {
		const dayResponses = byDay[day.label] ?? []
		if (dayResponses.length === 0 || dataFields.length === 0) return 0
		let totalFill = 0
		for (const field of dataFields) {
			const filled = dayResponses.filter(data => isFilledValue(data[field.id])).length
			totalFill += filled / dayResponses.length
		}
		return Math.round((totalFill / dataFields.length) * 100)
	})
}

function groupDataByResponseDay(
	responses: Record<string, unknown>[],
	allData: Record<string, string>[],
): Record<string, Record<string, string>[]> {
	const byDay: Record<string, Record<string, string>[]> = {}
	for (let index = 0; index < responses.length; index++) {
		const response = responses[index]
		if (!response?.submittedAt) continue
		const key = dateKey(new Date(Number(response.submittedAt)))
		byDay[key] ??= []
		const data = allData[index]
		if (data) byDay[key].push(data)
	}
	return byDay
}

function sortBreakdown(obj: Record<string, number>): [string, number][] {
	return Object.entries(obj).sort((a, b) => b[1] - a[1]) as [string, number][]
}
