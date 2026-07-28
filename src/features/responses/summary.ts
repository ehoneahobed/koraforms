import type { FormField } from '../../types'
import { computeCrossInsights, type CrossInsight } from '../../utils/analytics'
import {
	dateKey,
	daysForRange,
	isFilledValue,
	parseResponseData,
	parseResponseMeta,
	parseUA,
	responseCompletionPct,
	responseFields,
	staticFieldLabel,
	startOfDaysAgo,
	type TimeRange,
} from './utils'

export interface ResponseFilter {
	fieldId: string
	value: string
}

export interface ResponseDateFilter {
	from?: string
	to?: string
}

export type ResponseFieldFilterOperator = 'contains' | 'equals' | 'present' | 'missing'
export type ResponseCompletionFilter = 'all' | 'complete' | 'partial'

export interface ResponseFieldFilter {
	fieldId: string
	operator: ResponseFieldFilterOperator
	value?: string
}

export interface ResponseAdvancedFilters {
	completion: ResponseCompletionFilter
	fieldFilters: ResponseFieldFilter[]
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

export interface RespondentLifecycleSummary {
	totalViews: number
	uniqueViewers: number
	started: number
	completed: number
	partial: number
	abandoned: number
	viewToStartRate: number
	startToCompleteRate: number
	uniqueCompletionRate: number
	dropOffQuestionIndex: number | null
	dropOffAnsweredCount: number | null
}

export interface FieldJourneyStep {
	field: FormField
	index: number
	label: string
	fieldType: string
	reached: number
	answered: number
	skipped: number
	abandoned: number
	answerRate: number
	abandonRate: number
	impact: 'low' | 'medium' | 'high'
}

export interface FormVersionAnalytics {
	versionHash: string
	label: string
	isCurrent: boolean
	views: number
	starts: number
	submissions: number
	responses: number
	partialSessions: number
	conversionRate: number
	firstSeenAt: number
	lastSeenAt: number
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
	lifecycle: RespondentLifecycleSummary
	fieldJourney: FieldJourneyStep[]
	formVersions: FormVersionAnalytics[]
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
	analyticsEvents: Record<string, unknown>[] = [],
): ResponsesAnalyticsSummary {
	const filteredResponses = filterResponses(responses, range, filters)
	const filteredEvents = filterAnalyticsEventsByRange(analyticsEvents, range)
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
		lifecycle: buildRespondentLifecycleSummary(filteredEvents, filteredResponses),
		fieldJourney: buildFieldJourneySummary(fields, filteredEvents, filteredResponses),
		formVersions: buildFormVersionAnalytics(filteredResponses, filteredEvents),
		crossInsights: computeCrossInsights(fields, responseData),
		completionSparkline: buildCompletionSparkline(fields, filteredResponses, responseData, dailyCounts),
		fillRateSparkline: buildFillRateSparkline(fields, filteredResponses, responseData, dailyCounts),
	}
}

export function buildRespondentLifecycleSummary(
	events: Record<string, unknown>[],
	responses: Record<string, unknown>[],
	now = Date.now(),
	abandonAfterMs = 30 * 60 * 1000,
): RespondentLifecycleSummary {
	const viewedEvents = events.filter(event => event.type === 'viewed_form')
	const startedEvents = events.filter(event => event.type === 'started_form')
	const submittedEvents = events.filter(event => event.type === 'submitted_form')
	const bySession = new Map<string, Record<string, unknown>[]>()
	for (const event of events) {
		const sessionId = String(event.sessionId || '')
		if (!sessionId) continue
		bySession.set(sessionId, [...(bySession.get(sessionId) ?? []), event])
	}

	let partial = 0
	let abandoned = 0
	const dropOffCounts = new Map<number, number>()
	for (const sessionEvents of bySession.values()) {
		const started = sessionEvents.some(event => event.type === 'started_form')
		const submitted = sessionEvents.some(event => event.type === 'submitted_form')
		const eventTimes = sessionEvents.map(event => Number(event.occurredAt || 0)).filter(Number.isFinite)
		const answerCounts = sessionEvents.map(event => Number(event.answeredCount || 0)).filter(Number.isFinite)
		const lastEventAt = eventTimes.length > 0 ? Math.max(...eventTimes) : 0
		const answeredCount = answerCounts.length > 0 ? Math.max(0, ...answerCounts) : 0
		if (started && !submitted && answeredCount > 0) partial += 1
		if (started && !submitted && lastEventAt > 0 && now - lastEventAt >= abandonAfterMs) {
			abandoned += 1
			dropOffCounts.set(answeredCount, (dropOffCounts.get(answeredCount) ?? 0) + 1)
		}
	}

	const completed = Math.max(submittedEvents.length, responses.length)
	const started = Math.max(startedEvents.length, completed)
	const totalViews = Math.max(viewedEvents.length, started)
	const uniqueViewers = Math.max(uniqueCount(viewedEvents, 'visitorKey'), uniqueCount(startedEvents, 'visitorKey'), completed)
	const dropOff = [...dropOffCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
	return {
		totalViews,
		uniqueViewers,
		started,
		completed,
		partial,
		abandoned,
		viewToStartRate: totalViews > 0 ? Math.round((started / totalViews) * 100) : 0,
		startToCompleteRate: started > 0 ? Math.round((completed / started) * 100) : 0,
		uniqueCompletionRate: uniqueViewers > 0 ? Math.round((completed / uniqueViewers) * 100) : 0,
		dropOffQuestionIndex: dropOff ? dropOff[0] : null,
		dropOffAnsweredCount: dropOff ? dropOff[0] : null,
	}
}

export function buildFieldJourneySummary(
	fields: FormField[],
	events: Record<string, unknown>[],
	responses: Record<string, unknown>[],
	now = Date.now(),
	abandonAfterMs = 30 * 60 * 1000,
): FieldJourneyStep[] {
	const dataFields = responseFields(fields)
	const fieldIndex = new Map(dataFields.map((field, index) => [field.id, index]))
	const steps = dataFields.map((field, index) => ({
		field,
		index,
		label: staticFieldLabel(field),
		fieldType: field.type,
		reached: 0,
		answered: 0,
		skipped: 0,
		abandoned: 0,
		answerRate: 0,
		abandonRate: 0,
		impact: 'low' as FieldJourneyStep['impact'],
	}))

	if (steps.length === 0) return []

	const acceptedResponseData = responses.map(parseResponseData)
	const acceptedFilledCounts = dataFields.map(field => {
		return acceptedResponseData.filter(data => isFilledValue(data[field.id])).length
	})

	const sessions = groupEventsBySession(events)
	for (const sessionEvents of sessions.values()) {
		const submitted = sessionEvents.some(event => event.type === 'submitted_form')
		const started = sessionEvents.some(event => event.type === 'started_form')
		if (!started) continue

		const latestAnswerIndex = maxEventIndex(sessionEvents, fieldIndex)
		const maxQuestionIndex = Math.max(0, ...sessionEvents.map(event => Number(event.questionIndex ?? -1)).filter(Number.isFinite))
		const reachedIndex = Math.min(steps.length - 1, Math.max(latestAnswerIndex, maxQuestionIndex, 0))
		for (let index = 0; index <= reachedIndex; index += 1) {
			steps[index]!.reached += 1
		}

		for (const event of sessionEvents) {
			if (event.type !== 'answered_question') continue
			const fieldId = String(event.fieldId || '')
			const index = fieldIndex.get(fieldId)
			if (index !== undefined) steps[index]!.answered += 1
		}

		const eventTimes = sessionEvents.map(event => Number(event.occurredAt || 0)).filter(Number.isFinite)
		const lastEventAt = eventTimes.length > 0 ? Math.max(...eventTimes) : 0
		if (!submitted && lastEventAt > 0 && now - lastEventAt >= abandonAfterMs) {
			const abandonedIndex = Math.min(steps.length - 1, Math.max(latestAnswerIndex + 1, reachedIndex))
			if (abandonedIndex > reachedIndex) steps[abandonedIndex]!.reached += 1
			steps[abandonedIndex]!.abandoned += 1
		}
	}

	return steps.map(step => {
		const reached = Math.max(responses.length, step.reached)
		const answered = Math.min(reached, Math.max(acceptedFilledCounts[step.index] ?? 0, step.answered))
		const skipped = Math.max(0, reached - answered)
		const answerRate = reached > 0 ? Math.round((answered / reached) * 100) : 0
		const abandonRate = reached > 0 ? Math.round((step.abandoned / reached) * 100) : 0
		const impact = abandonRate >= 20 || answerRate < 60 ? 'high' : abandonRate >= 10 || answerRate < 80 ? 'medium' : 'low'
		return { ...step, reached, answered, skipped, answerRate, abandonRate, impact }
	})
}

export function buildFormVersionAnalytics(
	responses: Record<string, unknown>[],
	events: Record<string, unknown>[],
	currentVersionHash?: string,
): FormVersionAnalytics[] {
	const versions = new Map<string, {
		versionHash: string
		views: number
		starts: number
		submissions: number
		responses: number
		sessionIds: Set<string>
		submittedSessionIds: Set<string>
		firstSeenAt: number
		lastSeenAt: number
	}>()

	const entryFor = (versionHash: string) => {
		const normalized = versionHash.trim() || 'unversioned'
		let entry = versions.get(normalized)
		if (!entry) {
			entry = {
				versionHash: normalized,
				views: 0,
				starts: 0,
				submissions: 0,
				responses: 0,
				sessionIds: new Set<string>(),
				submittedSessionIds: new Set<string>(),
				firstSeenAt: 0,
				lastSeenAt: 0,
			}
			versions.set(normalized, entry)
		}
		return entry
	}

	const rememberActivity = (entry: ReturnType<typeof entryFor>, timestamp: number) => {
		if (!Number.isFinite(timestamp) || timestamp <= 0) return
		entry.firstSeenAt = entry.firstSeenAt === 0 ? timestamp : Math.min(entry.firstSeenAt, timestamp)
		entry.lastSeenAt = Math.max(entry.lastSeenAt, timestamp)
	}

	for (const event of events) {
		const versionHash = String(event.formVersionHash || '')
		const entry = entryFor(versionHash)
		const type = String(event.type || '')
		const sessionId = String(event.sessionId || '')
		if (sessionId) entry.sessionIds.add(sessionId)
		if (type === 'viewed_form') entry.views += 1
		if (type === 'started_form') entry.starts += 1
		if (type === 'submitted_form') {
			entry.submissions += 1
			if (sessionId) entry.submittedSessionIds.add(sessionId)
		}
		rememberActivity(entry, Number(event.occurredAt || event.updatedAt || 0))
	}

	for (const response of responses) {
		const versionHash = String(response.formVersionHash || '')
		const entry = entryFor(versionHash)
		entry.responses += 1
		entry.submissions = Math.max(entry.submissions, entry.responses)
		rememberActivity(entry, Number(response.submittedAt || 0))
	}

	const latestVersionHash = currentVersionHash
		? currentVersionHash.trim()
		: [...versions.values()]
			.filter(version => version.versionHash !== 'unversioned')
			.sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0]?.versionHash || ''

	return [...versions.values()]
		.sort((a, b) => b.lastSeenAt - a.lastSeenAt)
		.map(version => {
			const denominator = Math.max(version.starts, version.views, version.responses)
			const completed = Math.max(version.submissions, version.responses)
			return {
				versionHash: version.versionHash,
				label: version.versionHash === 'unversioned' ? 'Unversioned' : `Version ${version.versionHash.slice(0, 7)}`,
				isCurrent: latestVersionHash ? version.versionHash === latestVersionHash : false,
				views: version.views,
				starts: version.starts,
				submissions: version.submissions,
				responses: version.responses,
				partialSessions: Math.max(0, version.sessionIds.size - version.submittedSessionIds.size),
				conversionRate: denominator > 0 ? Math.round((completed / denominator) * 100) : 0,
				firstSeenAt: version.firstSeenAt,
				lastSeenAt: version.lastSeenAt,
			}
		})
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

export function filterResponsesByDateRange<T extends Record<string, unknown>>(
	responses: T[],
	dateFilter: ResponseDateFilter,
): T[] {
	const from = parseDateBoundary(dateFilter.from, 'start')
	const to = parseDateBoundary(dateFilter.to, 'end')
	if (from === null && to === null) return responses
	return responses.filter(response => {
		const submittedAt = Number(response.submittedAt || 0)
		if (!Number.isFinite(submittedAt) || submittedAt <= 0) return false
		if (from !== null && submittedAt < from) return false
		if (to !== null && submittedAt > to) return false
		return true
	})
}

export function normalizeCompletionFilter(value: string | null | undefined): ResponseCompletionFilter {
	if (value === 'complete' || value === 'partial') return value
	return 'all'
}

export function encodeFieldFilters(filters: readonly ResponseFieldFilter[]): string {
	const normalized = normalizeFieldFilters(filters)
	return normalized.length > 0 ? encodeURIComponent(JSON.stringify(normalized)) : ''
}

export function decodeFieldFilters(value: string | null | undefined): ResponseFieldFilter[] {
	if (!value) return []
	try {
		const parsed = JSON.parse(decodeURIComponent(value))
		if (!Array.isArray(parsed)) return []
		return normalizeFieldFilters(parsed)
	} catch {
		return []
	}
}

export function activeResponseFilterCount(filters: ResponseAdvancedFilters): number {
	return filters.fieldFilters.length + (filters.completion === 'all' ? 0 : 1)
}

export function filterResponsesByAdvancedFilters<T extends Record<string, unknown>>(
	fields: FormField[],
	responses: T[],
	filters: ResponseAdvancedFilters,
): T[] {
	const normalized = {
		completion: normalizeCompletionFilter(filters.completion),
		fieldFilters: normalizeFieldFilters(filters.fieldFilters),
	}
	if (activeResponseFilterCount(normalized) === 0) return responses

	return responses.filter(response => {
		const data = parseResponseData(response)
		if (normalized.completion !== 'all') {
			const complete = responseCompletionPct(fields, data) === 100
			if (normalized.completion === 'complete' && !complete) return false
			if (normalized.completion === 'partial' && complete) return false
		}

		return normalized.fieldFilters.every(filter => {
			const raw = data[filter.fieldId] ?? ''
			const value = normalizeFilterValue(raw)
			const expected = normalizeFilterValue(filter.value ?? '')
			if (filter.operator === 'present') return isFilledValue(raw)
			if (filter.operator === 'missing') return !isFilledValue(raw)
			if (filter.operator === 'equals') return value === expected
			return value.includes(expected)
		})
	})
}

export function responseDateFilterLabel(dateFilter: ResponseDateFilter): string {
	const from = parseDateBoundary(dateFilter.from, 'start')
	const to = parseDateBoundary(dateFilter.to, 'end')
	if (from === null && to === null) return ''
	const format = (timestamp: number) => new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
	if (from !== null && to !== null) return `${format(from)} - ${format(to)}`
	if (from !== null) return `From ${format(from)}`
	return `Until ${format(to!)}`
}

export function presetDateFilter(preset: 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth', now = new Date()): ResponseDateFilter {
	const today = new Date(now)
	today.setHours(0, 0, 0, 0)
	if (preset === 'today') return { from: dateKey(today), to: dateKey(today) }
	if (preset === 'yesterday') {
		const date = new Date(today)
		date.setDate(date.getDate() - 1)
		return { from: dateKey(date), to: dateKey(date) }
	}
	if (preset === '7d' || preset === '30d') {
		const date = new Date(today)
		date.setDate(date.getDate() - (preset === '7d' ? 6 : 29))
		return { from: dateKey(date), to: dateKey(today) }
	}
	if (preset === 'month') {
		const from = new Date(today.getFullYear(), today.getMonth(), 1)
		return { from: dateKey(from), to: dateKey(today) }
	}
	const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
	const to = new Date(today.getFullYear(), today.getMonth(), 0)
	return { from: dateKey(from), to: dateKey(to) }
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

function normalizeFieldFilters(filters: readonly unknown[]): ResponseFieldFilter[] {
	const result: ResponseFieldFilter[] = []
	for (const filter of filters) {
		if (!filter || typeof filter !== 'object') continue
		const candidate = filter as Partial<ResponseFieldFilter>
		const fieldId = String(candidate.fieldId || '').trim()
		const operator = normalizeFieldFilterOperator(candidate.operator)
		if (!fieldId || !operator) continue
		const value = String(candidate.value ?? '').trim().slice(0, 160)
		if ((operator === 'contains' || operator === 'equals') && !value) continue
		result.push({
			fieldId: fieldId.slice(0, 120),
			operator,
			...(value ? { value } : {}),
		})
		if (result.length >= 10) break
	}
	return result
}

function normalizeFieldFilterOperator(value: unknown): ResponseFieldFilterOperator | null {
	if (value === 'contains' || value === 'equals' || value === 'present' || value === 'missing') return value
	return null
}

function normalizeFilterValue(value: unknown): string {
	return String(value ?? '').trim().toLocaleLowerCase()
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

export function filterAnalyticsEventsByRange(
	events: Record<string, unknown>[],
	range: TimeRange,
): Record<string, unknown>[] {
	const days = daysForRange(range)
	if (days === null) return events
	const cutoff = startOfDaysAgo(days)
	return events.filter(event => {
		const occurredAt = Number(event.occurredAt || 0)
		return Number.isFinite(occurredAt) && occurredAt >= cutoff
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

function uniqueCount(events: Record<string, unknown>[], field: string): number {
	const values = new Set<string>()
	for (const event of events) {
		const value = String(event[field] || '')
		if (value) values.add(value)
	}
	return values.size
}

function groupEventsBySession(events: Record<string, unknown>[]): Map<string, Record<string, unknown>[]> {
	const sessions = new Map<string, Record<string, unknown>[]>()
	for (const event of events) {
		const sessionId = String(event.sessionId || '')
		if (!sessionId) continue
		sessions.set(sessionId, [...(sessions.get(sessionId) ?? []), event])
	}
	return sessions
}

function maxEventIndex(events: Record<string, unknown>[], fieldIndex: Map<string, number>): number {
	let maxIndex = -1
	for (const event of events) {
		const fieldId = String(event.fieldId || '')
		const byField = fieldIndex.get(fieldId)
		if (byField !== undefined) maxIndex = Math.max(maxIndex, byField)
		const byQuestion = Number(event.questionIndex ?? -1)
		if (Number.isFinite(byQuestion)) maxIndex = Math.max(maxIndex, byQuestion)
	}
	return maxIndex
}

function parseDateBoundary(value: string | undefined, boundary: 'start' | 'end'): number | null {
	if (!value) return null
	const parts = value.split('-').map(Number)
	if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return null
	const [year, month, day] = parts as [number, number, number]
	const date = new Date(year, month - 1, day)
	if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
	date.setHours(boundary === 'start' ? 0 : 23, boundary === 'start' ? 0 : 59, boundary === 'start' ? 0 : 59, boundary === 'start' ? 0 : 999)
	return date.getTime()
}
