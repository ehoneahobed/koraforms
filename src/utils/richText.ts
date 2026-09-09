import DOMPurify from 'isomorphic-dompurify'

const RICH_TEXT_TAGS = [
	'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a',
	'ul', 'ol', 'li', 'span',
] as const

const RICH_TEXT_ATTRS = ['href', 'target', 'rel', 'class'] as const

/** True when the string contains HTML-like tags. */
export function looksLikeHtml(value: string): boolean {
	return /<\/?[a-z][\s\S]*>/i.test(value)
}

/** Escape text for safe insertion into an HTML string. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

/** Strip tags and decode to plain text (for meta tags, lists, piping keys). */
export function htmlToPlainText(value: string): string {
	if (!value) return ''
	if (!looksLikeHtml(value)) return value
	if (typeof document !== 'undefined') {
		const el = document.createElement('div')
		el.innerHTML = value
		return (el.textContent || '').replace(/\u00a0/g, ' ').trim()
	}
	return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** True when rich text has no visible content. */
export function isRichTextEmpty(value: string): boolean {
	return !htmlToPlainText(value).trim()
}

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
