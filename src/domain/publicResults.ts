import type { FormField, FormSettings } from '../types'
import { parseResponseData } from './forms'

export type PublicResultsMode = 'summary' | 'summary_text'

export interface PublicResultsDisplaySettings {
	mode: PublicResultsMode
	showEmptyFields: boolean
	showRespondentCount: boolean
}

const AGGREGATE_FIELD_TYPES = new Set(['radio', 'select', 'checkbox', 'yesno', 'rating', 'scale', 'number', 'date', 'time'])
const TEXT_FIELD_TYPES = new Set(['text', 'textarea'])

export function publicResultsDisplaySettings(settings: Pick<FormSettings, 'publicResultsMode' | 'publicResultsShowEmpty' | 'publicResultsShowRespondentCount'>): PublicResultsDisplaySettings {
	return {
		mode: settings.publicResultsMode === 'summary_text' ? 'summary_text' : 'summary',
		showEmptyFields: settings.publicResultsShowEmpty === true,
		showRespondentCount: settings.publicResultsShowRespondentCount !== false,
	}
}

export function isPublicResultsFieldVisible(field: FormField, settings: PublicResultsDisplaySettings): boolean {
	if (AGGREGATE_FIELD_TYPES.has(field.type)) return true
	if (settings.mode === 'summary_text' && TEXT_FIELD_TYPES.has(field.type)) return true
	return false
}

export function sanitizePublicResultsResponseData(
	fields: readonly FormField[],
	responseData: unknown,
	settings: PublicResultsDisplaySettings,
): Record<string, string> {
	const data = typeof responseData === 'string' ? parseResponseData(responseData) : stringifyResponseData(responseData)
	const output: Record<string, string> = {}
	for (const field of fields) {
		if (!isPublicResultsFieldVisible(field, settings)) continue
		const value = String(data[field.id] || '').trim()
		if (value) output[field.id] = value
	}
	return output
}

function stringifyResponseData(value: unknown): Record<string, string> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
	const output: Record<string, string> = {}
	for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
		if (key === '_meta') continue
		output[key] = item == null ? '' : String(item)
	}
	return output
}
