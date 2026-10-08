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
	return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }

/** Decode the HTML entities a rich-text editor emits (named basics and numeric). */
function decodeHtmlEntities(value: string): string {
	return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
		if (entity[0] === '#') {
			const code = entity[1]?.toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10)
			return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
		}
		return NAMED_ENTITIES[entity.toLowerCase()] ?? match
	})
}

/** True when rich text has no visible content. */
export function isRichTextEmpty(value: string): boolean {
	return !htmlToPlainText(value).trim()
}
