import { FIELD_TYPES, type FieldType, type FormField, type FormSettings } from '../../types'
import { createFieldId, parseFormFields, parseFormSettings, safeJsonParse } from '../../domain/forms'

export interface ImportedFormFile {
	koraforms?: boolean
	title?: unknown
	description?: unknown
	fields?: unknown
	theme?: unknown
	settings?: unknown
}

export interface ImportedFormData {
	title?: string
	description?: string
	fields?: FormField[]
	theme?: string
	settings?: FormSettings
}

export interface FormExportData {
	koraforms: true
	version: 1
	title: string
	description: string
	fields: FormField[]
	theme: string
	settings: FormSettings
}

type IdFactory = () => string

const DEFAULT_OPTIONS = 'Option 1, Option 2, Option 3'
const DEFAULT_MATRIX_ROWS = 'Quality, Service, Price'
const DEFAULT_MATRIX_COLUMNS = 'Poor, Fair, Good, Excellent'

export function createBuilderField(type: FieldType = 'text', idFactory: IdFactory = createFieldId): FormField {
	return {
		id: idFactory(),
		type,
		label: '',
		required: false,
		...(['select', 'radio', 'checkbox', 'ranking'].includes(type) ? { options: DEFAULT_OPTIONS } : {}),
		...(type === 'matrix' ? { matrixRows: DEFAULT_MATRIX_ROWS, matrixColumns: DEFAULT_MATRIX_COLUMNS } : {}),
	}
}

export function insertField(fields: FormField[], field: FormField, afterIndex: number | null | undefined): FormField[] {
	if (afterIndex == null || afterIndex < 0) return [...fields, field]
	const next = [...fields]
	next.splice(Math.min(afterIndex + 1, next.length), 0, field)
	return next
}

export function addFieldOfType(
	fields: FormField[],
	type: FieldType,
	afterIndex: number | null | undefined,
	idFactory: IdFactory = createFieldId,
): { fields: FormField[]; field: FormField } {
	const field = createBuilderField(type, idFactory)
	return { fields: insertField(fields, field, afterIndex), field }
}

export function updateFieldAt(fields: FormField[], index: number, updates: Partial<FormField>): FormField[] {
	if (index < 0 || index >= fields.length) return fields
	const next = [...fields]
	next[index] = { ...next[index]!, ...updates }
	return next
}

export function removeFieldAt(fields: FormField[], index: number): FormField[] {
	if (index < 0 || index >= fields.length) return fields
	return fields.filter((_, itemIndex) => itemIndex !== index)
}

export function duplicateFieldAt(
	fields: FormField[],
	index: number,
	idFactory: IdFactory = createFieldId,
): { fields: FormField[]; field: FormField | null } {
	const source = fields[index]
	if (!source) return { fields, field: null }

	const field: FormField = {
		...source,
		id: idFactory(),
		label: source.label ? `${source.label} (copy)` : '',
	}
	const next = [...fields]
	next.splice(index + 1, 0, field)
	return { fields: next, field }
}

export function moveFieldAt(fields: FormField[], from: number, to: number): FormField[] {
	if (from < 0 || from >= fields.length || to < 0 || to >= fields.length || from === to) return fields
	const next = [...fields]
	const [field] = next.splice(from, 1)
	next.splice(to, 0, field!)
	return next
}

export function filterFieldTypes(query: string) {
	const normalizedQuery = query.trim().toLowerCase()
	if (!normalizedQuery) return FIELD_TYPES
	return FIELD_TYPES.filter(fieldType =>
		fieldType.label.toLowerCase().includes(normalizedQuery) ||
		fieldType.value.toLowerCase().includes(normalizedQuery)
	)
}

export function buildFormExportData(
	title: string,
	description: string,
	fields: FormField[],
	theme: string,
	settings: FormSettings,
): FormExportData {
	return {
		koraforms: true,
		version: 1,
		title: title || 'Untitled Form',
		description,
		fields,
		theme,
		settings,
	}
}

export function formExportFilename(title: string): string {
	const safeTitle = (title || 'form').replace(/[^a-z0-9]/gi, '-').toLowerCase()
	return `${safeTitle}.koraform.json`
}

export function parseImportedFormFile(value: string): ImportedFormData | null {
	const data = safeJsonParse<ImportedFormFile>(value, {})
	if (!data.koraforms) return null

	return {
		...(typeof data.title === 'string' ? { title: data.title } : {}),
		...(typeof data.description === 'string' ? { description: data.description } : {}),
		...(data.fields ? { fields: parseFormFields(JSON.stringify(data.fields)) } : {}),
		...(typeof data.theme === 'string' ? { theme: data.theme } : {}),
		...(data.settings ? { settings: parseFormSettings(JSON.stringify(data.settings)) } : {}),
	}
}
