import { useEffect, useState } from 'react'
import { Check, Code, Copy, Download, ExternalLink, Globe, QrCode, Send } from 'lucide-react'
import { copyToClipboard } from '../../utils/clipboard'
import { downloadDataUrl } from '../../utils/download'
import { buildEmbedCode, qrCodeFilename, type EmbedMode } from '../../utils/embed'
import { createQrDataUrl } from '../../utils/qr'

interface FormSharePanelProps {
	title: string
	isPublished: boolean
	slug: string
	formUrl: string
	resultsUrl: string
	publicResults: boolean
	onPublish: () => void
}

export function FormSharePanel({
	title,
	isPublished,
	slug,
	formUrl,
	resultsUrl,
	publicResults,
	onPublish,
}: FormSharePanelProps) {
	const [copied, setCopied] = useState<'link' | 'embed' | 'results' | null>(null)
	const [embedMode, setEmbedMode] = useState<EmbedMode>('inline')
	const [qrDataUrl, setQrDataUrl] = useState('')
	const baseUrl = typeof window === 'undefined' ? '' : window.location.origin

	useEffect(() => {
		createQrDataUrl(formUrl).then(dataUrl => {
			if (dataUrl) setQrDataUrl(dataUrl)
		})
	}, [formUrl])

	const embedCode = buildEmbedCode({ mode: embedMode, formUrl, baseUrl, slug })
	const copy = (value: string, key: 'link' | 'embed' | 'results') => {
		copyToClipboard(value)
		setCopied(key)
		setTimeout(() => setCopied(null), 1600)
	}
	const downloadQR = () => {
		if (!qrDataUrl) return
		downloadDataUrl(qrDataUrl, qrCodeFilename(slug))
	}

	return (
		<section className="animate-fade-in rounded-b-2xl border border-t-0 border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark sm:p-6">
			<div className="space-y-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-[22px] font-semibold tracking-tight text-slate-950 dark:text-gray-100">Share</h2>
						<p className="mt-1 text-[14px] text-slate-500 dark:text-gray-400">Share {title} by link, social post, embed, QR code, or results link.</p>
					</div>
					{!isPublished && (
						<button onClick={onPublish} className="inline-flex items-center justify-center gap-2 kf-primary px-5 py-3 text-[14px] font-semibold">
							<Send className="h-4 w-4" />
							Publish to share
						</button>
					)}
				</div>

				<div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
					<div className="kf-panel p-6">
						<div className="flex h-full flex-col justify-between gap-6">
							<div>
								<div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/25 dark:text-brand-300">
									<Globe className="h-5 w-5" />
								</div>
								<h3 className="text-[17px] font-semibold text-slate-950 dark:text-gray-100">Public form link</h3>
								<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Use this link in email, chat, or your website.</p>
							</div>
							<div className="space-y-3">
								<div className="truncate rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-500 dark:bg-gray-900 dark:text-gray-400">{formUrl}</div>
								<div className="flex flex-wrap gap-2">
									<button onClick={() => copy(formUrl, 'link')} className="inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
										{copied === 'link' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
										{copied === 'link' ? 'Copied' : 'Copy link'}
									</button>
									<a href={formUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
										<ExternalLink className="h-4 w-4" />
										Open
									</a>
								</div>
								<div className="mt-4">
									<p className="mb-2 text-[12px] font-semibold text-slate-500 dark:text-gray-400">Share on social</p>
									<div className="grid grid-cols-3 gap-2">
										<a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out "${title}" on KoraForms`)}&url=${encodeURIComponent(formUrl)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-center text-[12px] font-medium text-slate-600 hover:bg-slate-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">X</a>
										<a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(formUrl)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-center text-[12px] font-medium text-slate-600 hover:bg-slate-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">LinkedIn</a>
										<a href={`https://wa.me/?text=${encodeURIComponent(`${title}: ${formUrl}`)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-center text-[12px] font-medium text-slate-600 hover:bg-slate-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">WhatsApp</a>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="kf-panel p-6">
						<div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300">
							<Code className="h-5 w-5" />
						</div>
						<h3 className="text-[17px] font-semibold text-slate-950 dark:text-gray-100">Embed</h3>
						<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Place the form inline, open it as a popup, or slide it into the page.</p>
						<div className="mt-4 flex rounded-xl bg-slate-100 p-1 dark:bg-gray-800">
							{[
								{ value: 'inline' as const, label: 'Inline' },
								{ value: 'popup' as const, label: 'Popup' },
								{ value: 'slidein' as const, label: 'Slide-in' },
							].map(option => (
								<button
									key={option.value}
									onClick={() => setEmbedMode(option.value)}
									className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
										embedMode === option.value
											? 'bg-white text-slate-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
											: 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
									}`}
								>
									{option.label}
								</button>
							))}
						</div>
						<textarea
							readOnly
							value={embedCode}
							rows={4}
							className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[12px] text-slate-600 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
						/>
						<button onClick={() => copy(embedCode, 'embed')} className="mt-3 inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
							{copied === 'embed' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
							{copied === 'embed' ? 'Copied' : 'Copy embed'}
						</button>
						<p className="mt-2 text-[11px] text-slate-400 dark:text-gray-500">
							{embedMode === 'inline' && 'Paste this where the form should appear.'}
							{embedMode === 'popup' && 'Adds a button that opens the form in a centered popup.'}
							{embedMode === 'slidein' && 'Slides the form in from the right side of the page.'}
						</p>
					</div>
				</div>

				<div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
					<div className="kf-panel p-6">
						<div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300">
							<QrCode className="h-5 w-5" />
						</div>
						<h3 className="text-[17px] font-semibold text-slate-950 dark:text-gray-100">QR code</h3>
						<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Print it, place it on slides, or share it where scanning is easier than typing.</p>
						<div className="mt-5 flex flex-col items-center gap-4">
							{qrDataUrl ? (
								<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-800">
									<img src={qrDataUrl} alt={`QR code for ${title}`} className="h-44 w-44" />
								</div>
							) : (
								<div className="h-44 w-44 animate-pulse rounded-2xl bg-slate-100 dark:bg-gray-800" />
							)}
							<div className="flex flex-wrap justify-center gap-2">
								<button onClick={downloadQR} className="inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
									<Download className="h-4 w-4" />
									Download PNG
								</button>
								<button onClick={() => copy(formUrl, 'link')} className="inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
									{copied === 'link' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
									{copied === 'link' ? 'Copied' : 'Copy link'}
								</button>
							</div>
						</div>
					</div>

					<div className="kf-panel p-5">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">Public results</h3>
								<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">
									{publicResults ? 'Results are available to anyone with the results link.' : 'Enable public results from Settings when you want viewers to see responses.'}
								</p>
							</div>
							<button
								onClick={() => copy(resultsUrl, 'results')}
								disabled={!publicResults}
								className="inline-flex items-center justify-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
							>
								{copied === 'results' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
								{copied === 'results' ? 'Copied' : 'Copy results link'}
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
