import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Link as LinkIcon } from 'lucide-react'
import { generateSlug } from '../../utils/slug'
import { copyToClipboard } from '../../utils/clipboard'
import { sanitizeSlug } from '../../features/forms/shell'

interface FormUrlPanelProps {
	formId: string
	title: string
	status: string
	slug: string
	formUrl: string
	onSlugChange: (slug: string) => void
	onPublish: () => void
}

export function FormUrlPanel({
	formId,
	title,
	status,
	slug,
	formUrl,
	onSlugChange,
	onPublish,
}: FormUrlPanelProps) {
	const [draftSlug, setDraftSlug] = useState(slug || generateSlug(title))
	const [copied, setCopied] = useState(false)
	const isPublished = status === 'published'

	useEffect(() => {
		setDraftSlug(slug || generateSlug(title))
	}, [slug, title])

	const saveSlug = () => {
		const sanitized = sanitizeSlug(draftSlug || formId)
		setDraftSlug(sanitized)
		onSlugChange(sanitized)
	}

	const copyUrl = () => {
		copyToClipboard(formUrl)
		setCopied(true)
		setTimeout(() => setCopied(false), 1600)
	}

	return (
		<section className="animate-fade-in rounded-b-2xl border border-t-0 border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark sm:p-6">
			<div className="space-y-6">
				<div>
					<h2 className="text-[22px] font-semibold tracking-tight text-slate-950 dark:text-gray-100">Public URL</h2>
					<p className="mt-1 text-[14px] text-slate-500 dark:text-gray-400">Choose the public address people use to open this form.</p>
				</div>

				<div className="kf-panel p-6">
					<div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0 flex-1">
							<div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-600 dark:text-gray-300">
								<LinkIcon className="h-4 w-4 text-slate-400" />
								Form link
							</div>
							<div className="flex min-w-0 items-center rounded-xl border border-slate-200 bg-slate-50 dark:border-gray-800 dark:bg-gray-900">
								<span className="hidden shrink-0 pl-4 pr-1 text-[13px] text-slate-400 sm:inline">
									{typeof window === 'undefined' ? '' : window.location.origin}/f/
								</span>
								<input
									value={draftSlug}
									onChange={(event) => setDraftSlug(event.target.value)}
									onBlur={saveSlug}
									className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-300 dark:text-gray-100 sm:px-1"
									placeholder="form-url"
								/>
							</div>
							<p className="mt-2 truncate text-[12px] text-slate-400 dark:text-gray-500">{formUrl}</p>
						</div>
						<div className="flex shrink-0 flex-wrap gap-2">
							<button onClick={copyUrl} className="inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
								{copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
								{copied ? 'Copied' : 'Copy'}
							</button>
							<a href={formUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
								<ExternalLink className="h-4 w-4" />
								Open
							</a>
						</div>
					</div>
				</div>

				{!isPublished && (
					<div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
						This form is still a draft. Publish it when you are ready for people to use this URL.
						<button onClick={onPublish} className="ml-3 font-semibold underline decoration-amber-400 underline-offset-4">
							Publish now
						</button>
					</div>
				)}
			</div>
		</section>
	)
}
