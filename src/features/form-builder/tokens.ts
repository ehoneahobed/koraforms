import type { FormField } from '../../types'

export type TokenSegment =
	| { type: 'text'; value: string }
	| { type: 'token'; value: string }

export function parseTokenSegments(value: string): TokenSegment[] {
	const segments: TokenSegment[] = []
	const regex = /\{\{([^}]+)\}\}/g
	let cursor = 0
	let match: RegExpExecArray | null

	while ((match = regex.exec(value)) !== null) {
		if (match.index > cursor) {
			segments.push({ type: 'text', value: value.slice(cursor, match.index) })
		}
		segments.push({ type: 'token', value: match[1] || '' })
		cursor = match.index + match[0].length
	}

	if (cursor < value.length || segments.length === 0 || segments[segments.length - 1]?.type === 'token') {
		segments.push({ type: 'text', value: value.slice(cursor) })
	}

	return segments
}

export function serializeTokenSegments(segments: TokenSegment[]): string {
	return segments.map(segment => segment.type === 'token' ? `{{${segment.value}}}` : segment.value).join('')
}

export function fieldDisplayName(field: FormField, allFields: FormField[]): string {
	return field.label || `Question ${allFields.findIndex(f => f.id === field.id) + 1}`
}

export function stripTrailingFieldLabel(text: string, label: string): string {
	const trimmedLabel = label.trim()
	if (!trimmedLabel) return text
	const labelPattern = escapeRegExp(trimmedLabel).replace(/\s+/g, '\\s+')
	return text.replace(new RegExp(`${labelPattern}\\s*$`, 'i'), '')
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
