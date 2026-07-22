export type EmbedMode = 'inline' | 'popup' | 'slidein'

interface EmbedCodeOptions {
	mode: EmbedMode
	formUrl: string
	baseUrl: string
	slug: string
}

function escapeJavaScriptString(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function buildEmbedCode({ mode, formUrl, baseUrl, slug }: EmbedCodeOptions): string {
	const escapedSlug = escapeJavaScriptString(slug)

	if (mode === 'inline') {
		return `<iframe src="${formUrl}?embed=1" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;"></iframe>`
	}

	if (mode === 'popup') {
		return `<script src="${baseUrl}/embed.js"></script>\n<button onclick="KoraForms.popup('${escapedSlug}')">Open Form</button>`
	}

	return `<script src="${baseUrl}/embed.js"></script>\n<script>KoraForms.slideIn('${escapedSlug}', { position: 'right' })</script>`
}

export function qrCodeFilename(slug: string): string {
	const normalizedSlug = slug.trim().replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
	return `${normalizedSlug || 'form'}-qr-code.png`
}
