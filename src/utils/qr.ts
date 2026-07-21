export async function createQrDataUrl(value: string): Promise<string | null> {
	try {
		const { toDataURL } = await import('qrcode')
		return await toDataURL(value, {
			width: 400,
			margin: 2,
			color: { dark: '#1a1a1a', light: '#ffffff' },
			errorCorrectionLevel: 'M',
		})
	} catch {
		return null
	}
}
