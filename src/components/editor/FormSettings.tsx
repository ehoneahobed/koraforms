import { useEffect, useState } from 'react'
import { Settings, Link as LinkIcon, Check, Copy, Ban, Globe, ChevronDown, Webhook, Plus, Trash2, X, Mail, Lock, Code, Calendar, Clock } from 'lucide-react'
import { copyToClipboard } from '../../utils/clipboard'
import { clearFormAccessPassword, hasFormAccessPassword, withFormAccessPasswordHash } from '../../domain/formPassword'
import type { FormSettings as FormSettingsType, WebhookConfig } from '../../types'
import { LANGUAGES } from '../../types'

function timestampToDatetimeLocal(ts: number | undefined): string {
	if (!ts) return ''
	const d = new Date(ts)
	const offset = d.getTimezoneOffset()
	const local = new Date(d.getTime() - offset * 60000)
	return local.toISOString().slice(0, 16)
}

function datetimeLocalToTimestamp(val: string): number | undefined {
	if (!val) return undefined
	return new Date(val).getTime()
}

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
	const [testingWebhook, setTestingWebhook] = useState<number | null>(null)
	const [webhookResult, setWebhookResult] = useState<Record<number, 'ok' | 'fail'>>({})

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

	const copyUrl = async () => {
		if (!formUrl) return
		const ok = await copyToClipboard(formUrl)
		setCopied(ok)
		setTimeout(() => setCopied(false), 2000)
	}

	const testWebhook = async (index: number) => {
		const hook = (settings.webhooks || [])[index]
		if (!hook?.url) return
		setTestingWebhook(index)
		setWebhookResult(prev => { const next = { ...prev }; delete next[index]; return next })
		try {
			await fetch(hook.url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				mode: 'no-cors',
				body: JSON.stringify({
					event: 'test',
					form: { title: 'Test Form', slug: slug },
					response: { data: { name: 'Test User', email: 'test@example.com' }, submittedAt: Date.now() },
				}),
			})
			// no-cors mode always succeeds
			setWebhookResult(prev => ({ ...prev, [index]: 'ok' }))
		} catch {
			setWebhookResult(prev => ({ ...prev, [index]: 'fail' }))
		} finally {
			setTestingWebhook(null)
		}
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
					<div>
						<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
							<Calendar className="h-3.5 w-3.5" />
							Scheduling
						</label>
						<p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">
							Set when your form opens and closes for responses.
						</p>

						{/* Status indicator */}
						{settings.opensAt && settings.opensAt > Date.now() && (
							<div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
								<Clock className="h-3.5 w-3.5 text-amber-500" />
								<span className="text-xs text-amber-700 dark:text-amber-300">
									Scheduled to open: {new Date(settings.opensAt).toLocaleString()}
								</span>
							</div>
						)}
						{settings.closesAt && settings.closesAt > Date.now() && (!settings.opensAt || settings.opensAt <= Date.now()) && (
							<div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
								<Clock className="h-3.5 w-3.5 text-blue-500" />
								<span className="text-xs text-blue-700 dark:text-blue-300">
									Closes: {new Date(settings.closesAt).toLocaleString()}
								</span>
							</div>
						)}
						{settings.closesAt && settings.closesAt <= Date.now() && (
							<div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
								<Clock className="h-3.5 w-3.5 text-red-500" />
								<span className="text-xs text-red-700 dark:text-red-300">
									Closed since: {new Date(settings.closesAt).toLocaleString()}
								</span>
							</div>
						)}

						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">
									Opens at
								</label>
								<div className="flex gap-1.5">
									<input
										type="datetime-local"
										value={timestampToDatetimeLocal(settings.opensAt)}
										onChange={(e) => updateSetting('opensAt', datetimeLocalToTimestamp(e.target.value))}
										className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-gray-700 dark:text-gray-300"
									/>
									{settings.opensAt && (
										<button
											onClick={() => updateSetting('opensAt', undefined)}
											className="p-2 text-gray-400 hover:text-red-500 transition-smooth rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
											title="Clear open date"
										>
											<X className="h-3.5 w-3.5" />
										</button>
									)}
								</div>
							</div>
							<div>
								<label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">
									Closes at
								</label>
								<div className="flex gap-1.5">
									<input
										type="datetime-local"
										value={timestampToDatetimeLocal(settings.closesAt)}
										onChange={(e) => updateSetting('closesAt', datetimeLocalToTimestamp(e.target.value))}
										className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-gray-700 dark:text-gray-300"
									/>
									{settings.closesAt && (
										<button
											onClick={() => updateSetting('closesAt', undefined)}
											className="p-2 text-gray-400 hover:text-red-500 transition-smooth rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
											title="Clear close date"
										>
											<X className="h-3.5 w-3.5" />
										</button>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Closed message */}
					{settings.closesAt && (
						<div>
							<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
								Closed message
							</label>
							<textarea
								value={settings.closedMessage || ''}
								onChange={(e) => updateSetting('closedMessage', e.target.value)}
								placeholder="This form is no longer accepting responses."
								rows={2}
								className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-gray-700 dark:text-gray-300 placeholder-gray-400 resize-none"
							/>
						</div>
					)}

					{/* Divider */}
					<div className="border-t border-gray-100 dark:border-gray-800" />

					{/* Multi-language */}
					<div>
						<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
							<Globe className="h-3.5 w-3.5" />
							Languages
						</label>
						<p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">
							Add languages so respondents can fill the form in their preferred language.
						</p>
						<div className="flex flex-wrap gap-1.5 mb-2">
							{(settings.languages || []).map(code => {
								const lang = LANGUAGES.find(l => l.code === code)
								return (
									<span key={code} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-xs font-medium">
										{lang?.name || code}
										{code === (settings.defaultLanguage || settings.languages?.[0]) && (
											<span className="text-[9px] text-brand-400">default</span>
										)}
										<button
											onClick={() => {
												const next = (settings.languages || []).filter(l => l !== code)
												onSettingsChange({ ...settings, languages: next.length > 0 ? next : undefined })
											}}
											className="p-0.5 text-brand-400 hover:text-red-500 transition-smooth"
										>
											<X className="h-2.5 w-2.5" />
										</button>
									</span>
								)
							})}
						</div>
						<select
							value=""
							onChange={(e) => {
								if (!e.target.value) return
								const next = [...(settings.languages || []), e.target.value]
								onSettingsChange({ ...settings, languages: next, defaultLanguage: settings.defaultLanguage || next[0] })
								e.target.value = ''
							}}
							className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none text-gray-700 dark:text-gray-300"
						>
							<option value="">Add a language...</option>
							{LANGUAGES.filter(l => !(settings.languages || []).includes(l.code)).map(l => (
								<option key={l.code} value={l.code}>{l.name}</option>
							))}
						</select>
					</div>

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
							<div key={i} className="mb-2">
								<div className="flex items-center gap-2">
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
										onClick={() => testWebhook(i)}
										disabled={!hook.url || testingWebhook === i}
										className="px-2 py-1.5 text-xs text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-smooth disabled:opacity-40 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
										title="Send test webhook"
									>
										{testingWebhook === i ? '...' : 'Test'}
									</button>
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
								{webhookResult[i] === 'ok' && (
									<span className="text-[10px] text-emerald-500 ml-1">&#10003; Sent</span>
								)}
								{webhookResult[i] === 'fail' && (
									<span className="text-[10px] text-red-500 ml-1">&#10007; Failed</span>
								)}
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

					{/* Divider */}
					<div className="border-t border-gray-100 dark:border-gray-800" />

					{/* Email notifications */}
					<div>
						<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
							<Mail className="h-3.5 w-3.5" />
							Email notifications
						</label>
						<p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">
							Get notified by email when someone submits a response.
						</p>
						<input
							type="email"
							value={settings.notifyEmail || ''}
							onChange={(e) => updateSetting('notifyEmail', e.target.value)}
							placeholder="you@example.com"
							className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-gray-700 dark:text-gray-300 placeholder-gray-400"
						/>
					</div>

					{/* Divider */}
					<div className="border-t border-gray-100 dark:border-gray-800" />

					<PasswordProtectionSettings
						settings={settings}
						onSettingsChange={onSettingsChange}
					/>

					{/* Divider */}
					<div className="border-t border-gray-100 dark:border-gray-800" />

					{/* Custom CSS */}
					<div>
						<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
							<Code className="h-3.5 w-3.5" />
							Custom CSS
						</label>
						<p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">
							Add custom styles to your form. Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.kf-form</code> as the root selector.
						</p>
						<textarea
							value={settings.customCSS || ''}
							onChange={(e) => updateSetting('customCSS', e.target.value)}
							placeholder={`.kf-form {\n  font-family: 'Inter', sans-serif;\n}\n.kf-form .kf-question {\n  border-radius: 16px;\n}`}
							rows={5}
							spellCheck={false}
							className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-900 dark:bg-gray-950 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-emerald-400 dark:text-emerald-300 placeholder-gray-600 font-mono resize-y"
						/>
					</div>
				</div>
			)}
		</div>
	)
}

function PasswordProtectionSettings({
	settings,
	onSettingsChange,
}: {
	settings: FormSettingsType
	onSettingsChange: (settings: FormSettingsType) => void
}) {
	const [draft, setDraft] = useState('')
	const [status, setStatus] = useState('')
	const hasPassword = hasFormAccessPassword(settings)

	useEffect(() => {
		setDraft('')
		setStatus(hasPassword ? 'Password set' : '')
	}, [hasPassword, settings.passwordHash, settings.passwordSalt, settings.password])

	const commitDraft = async () => {
		const nextPassword = draft.trim()
		if (!nextPassword) return
		setStatus('Securing password...')
		try {
			onSettingsChange(await withFormAccessPasswordHash(settings, nextPassword))
			setDraft('')
			setStatus('Password set')
		} catch {
			setStatus('Could not secure password in this browser')
		}
	}

	return (
		<div>
			<div className="mb-2 flex items-center justify-between gap-3">
				<label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
					<Lock className="h-3.5 w-3.5" />
					Password protection
				</label>
				{hasPassword && (
					<button
						type="button"
						onClick={() => {
							onSettingsChange(clearFormAccessPassword(settings))
							setDraft('')
							setStatus('')
						}}
						className="text-[11px] font-medium text-gray-400 transition-smooth hover:text-brand-500"
					>
						Remove
					</button>
				)}
			</div>
			<p className="mb-3 text-[10px] text-gray-400 dark:text-gray-500">
				Require a password to access this form. New passwords are stored as hashes.
			</p>
			<input
				type="password"
				value={draft}
				onChange={(e) => {
					setDraft(e.target.value)
					setStatus(e.target.value ? 'Press Enter or leave the field to save' : hasPassword ? 'Password set' : '')
				}}
				onBlur={() => { commitDraft().catch(() => {}) }}
				onKeyDown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault()
						commitDraft().catch(() => {})
					}
				}}
				placeholder={hasPassword ? 'Enter a new password to replace it' : 'Enter a password...'}
				className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition-smooth placeholder-gray-400 focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:focus:border-brand-600"
			/>
			{status && <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">{status}</p>}
		</div>
	)
}
