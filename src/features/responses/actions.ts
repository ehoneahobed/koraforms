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

function safeFormTitle(title: string): string {
	return title || 'form'
}
