/** Copy text to clipboard with fallback for restricted contexts (COEP headers, older browsers) */
export async function copyToClipboard(text: string): Promise<boolean> {
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text)
			return true
		} catch {
			return fallbackCopy(text)
		}
	}
	return fallbackCopy(text)
}

function fallbackCopy(text: string): boolean {
	if (typeof document === 'undefined') return false
	const textarea = document.createElement('textarea')
	textarea.value = text
	textarea.style.position = 'fixed'
	textarea.style.left = '-9999px'
	textarea.style.top = '-9999px'
	textarea.style.opacity = '0'
	document.body.appendChild(textarea)
	textarea.focus()
	textarea.select()
	try {
		return document.execCommand('copy')
	} catch {
		return false
	} finally {
		document.body.removeChild(textarea)
	}
}
