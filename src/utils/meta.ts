const BASE_URL = 'https://forms.korajs.dev'
const DEFAULT_DESCRIPTION = 'Build forms that work anywhere — even offline. Free and open source.'
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`

/**
 * Update document head meta tags for SEO and social sharing.
 */
export function setPageMeta(meta: {
	title: string
	description?: string
	ogImage?: string
	url?: string
}): void {
	const fullTitle = meta.title.includes('KoraForms')
		? meta.title
		: `${meta.title} | KoraForms`
	const description = meta.description || DEFAULT_DESCRIPTION
	const ogImage = meta.ogImage || DEFAULT_OG_IMAGE
	const url = meta.url || BASE_URL

	document.title = fullTitle

	// Standard meta
	setMetaTag('description', description)
	setMetaTag('author', 'KoraForms')

	// Open Graph
	setMetaTag('og:title', fullTitle, 'property')
	setMetaTag('og:description', description, 'property')
	setMetaTag('og:type', 'website', 'property')
	setMetaTag('og:site_name', 'KoraForms', 'property')
	setMetaTag('og:image', ogImage, 'property')
	setMetaTag('og:url', url, 'property')
	setMetaTag('og:locale', 'en_US', 'property')

	// Twitter Card
	setMetaTag('twitter:card', 'summary_large_image')
	setMetaTag('twitter:title', fullTitle)
	setMetaTag('twitter:description', description)
	setMetaTag('twitter:image', ogImage)

	// Canonical URL
	let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
	if (!link) {
		link = document.createElement('link')
		link.rel = 'canonical'
		document.head.appendChild(link)
	}
	link.href = url
}

function setMetaTag(name: string, content: string, attr: 'name' | 'property' = 'name'): void {
	let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
	if (!el) {
		el = document.createElement('meta')
		el.setAttribute(attr, name)
		document.head.appendChild(el)
	}
	el.setAttribute('content', content)
}
