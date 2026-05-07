import { useState } from 'react'
import { Settings, Link as LinkIcon, Check, Copy, Ban, Globe } from 'lucide-react'
import { copyToClipboard } from '../../utils/clipboard'

interface Props {
	slug: string
	status: string
	onSlugChange: (slug: string) => void
	onStatusChange: (status: string) => void
	isOpen: boolean
	onToggle: () => void
}

export function FormSettings({
	slug,
	status,
	onSlugChange,
	onStatusChange,
	isOpen,
	onToggle,
}: Props) {
	const [slugInput, setSlugInput] = useState(slug)
	const [copied, setCopied] = useState(false)

	const formUrl = slug ? `${window.location.origin}/f/${slug}` : ''

	const handleSlugBlur = () => {
		// Sanitize slug
		const sanitized = slugInput
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
		setSlugInput(sanitized)
		if (sanitized && sanitized !== slug) {
			onSlugChange(sanitized)
		}
	}

	const copyUrl = () => {
		if (!formUrl) return
		copyToClipboard(formUrl)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	return (
		<div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark mb-4 overflow-hidden">
			<button
				onClick={onToggle}
				className="w-full flex items-center justify-between px-6 py-3.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-smooth"
			>
				<div className="flex items-center gap-3">
					<Settings className="h-4 w-4 text-gray-400" />
					<span className="font-medium">Settings</span>
				</div>
				<svg
					className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{isOpen && (
				<div className="px-6 pb-5 pt-1 space-y-4 animate-fade-in">
					{/* Status */}
					<div>
						<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
							Status
						</label>
						<div className="flex gap-2">
							{[
								{ value: 'draft', label: 'Draft', icon: <Ban className="h-3.5 w-3.5" /> },
								{ value: 'published', label: 'Published', icon: <Globe className="h-3.5 w-3.5" /> },
							].map((opt) => (
								<button
									key={opt.value}
									onClick={() => onStatusChange(opt.value)}
									className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-smooth ${
										status === opt.value
											? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800'
											: 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
									}`}
								>
									{opt.icon}
									{opt.label}
								</button>
							))}
						</div>
					</div>

					{/* Slug */}
					{slug && (
						<div>
							<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
								URL slug
							</label>
							<div className="flex gap-2">
								<div className="flex-1 flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden">
									<span className="px-2.5 text-xs text-gray-400 shrink-0">/f/</span>
									<input
										type="text"
										value={slugInput}
										onChange={(e) => setSlugInput(e.target.value)}
										onBlur={handleSlugBlur}
										className="flex-1 bg-transparent px-1 py-2 text-sm outline-none text-gray-700 dark:text-gray-300"
									/>
								</div>
								<button
									onClick={copyUrl}
									className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-smooth"
								>
									{copied ? (
										<><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied</>
									) : (
										<><Copy className="h-3.5 w-3.5" /> Copy URL</>
									)}
								</button>
							</div>
							{formUrl && (
								<p className="text-[10px] text-gray-400 mt-1.5 truncate">
									<LinkIcon className="h-3 w-3 inline mr-1" />
									{formUrl}
								</p>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
