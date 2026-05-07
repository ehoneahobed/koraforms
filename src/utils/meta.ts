/**
 * Update document head meta tags for SEO and social sharing.
 */
export function setPageMeta(meta: {
	title: string
	description?: string
	ogImage?: string
	url?: string
}): void {
	document.title = meta.title.includes('KoraForms')
		? meta.title
		: `${meta.title} | KoraForms`

	setMetaTag('description', meta.description || 'Build forms that work anywhere — even offline. Free.')
	setMetaTag('og:title', meta.title, 'property')
	setMetaTag('og:description', meta.description || 'Build forms that work anywhere — even offline. Free.', 'property')
	setMetaTag('og:type', 'website', 'property')

	if (meta.ogImage) {
		setMetaTag('og:image', meta.ogImage, 'property')
	}
	if (meta.url) {
		setMetaTag('og:url', meta.url, 'property')
	}

	setMetaTag('twitter:card', 'summary')
	setMetaTag('twitter:title', meta.title)
	setMetaTag('twitter:description', meta.description || 'Build forms that work anywhere — even offline. Free.')
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
