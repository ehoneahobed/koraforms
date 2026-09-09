/**
 * Lightweight text helpers shared by the Vite client and the Node server.
 * Keep this free of browser-only / heavy deps (no DOMPurify) so production
 * Docker images can import it from `src/types.ts` without extra packages.
 */

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
