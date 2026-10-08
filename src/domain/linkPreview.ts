/**
 * Link previews for shared form links.
 *
 * WhatsApp, Slack, iMessage, LinkedIn and X read the HTML the server sends and do
 * not run the app, so the server writes each form's own title and description into
 * the app shell (Kora `shellMeta`). Only what the public form API already shows is
 * used: the title and description of a PUBLISHED form (password-protected forms
 * show these before the password too). Drafts, closed and unknown forms keep the
 * generic KoraForms card, so nothing unpublished leaks through a preview.
 */

/** The fields of a form a preview may read. */
export interface PreviewForm {
	id: unknown
	title?: unknown
	description?: unknown
	slug?: unknown
	status?: unknown
	settings?: unknown
}

/** A form preview: what the server writes into the shell's head. */
export interface FormLinkPreview {
	title: string
	description: string
	url: string
	type: 'website'
	siteName: 'KoraForms'
}

/** The form a shell path names: `/f/<slug or id>` and `/f/<slug>/results`. */
export interface PreviewTarget {
	key: string
	page: 'form' | 'results'
}

const FALLBACK_DESCRIPTION = 'Fill in this form on KoraForms. Once opened, it keeps working without internet.'
const MAX_DESCRIPTION = 160

/** Which form a shell path points at, or null for every other page. */
export function previewTargetFor(path: string): PreviewTarget | null {
	const match = path.match(/^\/f\/([^/]+)(\/results)?\/?$/)
	if (!match?.[1]) return null
	let key: string
	try {
		key = decodeURIComponent(match[1])
	} catch {
		return null
	}
	if (!key || key.length > 200) return null
	return { key, page: match[2] ? 'results' : 'form' }
}

/**
 * The preview for a form, or null when the form must not be described (not
 * published, or a results page whose results are not public).
 */
export function formLinkPreview(
	form: PreviewForm | null,
	target: PreviewTarget,
	baseUrl: string,
	resultsArePublic: (form: PreviewForm) => boolean,
): FormLinkPreview | null {
	if (!form || form.status !== 'published') return null
	if (target.page === 'results' && !resultsArePublic(form)) return null
	const title = plain(form.title) || 'Untitled form'
	const description = excerpt(plain(form.description)) || FALLBACK_DESCRIPTION
	const slug = plain(form.slug) || String(form.id)
	const path = `/f/${encodeURIComponent(slug)}${target.page === 'results' ? '/results' : ''}`
	return {
		title: target.page === 'results' ? `Results: ${title}` : title,
		description,
		url: `${baseUrl.replace(/\/$/, '')}${path}`,
		type: 'website',
		siteName: 'KoraForms',
	}
}

function plain(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function excerpt(text: string): string {
	if (text.length <= MAX_DESCRIPTION) return text
	const cut = text.slice(0, MAX_DESCRIPTION - 1)
	const space = cut.lastIndexOf(' ')
	return `${(space > MAX_DESCRIPTION * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}
