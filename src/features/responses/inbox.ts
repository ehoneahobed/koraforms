import type { FormField } from '../../types'
import {
	isFilledValue,
	median,
	parseResponseData,
	parseResponseMeta,
	parseUA,
	responseCompletionPct,
	responseFields,
} from './utils'

export interface CompletionStats {
	complete: number
	partial: number
	rate: number
	dropOff: number
}

export interface FieldFillSummary {
	field: FormField
	filled: number
	missing: number
	pct: number
}

export interface ResponseOverviewSummary {
	lastResponseAt: number | null
	avgDuration: number | null
	medianDuration: number | null
	mobilePct: number | null
	lowFillFields: FieldFillSummary[]
	requiredGaps: { field: FormField; missing: number }[]
	topField: FieldFillSummary | null
}

export interface ParsedResponseRecord {
	response: Record<string, unknown>
	data: Record<string, string>
	meta: ReturnType<typeof parseResponseMeta>
	completion: number
}

export interface FollowUpReview {
	incomplete: (ParsedResponseRecord & { missingFields: FormField[] })[]
	slow: ParsedResponseRecord[]
	lowFillFields: FieldFillSummary[]
	duplicateGroups: { field: FormField; value: string; responses: Record<string, unknown>[] }[]
	slowThreshold: number
}

export function buildCompletionStats(fields: FormField[], responses: Record<string, unknown>[]): CompletionStats {
	const requiredFields = responseFields(fields).filter(field => field.required)
	let complete = 0
	let partial = 0

	for (const response of responses) {
		const data = parseResponseData(response)
		if (requiredFields.length === 0 || requiredFields.every(field => isFilledValue(data[field.id]))) {
			complete++
		} else {
			partial++
		}
	}

	const rate = responses.length > 0 ? Math.round((complete / responses.length) * 100) : 0
	return { complete, partial, rate, dropOff: partial }
}

export function buildResponseOverview(fields: FormField[], responses: Record<string, unknown>[]): ResponseOverviewSummary {
	const dataFields = responseFields(fields)
	const parsed = parseResponsesForReview(fields, responses)
	const durations = validDurations(parsed)
	const devices = parsed.map(item => item.meta?.ua ? parseUA(item.meta.ua).device : null).filter(Boolean)
	const mobileCount = devices.filter(device => device === 'Mobile').length
	const fillByField = buildFieldFillSummaries(dataFields, parsed, responses.length)
	const requiredGaps = dataFields
		.filter(field => field.required)
		.map(field => ({
			field,
			missing: parsed.filter(item => !isFilledValue(item.data[field.id])).length,
		}))
		.filter(item => item.missing > 0)
		.sort((a, b) => b.missing - a.missing)

	return {
		lastResponseAt: responses[0]?.submittedAt ? Number(responses[0].submittedAt) : null,
		avgDuration: durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
		medianDuration: durations.length > 0 ? Math.round(median(durations)) : null,
		mobilePct: devices.length > 0 ? Math.round((mobileCount / devices.length) * 100) : null,
		lowFillFields: fillByField.filter(item => item.pct < 80).sort((a, b) => a.pct - b.pct),
		requiredGaps,
		topField: [...fillByField].sort((a, b) => b.pct - a.pct)[0] || null,
	}
}

export function buildFollowUpReview(fields: FormField[], responses: Record<string, unknown>[]): FollowUpReview {
	const dataFields = responseFields(fields)
	const requiredFields = dataFields.filter(field => field.required)
	const parsed = parseResponsesForReview(fields, responses)
	const incomplete = parsed
		.map(item => ({
			...item,
			missingFields: requiredFields.filter(field => !isFilledValue(item.data[field.id])),
		}))
		.filter(item => item.missingFields.length > 0)
		.slice(0, 8)

	const durations = validDurations(parsed)
	const slowThreshold = durations.length > 0 ? Math.max(300, median(durations) * 1.75) : 300
	const slow = parsed
		.filter(item => typeof item.meta?.duration === 'number' && item.meta.duration > slowThreshold)
		.sort((a, b) => (Number(b.meta?.duration) || 0) - (Number(a.meta?.duration) || 0))
		.slice(0, 6)

	const lowFillFields = buildFieldFillSummaries(dataFields, parsed, responses.length)
		.filter(item => item.pct < 75)
		.sort((a, b) => a.pct - b.pct)
		.slice(0, 6)

	const identityFields = dataFields.filter(field => ['email', 'phone'].includes(field.type) || /email|phone|name/i.test(field.label))
	const duplicateGroups = identityFields.flatMap(field => {
		const counts = new Map<string, Record<string, unknown>[]>()
		for (const item of parsed) {
			const value = item.data[field.id]?.trim().toLowerCase()
			if (!value) continue
			counts.set(value, [...(counts.get(value) || []), item.response])
		}
		return Array.from(counts.entries())
			.filter(([, items]) => items.length > 1)
			.map(([value, items]) => ({ field, value, responses: items }))
	}).slice(0, 6)

	return { incomplete, slow, lowFillFields, duplicateGroups, slowThreshold }
}

function parseResponsesForReview(fields: FormField[], responses: Record<string, unknown>[]): ParsedResponseRecord[] {
	return responses.map(response => {
		const data = parseResponseData(response)
		return {
			response,
			data,
			meta: parseResponseMeta(response),
			completion: responseCompletionPct(fields, data),
		}
	})
}

function validDurations(parsed: ParsedResponseRecord[]): number[] {
	return parsed
		.map(item => item.meta?.duration)
		.filter((value): value is number => typeof value === 'number' && value > 0 && value < 86400)
}

function buildFieldFillSummaries(
	fields: FormField[],
	parsed: ParsedResponseRecord[],
	totalResponses: number,
): FieldFillSummary[] {
	return fields.map(field => {
		const filled = parsed.filter(item => isFilledValue(item.data[field.id])).length
		return {
			field,
			filled,
			missing: Math.max(0, totalResponses - filled),
			pct: totalResponses > 0 ? Math.round((filled / totalResponses) * 100) : 0,
		}
	})
}
