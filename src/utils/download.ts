export function downloadTextFile(content: string, filename: string, type: string): void {
	const blob = new Blob([content], { type })
	downloadBlob(blob, filename)
}

export function downloadJsonFile(data: unknown, filename: string): void {
	downloadTextFile(JSON.stringify(data, null, 2), filename, 'application/json')
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
	const anchor = document.createElement('a')
	anchor.href = dataUrl
	anchor.download = filename
	anchor.click()
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob)
	try {
		downloadDataUrl(url, filename)
	} finally {
		URL.revokeObjectURL(url)
	}
}
