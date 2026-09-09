import DOMPurify from 'isomorphic-dompurify'
import {
	escapeHtml,
	htmlToPlainText,
	isRichTextEmpty,
	looksLikeHtml,
} from './plainText'

export {
	escapeHtml,
	htmlToPlainText,
	isRichTextEmpty,
	looksLikeHtml,
} from './plainText'

const RICH_TEXT_TAGS = [
	'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a',
	'ul', 'ol', 'li', 'span',
] as const

const RICH_TEXT_ATTRS = ['href', 'target', 'rel', 'class'] as const

/**
 * Normalize TipTap / editor HTML for storage.
 * Empty documents become `''` so legacy plain-string checks keep working.
 */
export function normalizeRichText(html: string): string {
	if (!html || isRichTextEmpty(html)) return ''
	return html.trim()
}

/** Wrap plain legacy strings so TipTap can edit them as a paragraph. */
export function toEditorHtml(value: string): string {
	if (!value) return ''
	if (looksLikeHtml(value)) return value
	return `<p>${escapeHtml(value)}</p>`
}

/** Sanitize HTML for safe rendering in the form viewer / builder preview. */
export function sanitizeRichText(html: string): string {
	if (!html) return ''
	if (!looksLikeHtml(html)) {
		return escapeHtml(html).replace(/\n/g, '<br>')
	}
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [...RICH_TEXT_TAGS],
		ALLOWED_ATTR: [...RICH_TEXT_ATTRS],
		ALLOW_DATA_ATTR: false,
	})
}
