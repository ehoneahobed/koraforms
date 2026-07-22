import type { FormField } from '../types'
import { isFieldVisible } from '../types'
import { evaluateFormula } from '../utils/formula'
import { isDisplayOnlyField, isResponseField, safeJsonParse } from './forms'

export interface ResponseValidationIssue {
	fieldId: string
	message: string
}

export interface ResponseValidationResult {
	valid: boolean
	data: string
	issues: ResponseValidationIssue[]
}

export const RESPONSE_VALIDATION_LIMITS = {
	maxFields: 200,
	maxOptions: 200,
	maxMatrixRows: 50,
	maxMatrixColumns: 20,
	maxTextValueLength: 20_000,
	maxBinaryValueLength: 2 * 1024 * 1024,
	maxChoiceValueLength: 500,
} as const

export function validatePublishedResponsePayload(
	fields: FormField[],
	responseJson: string,
): ResponseValidationResult {
	const shapeIssues = validateFormShapeLimits(fields)
	if (shapeIssues.length > 0) return invalid(shapeIssues)

	const parsed = safeJsonParse<unknown>(responseJson, null)
	if (!isPlainObject(parsed)) {
		return invalid([{ fieldId: '_root', message: 'Response data must be a JSON object' }])
	}

	const rawValues = extractStringValues(parsed)
	const visibleFields = fields.filter(field => isFieldVisible(field, rawValues))
	const responseFields = visibleFields.filter(isSubmittableField)
	const knownFieldIds = new Set(fields.map(field => field.id))
	const responseFieldIds = new Set(fields.filter(isSubmittableField).map(field => field.id))
	const visibleResponseFieldIds = new Set(responseFields.map(field => field.id))
	const issues: ResponseValidationIssue[] = []
	const sanitized: Record<string, string | Record<string, unknown>> = {}

	for (const key of Object.keys(rawValues)) {
		if (key === '_meta') continue
		if (!knownFieldIds.has(key)) {
			issues.push({ fieldId: key, message: 'Unknown field' })
			continue
		}
		if (!responseFieldIds.has(key)) continue
		if (!visibleResponseFieldIds.has(key)) continue
	}

	for (const field of responseFields) {
		const rawValue = rawValues[field.id] || ''
		const value = normalizeServerValue(field, rawValue, rawValues, fields)
		const fieldIssues = validateFieldValue(field, value)
		issues.push(...fieldIssues)
		if (value || field.type === 'calculated' || field.type === 'hidden') {
			sanitized[field.id] = value
		}
	}

	const meta = parsed._meta
	if (isPlainObject(meta)) sanitized._meta = sanitizeMeta(meta)

	return {
		valid: issues.length === 0,
		data: JSON.stringify(sanitized),
		issues,
	}
}

function normalizeServerValue(
	field: FormField,
	value: string,
	values: Record<string, string>,
	fields: FormField[],
): string {
	if (field.type === 'calculated' && field.formula) {
		return evaluateFormula(field.formula, values, fields)
	}
	if (field.type === 'hidden' && field.defaultValue && !value) {
		return field.defaultValue
	}
	return value.trim()
}

function isSubmittableField(field: FormField): boolean {
	return isResponseField(field) || field.type === 'hidden'
}

function validateFieldValue(field: FormField, value: string): ResponseValidationIssue[] {
	if (isDisplayOnlyField(field)) return []

	const maxLength = valueLengthLimitForField(field)
	if (value.length > maxLength) {
		return [{ fieldId: field.id, message: 'Response value is too long' }]
	}

	if (field.required && !value) {
		return [{ fieldId: field.id, message: 'This field is required' }]
	}
	if (!value) return []

	switch (field.type) {
		case 'email':
			return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? [] : [{ fieldId: field.id, message: 'Invalid email address' }]
		case 'number':
			return /^-?\d*\.?\d+$/.test(value) ? [] : [{ fieldId: field.id, message: 'Invalid number' }]
		case 'phone':
			return value.replace(/\D/g, '').length >= 7 ? [] : [{ fieldId: field.id, message: 'Invalid phone number' }]
		case 'url':
			return /^https?:\/\/.+\..+/.test(value) ? [] : [{ fieldId: field.id, message: 'Invalid URL' }]
		case 'date':
			return isValidDateValue(value) ? [] : [{ fieldId: field.id, message: 'Invalid date' }]
		case 'time':
			return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? [] : [{ fieldId: field.id, message: 'Invalid time' }]
		case 'select':
		case 'radio':
			return validateSingleChoice(field, value)
		case 'checkbox':
			return validateMultiChoice(field, value)
		case 'yesno':
			return value === 'yes' || value === 'no' ? [] : [{ fieldId: field.id, message: 'Invalid yes/no value' }]
		case 'rating':
			return isIntegerInRange(value, 1, 5) ? [] : [{ fieldId: field.id, message: 'Invalid rating' }]
		case 'scale':
			return isIntegerInRange(value, 1, 10) ? [] : [{ fieldId: field.id, message: 'Invalid scale value' }]
		case 'ranking':
			return validateRanking(field, value)
		case 'matrix':
			return validateMatrix(field, value)
		case 'signature':
			return value.startsWith('data:image/') ? [] : [{ fieldId: field.id, message: 'Invalid signature payload' }]
		case 'file':
			return value.startsWith('data:') ? [] : [{ fieldId: field.id, message: 'Invalid file payload' }]
		default:
			return []
	}
}

function validateFormShapeLimits(fields: FormField[]): ResponseValidationIssue[] {
	const issues: ResponseValidationIssue[] = []
	if (fields.length > RESPONSE_VALIDATION_LIMITS.maxFields) {
		issues.push({ fieldId: '_form', message: `Forms can have at most ${RESPONSE_VALIDATION_LIMITS.maxFields} fields` })
	}
	for (const field of fields) {
		const optionCount = parseList(field.options).length
		if (optionCount > RESPONSE_VALIDATION_LIMITS.maxOptions) {
			issues.push({ fieldId: field.id, message: `Fields can have at most ${RESPONSE_VALIDATION_LIMITS.maxOptions} options` })
		}
		const rowCount = parseList(field.matrixRows).length
		if (rowCount > RESPONSE_VALIDATION_LIMITS.maxMatrixRows) {
			issues.push({ fieldId: field.id, message: `Matrix fields can have at most ${RESPONSE_VALIDATION_LIMITS.maxMatrixRows} rows` })
		}
		const columnCount = parseList(field.matrixColumns).length
		if (columnCount > RESPONSE_VALIDATION_LIMITS.maxMatrixColumns) {
			issues.push({ fieldId: field.id, message: `Matrix fields can have at most ${RESPONSE_VALIDATION_LIMITS.maxMatrixColumns} columns` })
		}
	}
	return issues
}

function valueLengthLimitForField(field: FormField): number {
	if (['file', 'signature'].includes(field.type)) return RESPONSE_VALIDATION_LIMITS.maxBinaryValueLength
	if (field.type === 'textarea') return RESPONSE_VALIDATION_LIMITS.maxTextValueLength
	if (['matrix', 'ranking'].includes(field.type)) return RESPONSE_VALIDATION_LIMITS.maxTextValueLength
	return RESPONSE_VALIDATION_LIMITS.maxChoiceValueLength
}

function validateSingleChoice(field: FormField, value: string): ResponseValidationIssue[] {
	const options = parseList(field.options)
	if (options.length === 0 || options.includes(value)) return []
	return [{ fieldId: field.id, message: 'Invalid option' }]
}

function validateMultiChoice(field: FormField, value: string): ResponseValidationIssue[] {
	const options = parseList(field.options)
	if (options.length === 0) return []
	const selected = parseList(value)
	const invalidOption = selected.find(option => !options.includes(option))
	return invalidOption ? [{ fieldId: field.id, message: 'Invalid option' }] : []
}

function validateRanking(field: FormField, value: string): ResponseValidationIssue[] {
	const options = parseList(field.options)
	const parsed = safeJsonParse<unknown>(value, null)
	if (!Array.isArray(parsed)) return [{ fieldId: field.id, message: 'Invalid ranking payload' }]
	const ranked = parsed.map(String)
	if (new Set(ranked).size !== ranked.length) return [{ fieldId: field.id, message: 'Ranking contains duplicates' }]
	if (options.length > 0 && ranked.some(option => !options.includes(option))) {
		return [{ fieldId: field.id, message: 'Invalid ranking option' }]
	}
	return []
}

function validateMatrix(field: FormField, value: string): ResponseValidationIssue[] {
	const rows = parseList(field.matrixRows)
	const columns = parseList(field.matrixColumns)
	const parsed = safeJsonParse<unknown>(value, null)
	if (!isPlainObject(parsed)) return [{ fieldId: field.id, message: 'Invalid matrix payload' }]
	for (const [row, answer] of Object.entries(parsed)) {
		if (rows.length > 0 && !rows.includes(row)) return [{ fieldId: field.id, message: 'Invalid matrix row' }]
		if (typeof answer !== 'string') return [{ fieldId: field.id, message: 'Invalid matrix answer' }]
		if (columns.length > 0 && !columns.includes(answer)) return [{ fieldId: field.id, message: 'Invalid matrix option' }]
	}
	return []
}

function isIntegerInRange(value: string, min: number, max: number): boolean {
	const parsed = Number(value)
	return Number.isInteger(parsed) && parsed >= min && parsed <= max
}

function isValidDateValue(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
	const date = new Date(`${value}T00:00:00.000Z`)
	return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

function parseList(value?: string): string[] {
	return String(value || '')
		.split(',')
		.map(option => option.trim())
		.filter(Boolean)
}

function extractStringValues(value: Record<string, unknown>): Record<string, string> {
	const output: Record<string, string> = {}
	for (const [key, entryValue] of Object.entries(value)) {
		if (key === '_meta') continue
		output[key] = entryValue == null ? '' : String(entryValue)
	}
	return output
}

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
	const allowed = new Set(['startedAt', 'completedAt', 'duration', 'ua', 'screen', 'lang'])
	const output: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(meta)) {
		if (!allowed.has(key)) continue
		if (typeof value === 'string' || typeof value === 'number') output[key] = value
	}
	return output
}

function invalid(issues: ResponseValidationIssue[]): ResponseValidationResult {
	return { valid: false, data: '{}', issues }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
