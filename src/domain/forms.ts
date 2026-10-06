import type { FieldType, FormField, FormSettings } from '../types'

export const DISPLAY_ONLY_FIELD_TYPES = new Set<FieldType>(['section', 'statement', 'hidden'])
export const NON_RESPONSE_FIELD_TYPES = new Set<FieldType>(['section', 'statement', 'hidden'])
export const NON_PIPEABLE_FIELD_TYPES = new Set<FieldType>(['section', 'statement', 'hidden'])

const FIELD_TYPES = new Set<FieldType>([
	'text',
	'number',
	'email',
	'phone',
	'textarea',
	'select',
	'radio',
	'checkbox',
	'date',
	'rating',
	'scale',
	'yesno',
	'time',
	'url',
	'section',
	'statement',
	'signature',
	'file',
	'calculated',
	'hidden',
	'ranking',
	'matrix',
])

export function safeJsonParse<T>(value: unknown, fallback: T): T {
	if (value == null || value === '') return fallback
	if (typeof value === 'object') return value as T
	if (typeof value !== 'string') return fallback
	try {
		return JSON.parse(value) as T
	} catch {
		return fallback
	}
}

/** How many layers of JSON-string encoding a stored json value may carry. */
const MAX_JSON_STRING_LAYERS = 3

/**
 * Reads the CONTAINER of a stored json field (a list or an object) whatever
 * encoding the row carries:
 * - beta.13 writes: the value itself;
 * - builds before beta.13 wrote JSON strings, and some legacy rows carry a JSON
 *   string of a JSON string. The beta.7 server decoded one layer when it
 *   materialized rows; the beta.13 server rebuilds rows from the operations
 *   as written, so the reader has to remove those layers.
 * Only whole strings that decode to further JSON are unwrapped, at most a few
 * layers, and only until a list or object appears. Values inside the
 * container are never touched, so a text answer that looks like JSON stays the
 * respondent's text. Returns `null` when the value is not that kind of container.
 */
export function readJsonContainer(value: unknown, kind: 'array'): unknown[] | null
export function readJsonContainer(value: unknown, kind: 'object'): Record<string, unknown> | null
export function readJsonContainer(value: unknown, kind: 'array' | 'object'): unknown[] | Record<string, unknown> | null {
	let current = value
	for (let layer = 0; layer < MAX_JSON_STRING_LAYERS && typeof current === 'string'; layer++) {
		try {
			current = JSON.parse(current)
		} catch {
			return null
		}
	}
	if (kind === 'array') return Array.isArray(current) ? current : null
	return isPlainObject(current) ? current : null
}

export function parseFormSettings(value: unknown): FormSettings {
	const parsed = readJsonContainer(value, 'object')
	// A copy: settings now arrive as objects from the store, and callers such
	// as serializeArchiveSettings modify the result.
	return parsed ? { ...parsed } as FormSettings : {}
}

/**
 * The value a `t.json` field can store, with JSON.stringify semantics: object
 * members whose value is `undefined` (or a function) are dropped and such array
 * items become `null`. Kora refuses `undefined` anywhere inside a json value
 * (SCHEMA_VALIDATION), while the UI clears an optional setting or field
 * property by assigning `undefined`. Dropping the member is what clears it:
 * the store sends the stored object as `previousData`, and a key missing from
 * the new object is removed.
 */
export function toJsonValue<T>(value: T): T {
	return stripUndefined(value) as T
}

function stripUndefined(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(item => (item === undefined || typeof item === 'function' ? null : stripUndefined(item)))
	}
	if (isPlainObject(value)) {
		const output: Record<string, unknown> = {}
		for (const [key, nested] of Object.entries(value)) {
			if (nested === undefined || typeof nested === 'function') continue
			output[key] = stripUndefined(nested)
		}
		return output
	}
	return value
}

export function serializeFormSettings(settings: FormSettings): FormSettings {
	return toJsonValue({ ...(settings || {}) })
}

export function parseFormFields(value: unknown): FormField[] {
	const parsed = readJsonContainer(value, 'array')
	if (!parsed) return []

	const fields: FormField[] = []
	for (const item of parsed) {
		const field = normalizeFormField(item)
		if (field) fields.push(field)
	}
	return fields
}

export interface ResponseMeta {
	duration?: number
	ua?: string
	screen?: string
	lang?: string
	startedAt?: number
	completedAt?: number
}

/**
 * Reads a json object field that may hold an object or, in rows written before
 * the beta.13 upgrade, a (possibly repeatedly) JSON-encoded string. Anything
 * else becomes `{}`.
 */
export function parseJsonRecord(value: unknown): Record<string, unknown> {
	const parsed = readJsonContainer(value, 'object')
	return parsed ? toJsonValue({ ...parsed }) : {}
}

export function parseResponseData(value: unknown): Record<string, string> {
	const parsed = readJsonContainer(value, 'object')
	if (!parsed) return {}

	const data: Record<string, string> = {}
	for (const [key, entryValue] of Object.entries(parsed)) {
		if (key === '_meta') continue
		data[key] = entryValue == null ? '' : String(entryValue)
	}
	return data
}

export function parseResponseMeta(value: unknown): ResponseMeta | undefined {
	const parsed = readJsonContainer(value, 'object')
	if (!parsed || !isPlainObject(parsed._meta)) return undefined
	return parsed._meta as ResponseMeta
}

export function serializeFormFields(fields: FormField[]): FormField[] {
	return fields.map(field => toJsonValue({ ...field }))
}

export function serializeJsonForTransport(value: unknown): string {
	if (typeof value === 'string') return value
	return JSON.stringify(value ?? {})
}

export function isDisplayOnlyField(field: Pick<FormField, 'type'>): boolean {
	return DISPLAY_ONLY_FIELD_TYPES.has(field.type)
}

export function isResponseField(field: Pick<FormField, 'type'>): boolean {
	return !NON_RESPONSE_FIELD_TYPES.has(field.type)
}

export function isPipeableField(field: Pick<FormField, 'type'>): boolean {
	return !NON_PIPEABLE_FIELD_TYPES.has(field.type)
}

export function getInputFields(fields: FormField[]): FormField[] {
	return fields.filter(field => !isDisplayOnlyField(field))
}

export function getResponseFields(fields: FormField[]): FormField[] {
	return fields.filter(isResponseField)
}

export function getPipeableFields(fields: FormField[]): FormField[] {
	return fields.filter(isPipeableField)
}

export function createFieldId(): string {
	const random = globalThis.crypto?.randomUUID?.()
	if (random) return `field_${random.replace(/-/g, '').slice(0, 12)}`
	return `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeFormField(value: unknown): FormField | null {
	if (!isPlainObject(value)) return null
	const type = value.type
	if (typeof type !== 'string' || !FIELD_TYPES.has(type as FieldType)) return null
	const id = typeof value.id === 'string' && value.id.trim() ? value.id : createFieldId()

	return {
		...value,
		id,
		type: type as FieldType,
		label: typeof value.label === 'string' ? value.label : '',
		required: value.required === true,
	} as FormField
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
