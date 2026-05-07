/**
 * Generate a URL-friendly slug from a title.
 * Appends a random suffix to ensure uniqueness.
 */
export function generateSlug(title: string): string {
	const base = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 40)
	const suffix = Math.random().toString(36).slice(2, 8)
	return base ? `${base}-${suffix}` : suffix
}
