import { useState } from 'react'
import { Settings, Link as LinkIcon, Check, Copy, Ban, Globe, ChevronDown, Webhook, Plus, Trash2, X } from 'lucide-react'
import { copyToClipboard } from '../../utils/clipboard'
import type { FormSettings as FormSettingsType, WebhookConfig } from '../../types'

interface Props {
	slug: string
	status: string
	settings: FormSettingsType
	onSlugChange: (slug: string) => void
	onStatusChange: (status: string) => void
	onSettingsChange: (settings: FormSettingsType) => void
	isOpen: boolean
	onToggle: () => void
}

export function FormSettings({
	slug,
	status,
	settings,
	onSlugChange,
	onStatusChange,
	onSettingsChange,
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

	const updateSetting = <K extends keyof FormSettingsType>(key: K, value: FormSettingsType[K]) => {
		onSettingsChange({ ...settings, [key]: value })
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
				<ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
			</button>

			{isOpen && (
				<div className="px-6 pb-5 pt-1 space-y-5 animate-fade-in">
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

					{/* Divider */}
					<div className="border-t border-gray-100 dark:border-gray-800" />

					{/* Thank-you page */}
					<div>
						<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
							Thank-you message
						</label>
						<textarea
							value={settings.thankYouMessage || ''}
							onChange={(e) => updateSetting('thankYouMessage', e.target.value)}
							placeholder="Custom message after submission (leave blank for default)"
							rows={2}
							className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-gray-700 dark:text-gray-300 placeholder-gray-400 resize-none"
						/>
					</div>

					<div>
						<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
							Redirect URL (optional)
						</label>
						<input
							type="url"
							value={settings.redirectUrl || ''}
							onChange={(e) => updateSetting('redirectUrl', e.target.value)}
							placeholder="https://example.com/thank-you"
							className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-gray-700 dark:text-gray-300 placeholder-gray-400"
						/>
						{settings.redirectUrl && (
							<div className="mt-2">
								<label className="text-xs text-gray-400 dark:text-gray-500">
									Redirect delay: {settings.redirectDelay || 3}s
								</label>
								<input
									type="range"
									min={0}
									max={10}
									value={settings.redirectDelay || 3}
									onChange={(e) => updateSetting('redirectDelay', parseInt(e.target.value))}
									className="w-full h-1.5 mt-1 accent-brand-500"
								/>
							</div>
						)}
					</div>

					<label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
						<input
							type="checkbox"
							checked={settings.allowMultiple !== false}
							onChange={(e) => updateSetting('allowMultiple', e.target.checked)}
							className="rounded border-gray-300"
						/>
						Allow multiple submissions
					</label>

					<label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
						<input
							type="checkbox"
							checked={settings.publicResults || false}
							onChange={(e) => updateSetting('publicResults', e.target.checked)}
							className="rounded border-gray-300"
						/>
						Show results publicly
					</label>

					{settings.publicResults && (
						<label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none ml-5">
							<input
								type="checkbox"
								checked={settings.showResultsAfterSubmit || false}
								onChange={(e) => updateSetting('showResultsAfterSubmit', e.target.checked)}
								className="rounded border-gray-300"
							/>
							Show results link after submission
						</label>
					)}

					{/* Divider */}
					<div className="border-t border-gray-100 dark:border-gray-800" />

					{/* Response limits */}
					<div>
						<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
							Max responses (0 = unlimited)
						</label>
						<input
							type="number"
							min={0}
							value={settings.maxResponses || 0}
							onChange={(e) => updateSetting('maxResponses', parseInt(e.target.value) || 0)}
							className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-gray-700 dark:text-gray-300"
						/>
					</div>

					{/* Scheduling */}
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
								Opens at
							</label>
							<input
								type="datetime-local"
								value={settings.opensAt ? new Date(settings.opensAt).toISOString().slice(0, 16) : ''}
								onChange={(e) => updateSetting('opensAt', e.target.value ? new Date(e.target.value).getTime() : undefined)}
								className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-gray-700 dark:text-gray-300"
							/>
						</div>
						<div>
							<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
								Closes at
							</label>
							<input
								type="datetime-local"
								value={settings.closesAt ? new Date(settings.closesAt).toISOString().slice(0, 16) : ''}
								onChange={(e) => updateSetting('closesAt', e.target.value ? new Date(e.target.value).getTime() : undefined)}
								className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-gray-700 dark:text-gray-300"
							/>
						</div>
					</div>

					{/* Closed message */}
					{(settings.maxResponses || settings.closesAt) ? (
						<div>
							<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
								Closed message
							</label>
							<input
								type="text"
								value={settings.closedMessage || ''}
								onChange={(e) => updateSetting('closedMessage', e.target.value)}
								placeholder="This form is no longer accepting responses."
								className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-gray-700 dark:text-gray-300 placeholder-gray-400"
							/>
						</div>
					) : null}

					{/* Divider */}
					<div className="border-t border-gray-100 dark:border-gray-800" />

					{/* Webhooks */}
					<div>
						<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
							<Webhook className="h-3.5 w-3.5" />
							Webhooks
						</label>
						<p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">
							Send response data to external services (Zapier, Make, Slack, etc.)
						</p>
						{(settings.webhooks || []).map((hook, i) => (
							<div key={i} className="flex items-center gap-2 mb-2">
								<input
									type="url"
									value={hook.url}
									onChange={(e) => {
										const next = [...(settings.webhooks || [])]
										next[i] = { ...next[i]!, url: e.target.value }
										onSettingsChange({ ...settings, webhooks: next })
									}}
									placeholder="https://hooks.zapier.com/..."
									className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-gray-700 dark:text-gray-300 placeholder-gray-400"
								/>
								<button
									onClick={() => {
										const next = (settings.webhooks || []).filter((_, j) => j !== i)
										onSettingsChange({ ...settings, webhooks: next.length > 0 ? next : undefined })
									}}
									className="p-1.5 text-gray-400 hover:text-red-500 transition-smooth"
								>
									<Trash2 className="h-3.5 w-3.5" />
								</button>
							</div>
						))}
						<button
							onClick={() => {
								const next: WebhookConfig[] = [...(settings.webhooks || []), { url: '', active: true }]
								onSettingsChange({ ...settings, webhooks: next })
							}}
							className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium flex items-center gap-1"
						>
							<Plus className="h-3 w-3" />
							Add webhook
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
