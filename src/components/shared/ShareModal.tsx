import { useState, useEffect } from 'react'
import { X, Copy, Check, Code, Link as LinkIcon, QrCode, Download } from 'lucide-react'
import { copyToClipboard as copyText } from '../../utils/clipboard'
import { downloadDataUrl } from '../../utils/download'
import { buildEmbedCode, qrCodeFilename, type EmbedMode } from '../../utils/embed'
import { createQrDataUrl } from '../../utils/qr'

interface Props {
	slug: string
	title: string
	onClose: () => void
}

type Tab = 'link' | 'embed' | 'qr'

export function ShareModal({ slug, title, onClose }: Props) {
	const [copied, setCopied] = useState<'link' | 'embed' | null>(null)
	const [embedMode, setEmbedMode] = useState<EmbedMode>('inline')
	const [tab, setTab] = useState<Tab>('link')
	const [qrDataUrl, setQrDataUrl] = useState<string>('')
	const formUrl = `${window.location.origin}/f/${slug}`
	const baseUrl = window.location.origin

	// Generate QR code
	useEffect(() => {
		if (tab === 'qr') {
			createQrDataUrl(formUrl).then(dataUrl => {
				if (dataUrl) setQrDataUrl(dataUrl)
			})
		}
	}, [tab, formUrl])

	const embedCode = buildEmbedCode({ mode: embedMode, formUrl, baseUrl, slug })

	const copyToClipboard = (text: string, type: 'link' | 'embed') => {
		copyText(text)
		setCopied(type)
		setTimeout(() => setCopied(null), 2000)
	}

	const downloadQR = () => {
		if (!qrDataUrl) return
		downloadDataUrl(qrDataUrl, qrCodeFilename(slug))
	}

	return (
		<>
			<div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
			<div className="fixed inset-x-0 bottom-0 sm:inset-x-4 sm:bottom-auto sm:top-[15%] z-50 sm:mx-auto max-w-lg rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl animate-slide-up sm:animate-scale-in max-h-[85vh] overflow-y-auto">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
					<h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
						Share "{title}"
					</h2>
					<button
						onClick={onClose}
						className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Tabs */}
				<div className="flex items-center border-b border-gray-100 dark:border-gray-800">
					{([
						{ value: 'link' as Tab, label: 'Link', icon: <LinkIcon className="h-3.5 w-3.5" /> },
						{ value: 'embed' as Tab, label: 'Embed', icon: <Code className="h-3.5 w-3.5" /> },
						{ value: 'qr' as Tab, label: 'QR Code', icon: <QrCode className="h-3.5 w-3.5" /> },
					]).map(t => (
						<button
							key={t.value}
							onClick={() => setTab(t.value)}
							className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all duration-200 border-b-2 ${
								tab === t.value
									? 'border-brand-500 text-brand-600 dark:text-brand-400'
									: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
							}`}
						>
							{t.icon}
							{t.label}
						</button>
					))}
				</div>

				<div className="p-5 space-y-5">
					{/* Link tab */}
					{tab === 'link' && (
						<>
							<div>
								<label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
									<LinkIcon className="h-3.5 w-3.5" />
									Form link
								</label>
								<div className="flex gap-2">
									<input
										type="text"
										readOnly
										value={formUrl}
										className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 select-all"
										onClick={(e) => (e.target as HTMLInputElement).select()}
									/>
									<button
										onClick={() => copyToClipboard(formUrl, 'link')}
										className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 transition-smooth shrink-0"
									>
										{copied === 'link' ? (
											<><Check className="h-3.5 w-3.5" /> Copied</>
										) : (
											<><Copy className="h-3.5 w-3.5" /> Copy</>
										)}
									</button>
								</div>
							</div>

							{/* Social share */}
							<div>
								<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
									Share on social
								</label>
								<div className="flex gap-2">
									<a
										href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out "${title}" on KoraForms`)}&url=${encodeURIComponent(formUrl)}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-smooth"
									>
										Twitter / X
									</a>
									<a
										href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(formUrl)}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-smooth"
									>
										LinkedIn
									</a>
									<a
										href={`https://wa.me/?text=${encodeURIComponent(`${title}: ${formUrl}`)}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-smooth"
									>
										WhatsApp
									</a>
								</div>
							</div>
						</>
					)}

					{/* Embed tab */}
					{tab === 'embed' && (
						<div>
							<label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
								<Code className="h-3.5 w-3.5" />
								Embed on your website
							</label>
							{/* Embed mode tabs */}
							<div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 mb-2">
								{([
									{ value: 'inline' as EmbedMode, label: 'Inline' },
									{ value: 'popup' as EmbedMode, label: 'Popup' },
									{ value: 'slidein' as EmbedMode, label: 'Slide-in' },
								]).map(t => (
									<button
										key={t.value}
										onClick={() => setEmbedMode(t.value)}
										className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
											embedMode === t.value
												? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
												: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
										}`}
									>
										{t.label}
									</button>
								))}
							</div>
							<div className="relative">
								<pre className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
									{embedCode}
								</pre>
								<button
									onClick={() => copyToClipboard(embedCode, 'embed')}
									className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 text-xs text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-smooth"
								>
									{copied === 'embed' ? (
										<><Check className="h-3 w-3" /> Copied</>
									) : (
										<><Copy className="h-3 w-3" /> Copy</>
									)}
								</button>
							</div>
							<p className="text-[10px] text-gray-400 mt-2">
								{embedMode === 'inline' && 'Paste this code where you want the form to appear.'}
								{embedMode === 'popup' && 'Clicking the button will open the form in a centered popup.'}
								{embedMode === 'slidein' && 'The form will slide in from the right side of the page.'}
							</p>
						</div>
					)}

					{/* QR Code tab */}
					{tab === 'qr' && (
						<div className="flex flex-col items-center gap-4">
							<p className="text-xs text-gray-500 dark:text-gray-400 text-center">
								Print or share this QR code. Scanning it opens your form instantly.
							</p>
							{qrDataUrl ? (
								<div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
									<img
										src={qrDataUrl}
										alt={`QR code for ${title}`}
										className="w-48 h-48"
									/>
								</div>
							) : (
								<div className="w-48 h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
							)}
							<p className="text-[10px] text-gray-400 text-center max-w-xs truncate">
								{formUrl}
							</p>
							<div className="flex gap-2">
								<button
									onClick={downloadQR}
									className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition-smooth"
								>
									<Download className="h-3.5 w-3.5" />
									Download PNG
								</button>
								<button
									onClick={() => copyToClipboard(formUrl, 'link')}
									className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-smooth"
								>
									{copied === 'link' ? (
										<><Check className="h-3.5 w-3.5" /> Copied</>
									) : (
										<><Copy className="h-3.5 w-3.5" /> Copy link</>
									)}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</>
	)
}
