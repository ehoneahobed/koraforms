/** Copy text to clipboard with fallback for restricted contexts (COEP headers, older browsers) */
export function copyToClipboard(text: string): void {
	if (navigator.clipboard?.writeText) {
		navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
	} else {
		fallbackCopy(text)
	}
}

function fallbackCopy(text: string): void {
	const textarea = document.createElement('textarea')
	textarea.value = text
	textarea.style.position = 'fixed'
	textarea.style.left = '-9999px'
	textarea.style.top = '-9999px'
	textarea.style.opacity = '0'
	document.body.appendChild(textarea)
	textarea.focus()
	textarea.select()
	document.execCommand('copy')
	document.body.removeChild(textarea)
}
