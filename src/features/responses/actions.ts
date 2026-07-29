import type { FormField } from '../../types'
import { createResponsesCsv, createResponsesJson, createResponsesReportHtml } from './export'

export interface ResponseExportOptions {
	fields: FormField[]
	responses: Record<string, unknown>[]
	formTitle: string
	selectedFieldIds?: string[]
	includeMetadata?: boolean
}

export interface TextExport {
	content: string
	filename: string
	type: string
}

export interface JsonExport {
	data: unknown
	filename: string
}

export type ResponseExportFormat = 'csv' | 'json'

export interface ResponseExportPresetRecord {
	id?: unknown
	formId?: unknown
	ownerId?: unknown
	name?: unknown
	format?: unknown
	config?: unknown
	createdAt?: unknown
	updatedAt?: unknown
}

export interface ResponseExportPreset {
	id: string
	formId: string
	ownerId: string
	name: string
	format: ResponseExportFormat
	selectedFieldIds: string[]
	includeMetadata: boolean
	createdAt: number
	updatedAt: number
}

export function buildResponsesCsvExport({
	fields,
	responses,
	formTitle,
	selectedFieldIds,
	includeMetadata = true,
}: ResponseExportOptions): TextExport | null {
	if (responses.length === 0) return null
	return {
		content: createResponsesCsv({ fields, responses, selectedFieldIds, includeMetadata }),
		filename: `${safeFormTitle(formTitle)}-responses.csv`,
		type: 'text/csv',
	}
}

export function buildResponsesJsonExport({
	fields,
	responses,
	formTitle,
	selectedFieldIds,
	includeMetadata = true,
}: ResponseExportOptions): JsonExport | null {
	if (responses.length === 0) return null
	return {
		data: createResponsesJson({ fields, responses, selectedFieldIds, includeMetadata }),
		filename: `${safeFormTitle(formTitle)}-responses.json`,
	}
}

export function buildResponsesReportHtmlExport({
	fields,
	responses,
	formTitle,
}: Pick<ResponseExportOptions, 'fields' | 'responses' | 'formTitle'>): string | null {
	if (responses.length === 0) return null
	return createResponsesReportHtml({
		title: formTitle || 'Form',
		fields,
		responses,
	})
}

export function deleteResponsesMessage(count: number): string {
	return `Delete ${count} response${count !== 1 ? 's' : ''}?`
}

export function responseIdsForDeletion(selectedIds: Set<string>): string[] {
	return Array.from(selectedIds)
}

export function buildResponseExportPresetPayload({
	formId,
	ownerId,
	name,
	format,
	selectedFieldIds,
	includeMetadata,
	now = Date.now(),
}: {
	formId: string
	ownerId: string
	name: string
	format: ResponseExportFormat
	selectedFieldIds: string[]
	includeMetadata: boolean
	now?: number
}): Omit<ResponseExportPresetRecord, 'id'> | null {
	const safeName = normalizePresetName(name)
	if (!formId || !ownerId || !safeName) return null
	return {
		formId,
		ownerId,
		name: safeName,
		format: normalizeExportFormat(format),
		config: {
			selectedFieldIds: normalizeSelectedFieldIds(selectedFieldIds),
			includeMetadata,
		},
		createdAt: now,
		updatedAt: now,
	}
}

export function normalizeResponseExportPresets(
	records: readonly ResponseExportPresetRecord[],
	formId: string,
	ownerId: string,
): ResponseExportPreset[] {
	return records
		.map(record => normalizeResponseExportPreset(record))
		.filter((record): record is ResponseExportPreset => Boolean(record && record.formId === formId && record.ownerId === ownerId))
		.sort((a, b) => b.updatedAt - a.updatedAt)
}

function safeFormTitle(title: string): string {
	return title || 'form'
}

function normalizeResponseExportPreset(record: ResponseExportPresetRecord): ResponseExportPreset | null {
	const id = typeof record.id === 'string' ? record.id : ''
	const formId = typeof record.formId === 'string' ? record.formId : ''
	const ownerId = typeof record.ownerId === 'string' ? record.ownerId : ''
	const name = normalizePresetName(record.name)
	if (!id || !formId || !ownerId || !name) return null
	const config = record.config && typeof record.config === 'object' ? record.config as Record<string, unknown> : {}
	return {
		id,
		formId,
		ownerId,
		name,
		format: normalizeExportFormat(record.format),
		selectedFieldIds: normalizeSelectedFieldIds(config.selectedFieldIds),
		includeMetadata: typeof config.includeMetadata === 'boolean' ? config.includeMetadata : true,
		createdAt: toFiniteNumber(record.createdAt),
		updatedAt: toFiniteNumber(record.updatedAt),
	}
}

function normalizeExportFormat(value: unknown): ResponseExportFormat {
	return value === 'json' ? 'json' : 'csv'
}

function normalizePresetName(value: unknown): string {
	if (typeof value !== 'string') return ''
	return value.trim().replace(/\s+/g, ' ').slice(0, 64)
}

function normalizeSelectedFieldIds(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	const seen = new Set<string>()
	const ids: string[] = []
	for (const item of value) {
		if (typeof item !== 'string') continue
		const id = item.trim().slice(0, 120)
		if (!id || seen.has(id)) continue
		seen.add(id)
		ids.push(id)
		if (ids.length >= 80) break
	}
	return ids
}

function toFiniteNumber(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
