/**
 * Generate iframe embed code for a published form.
 */
export function getEmbedCode(
	slug: string,
	options?: { width?: string; height?: string },
): string {
	const { width = '100%', height = '600px' } = options || {}
	const baseUrl = window.location.origin
	return `<iframe src="${baseUrl}/f/${slug}" width="${width}" height="${height}" frameborder="0" style="border:0;border-radius:12px;" allow="camera;microphone"></iframe>`
}
