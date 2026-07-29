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
	qualitySignals: ResponseQualitySignal[]
	slowThreshold: number
}

export interface ResponseQualitySignal {
	id: string
	responseId: string
	severity: 'info' | 'watch' | 'review'
	type: 'incomplete' | 'duplicate_identity' | 'duplicate_payload' | 'duplicate_device' | 'fast_submit' | 'slow_submit' | 'low_completion' | 'repeated_values' | 'attachment_review'
	title: string
	detail: string
	action: string
	fieldIds: string[]
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
			const value = normalizeIdentityValue(field, item.data[field.id])
			if (!value) continue
			counts.set(value, [...(counts.get(value) || []), item.response])
		}
		return Array.from(counts.entries())
			.filter(([, items]) => items.length > 1)
			.map(([value, items]) => ({ field, value, responses: items }))
	}).slice(0, 6)

	const qualitySignals = buildResponseQualitySignals(fields, parsed, slowThreshold)

	return { incomplete, slow, lowFillFields, duplicateGroups, qualitySignals, slowThreshold }
}

export function buildResponseQualitySignals(
	fields: FormField[],
	parsed: ParsedResponseRecord[],
	slowThreshold: number | null = null,
): ResponseQualitySignal[] {
	const dataFields = responseFields(fields)
	const requiredFields = dataFields.filter(field => field.required)
	const durations = validDurations(parsed)
	const medianDuration = durations.length > 0 ? median(durations) : 0
	const slowLimit = slowThreshold ?? (durations.length > 0 ? Math.max(300, medianDuration * 1.75) : 300)
	const fastLimit = Math.max(3, Math.min(20, dataFields.length * 2))
	const identityFields = dataFields.filter(field => ['email', 'phone'].includes(field.type) || /email|phone|name/i.test(field.label))
	const duplicateIdentityValues = new Set<string>()
	for (const field of identityFields) {
		const counts = new Map<string, number>()
		for (const item of parsed) {
			const value = normalizeIdentityValue(field, item.data[field.id])
			if (!value) continue
			counts.set(`${field.id}:${value}`, (counts.get(`${field.id}:${value}`) ?? 0) + 1)
		}
		for (const [key, count] of counts) {
			if (count > 1) duplicateIdentityValues.add(key)
		}
	}

	const payloadCounts = new Map<string, number>()
	for (const item of parsed) {
		const payload = responsePayloadFingerprint(dataFields, item.data)
		if (!payload) continue
		payloadCounts.set(payload, (payloadCounts.get(payload) ?? 0) + 1)
	}

	const deviceCounts = new Map<string, number>()
	for (const item of parsed) {
		const fingerprint = responseDeviceFingerprint(item)
		if (!fingerprint) continue
		deviceCounts.set(fingerprint, (deviceCounts.get(fingerprint) ?? 0) + 1)
	}

	const signals: ResponseQualitySignal[] = []
	for (const item of parsed) {
		const responseId = String(item.response.id || '')
		if (!responseId) continue
		const missingFields = requiredFields.filter(field => !isFilledValue(item.data[field.id]))
		if (missingFields.length > 0) {
			signals.push({
				id: `${responseId}:incomplete`,
				responseId,
				severity: 'review',
				type: 'incomplete',
				title: 'Missing required answers',
				detail: missingFields.map(field => field.label || field.id).join(', '),
				action: 'Review before using this submission in reports.',
				fieldIds: missingFields.map(field => field.id),
			})
		}

		const duplicateIdentityField = identityFields.find(field => {
			const value = normalizeIdentityValue(field, item.data[field.id])
			return Boolean(value && duplicateIdentityValues.has(`${field.id}:${value}`))
		})
		if (duplicateIdentityField) {
			signals.push({
				id: `${responseId}:duplicate-identity:${duplicateIdentityField.id}`,
				responseId,
				severity: 'watch',
				type: 'duplicate_identity',
				title: 'Possible duplicate respondent',
				detail: `${duplicateIdentityField.label || duplicateIdentityField.id} appears in more than one response.`,
				action: 'Open nearby responses and confirm whether this is intentional.',
				fieldIds: [duplicateIdentityField.id],
			})
		}

		const fingerprint = responsePayloadFingerprint(dataFields, item.data)
		if (fingerprint && (payloadCounts.get(fingerprint) ?? 0) > 1) {
			signals.push({
				id: `${responseId}:duplicate-payload`,
				responseId,
				severity: 'watch',
				type: 'duplicate_payload',
				title: 'Repeated answer pattern',
				detail: 'This response has the same answer set as another submission.',
				action: 'Check whether the respondent submitted twice or copied a previous entry.',
				fieldIds: dataFields.map(field => field.id),
			})
		}

		const deviceFingerprint = responseDeviceFingerprint(item)
		if (deviceFingerprint && (deviceCounts.get(deviceFingerprint) ?? 0) > 1 && item.completion >= 80) {
			const parsedUA = item.meta?.ua ? parseUA(item.meta.ua) : null
			signals.push({
				id: `${responseId}:duplicate-device`,
				responseId,
				severity: 'info',
				type: 'duplicate_device',
				title: 'Same device pattern',
				detail: `${deviceCounts.get(deviceFingerprint)} completed responses share ${parsedUA ? `${parsedUA.browser} on ${parsedUA.os}` : 'the same browser'} and screen profile.`,
				action: 'Useful when investigating repeated submissions from shared devices.',
				fieldIds: [],
			})
		}

		const duration = item.meta?.duration
		if (typeof duration === 'number' && duration > 0 && duration < fastLimit && item.completion >= 80 && dataFields.length >= 3) {
			signals.push({
				id: `${responseId}:fast-submit`,
				responseId,
				severity: 'watch',
				type: 'fast_submit',
				title: 'Unusually fast completion',
				detail: `Completed in ${duration}s across ${dataFields.length} fields.`,
				action: 'Spot-check this response before acting on it.',
				fieldIds: [],
			})
		}

		if (typeof duration === 'number' && duration > slowLimit) {
			signals.push({
				id: `${responseId}:slow-submit`,
				responseId,
				severity: 'info',
				type: 'slow_submit',
				title: 'Long completion time',
				detail: `Took ${Math.round(duration)}s, above the current review threshold.`,
				action: 'Look for fields that may need clearer wording.',
				fieldIds: [],
			})
		}

		if (item.completion < 75) {
			signals.push({
				id: `${responseId}:low-completion`,
				responseId,
				severity: 'review',
				type: 'low_completion',
				title: 'Low completion',
				detail: `Only ${item.completion}% of required fields were completed.`,
				action: 'Follow up if this response matters.',
				fieldIds: requiredFields.filter(field => !isFilledValue(item.data[field.id])).map(field => field.id),
			})
		}

		const repeated = repeatedAnswerValues(dataFields, item.data)
		if (repeated.length > 0) {
			signals.push({
				id: `${responseId}:repeated-values`,
				responseId,
				severity: 'watch',
				type: 'repeated_values',
				title: 'Repeated values',
				detail: `The same value appears in ${repeated.length} fields.`,
				action: 'Check whether the answers are meaningful or placeholder text.',
				fieldIds: repeated,
			})
		}

		const attachmentFields = dataFields.filter(field => ['file', 'signature'].includes(field.type) && isFilledValue(item.data[field.id]))
		if (attachmentFields.length > 0) {
			signals.push({
				id: `${responseId}:attachments`,
				responseId,
				severity: 'info',
				type: 'attachment_review',
				title: 'Contains attachments',
				detail: `${attachmentFields.length} attachment field${attachmentFields.length === 1 ? '' : 's'} included.`,
				action: 'Verify the files or signature before downstream use.',
				fieldIds: attachmentFields.map(field => field.id),
			})
		}
	}

	const severityRank = { review: 0, watch: 1, info: 2 } satisfies Record<ResponseQualitySignal['severity'], number>
	return signals.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.responseId.localeCompare(b.responseId)).slice(0, 24)
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

function responsePayloadFingerprint(fields: FormField[], data: Record<string, string>): string {
	const entries = fields
		.map(field => [field.id, String(data[field.id] || '').trim().toLowerCase()] as const)
		.filter(([, value]) => value.length > 0)
	if (entries.length === 0) return ''
	return JSON.stringify(entries)
}

function normalizeIdentityValue(field: FormField, value: unknown): string {
	const text = String(value || '').trim().toLowerCase()
	if (!text) return ''
	if (field.type === 'email' || /email/i.test(field.label)) return text
	if (field.type === 'phone' || /phone|mobile|cell/i.test(field.label)) {
		const digits = text.replace(/\D/g, '')
		return digits.length >= 7 ? digits : ''
	}
	return text
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ')
}

function responseDeviceFingerprint(item: ParsedResponseRecord): string {
	const ua = typeof item.meta?.ua === 'string' ? item.meta.ua.trim() : ''
	const screen = typeof item.meta?.screen === 'string' ? item.meta.screen.trim() : ''
	const lang = typeof item.meta?.lang === 'string' ? item.meta.lang.trim().toLowerCase() : ''
	if (!ua || !screen) return ''
	return `${ua.slice(0, 180)}|${screen.slice(0, 40)}|${lang.slice(0, 16)}`
}

function repeatedAnswerValues(fields: FormField[], data: Record<string, string>): string[] {
	const byValue = new Map<string, string[]>()
	for (const field of fields) {
		if (['checkbox', 'ranking', 'file', 'signature'].includes(field.type)) continue
		const value = String(data[field.id] || '').trim().toLowerCase()
		if (!value || value.length < 3) continue
		byValue.set(value, [...(byValue.get(value) ?? []), field.id])
	}
	return [...byValue.values()].find(fieldIds => fieldIds.length >= 3) ?? []
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
