import { useState } from 'react'
import { X, Copy, Check, Code, Link as LinkIcon } from 'lucide-react'
import { getEmbedCode } from '../../utils/embed'
import { copyToClipboard as copyText } from '../../utils/clipboard'

interface Props {
	slug: string
	title: string
	onClose: () => void
}

export function ShareModal({ slug, title, onClose }: Props) {
	const [copied, setCopied] = useState<'link' | 'embed' | null>(null)
	const formUrl = `${window.location.origin}/f/${slug}`
	const embedCode = getEmbedCode(slug)

	const copyToClipboard = (text: string, type: 'link' | 'embed') => {
		copyText(text)
		setCopied(type)
		setTimeout(() => setCopied(null), 2000)
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

				<div className="p-5 space-y-5">
					{/* Share link */}
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

					{/* Embed code */}
					<div>
						<label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
							<Code className="h-3.5 w-3.5" />
							Embed code
						</label>
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
				</div>
			</div>
		</>
	)
}
