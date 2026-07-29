import { useEffect, useState } from 'react'
import { AlertCircle, Ban, Calendar, CheckCircle2, Globe, History, Loader2, Lock, Mail, Plus, RotateCcw, Send, Trash2, Webhook } from 'lucide-react'
import { updateSettingsValue, datetimeLocalToTimestamp, timestampToDatetimeLocal } from '../../features/forms/shell'
import { buildPublicFormReadiness } from '../../features/forms/readiness'
import { buildDeliveryStatusSummary, type DeliveryStatusItem } from '../../features/forms/deliveries'
import { THEME_PRESETS } from '../../themes'
import type { FormField, FormSettings as FormSettingsType, WebhookConfig } from '../../types'

type WebhookTestResult = { ok: boolean; message: string }
type EmailTestResult = { ok: boolean; message: string }

const EMAIL_NOTIFICATIONS_ENABLED = import.meta.env.VITE_EMAIL_NOTIFICATIONS_ENABLED === 'true'

interface FormSettingsPanelProps {
	title: string
	status: string
	slug: string
	theme: string
	fields: FormField[]
	auditEvents?: Record<string, unknown>[]
	sideEffectDeliveries?: Record<string, unknown>[]
	settings: FormSettingsType
	hasPassword: boolean
	onStatusChange: (status: string) => void
	onThemeChange: (theme: string) => void
	onSettingsChange: (settings: FormSettingsType) => void
	onPasswordChange: (password: string) => Promise<void> | void
	onPasswordClear: () => void
	onWebhookTest?: (webhook: WebhookConfig) => Promise<WebhookTestResult>
	onEmailTest?: (email: string) => Promise<EmailTestResult>
}

export function FormSettingsPanel({
	title,
	status,
	slug,
	theme,
	fields,
	auditEvents = [],
	sideEffectDeliveries = [],
	settings,
	hasPassword,
	onStatusChange,
	onThemeChange,
	onSettingsChange,
	onPasswordChange,
	onPasswordClear,
	onWebhookTest,
	onEmailTest,
}: FormSettingsPanelProps) {
	const updateSetting = <K extends keyof FormSettingsType>(key: K, value: FormSettingsType[K]) => {
		onSettingsChange(updateSettingsValue(settings, key, value))
	}
	const readiness = buildPublicFormReadiness({ title, status, slug, fields, settings, hasPassword })
	const webhookDeliverySummary = buildDeliveryStatusSummary(sideEffectDeliveries, { type: 'webhook', limit: 4 })
	const webhooks = settings.webhooks || []
	const [testingWebhook, setTestingWebhook] = useState<number | null>(null)
	const [testingEmail, setTestingEmail] = useState(false)
	const [webhookMessages, setWebhookMessages] = useState<Record<number, { kind: 'success' | 'error' | 'muted'; text: string }>>({})
	const [emailMessage, setEmailMessage] = useState<{ kind: 'success' | 'error' | 'muted'; text: string } | null>(null)
	const [headerDrafts, setHeaderDrafts] = useState<Record<number, string>>({})

	const updateWebhook = (index: number, patch: Partial<WebhookConfig>) => {
		const next = webhooks.map((hook, hookIndex) => hookIndex === index ? { ...hook, ...patch } : hook)
		onSettingsChange({ ...settings, webhooks: next.length > 0 ? next : undefined })
	}

	const removeWebhook = (index: number) => {
		const next = webhooks.filter((_, hookIndex) => hookIndex !== index)
		onSettingsChange({ ...settings, webhooks: next.length > 0 ? next : undefined })
	}

	const addWebhook = () => {
		if (webhooks.length >= 5) {
			setWebhookMessages({ ...webhookMessages, [webhooks.length - 1]: { kind: 'error', text: 'A form can have up to 5 webhooks.' } })
			return
		}
		onSettingsChange({ ...settings, webhooks: [...webhooks, { url: '', method: 'POST', active: true }] })
	}

	const commitHeaderDraft = (index: number, value: string) => {
		const trimmed = value.trim()
		if (!trimmed) {
			updateWebhook(index, { headers: undefined })
			setWebhookMessages({ ...webhookMessages, [index]: { kind: 'muted', text: 'Custom headers cleared.' } })
			return
		}
		try {
			const parsed = JSON.parse(trimmed) as unknown
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				throw new Error('Headers must be a JSON object.')
			}
			const headers = Object.fromEntries(
				Object.entries(parsed as Record<string, unknown>)
					.map(([key, value]) => [key.trim(), String(value ?? '').trim()])
					.filter(([key, value]) => key && value),
			)
			updateWebhook(index, { headers: Object.keys(headers).length > 0 ? headers : undefined })
			setHeaderDrafts({ ...headerDrafts, [index]: JSON.stringify(headers, null, 2) })
			setWebhookMessages({ ...webhookMessages, [index]: { kind: 'success', text: 'Headers saved.' } })
		} catch (error) {
			setWebhookMessages({
				...webhookMessages,
				[index]: { kind: 'error', text: error instanceof Error ? error.message : 'Headers must be valid JSON.' },
			})
		}
	}

	const testWebhook = async (index: number) => {
		const hook = webhooks[index]
		if (!hook || !onWebhookTest) return
		setTestingWebhook(index)
		setWebhookMessages({ ...webhookMessages, [index]: { kind: 'muted', text: 'Sending test event...' } })
		try {
			const result = await onWebhookTest(hook)
			setWebhookMessages({
				...webhookMessages,
				[index]: { kind: result.ok ? 'success' : 'error', text: result.message },
			})
		} catch (error) {
			setWebhookMessages({
				...webhookMessages,
				[index]: { kind: 'error', text: error instanceof Error ? error.message : 'Webhook test failed.' },
			})
		} finally {
			setTestingWebhook(null)
		}
	}

	const updateNotificationEmail = (value: string) => {
		const email = value.trim()
		onSettingsChange({ ...settings, notifyEmail: email || undefined })
		setEmailMessage(email ? { kind: 'muted', text: 'Notification email saved locally.' } : null)
	}

	const testEmailNotification = async () => {
		const email = String(settings.notifyEmail || '').trim()
		if (!email || !onEmailTest || !EMAIL_NOTIFICATIONS_ENABLED) return
		setTestingEmail(true)
		setEmailMessage({ kind: 'muted', text: 'Sending test email...' })
		try {
			const result = await onEmailTest(email)
			setEmailMessage({ kind: result.ok ? 'success' : 'error', text: result.message })
		} catch (error) {
			setEmailMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Email test failed.' })
		} finally {
			setTestingEmail(false)
		}
	}

	return (
		<section className="animate-fade-in rounded-b-2xl border border-t-0 border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark sm:p-6">
			<div className="space-y-6">
				<div>
					<h2 className="text-[22px] font-semibold tracking-tight text-slate-950 dark:text-gray-100">Settings</h2>
					<p className="mt-1 text-[14px] text-slate-500 dark:text-gray-400">Control form behavior, access, and presentation.</p>
				</div>

				<div className="kf-panel overflow-hidden p-0">
					<div className="grid gap-0 lg:grid-cols-[280px_1fr]">
						<div className="border-b border-slate-100 bg-slate-50/70 p-5 dark:border-gray-800 dark:bg-gray-900/45 lg:border-b-0 lg:border-r">
							<div className="flex items-center justify-between gap-4">
								<div>
									<p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Readiness</p>
									<p className="mt-1 text-[24px] font-bold tracking-tight text-slate-950 dark:text-gray-100">{readiness.score}%</p>
								</div>
								<span className={`flex h-10 w-10 items-center justify-center rounded-full ${
									readiness.status === 'blocked'
										? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300'
										: readiness.status === 'warning'
											? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
											: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
								}`}>
									{readiness.status === 'ready' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
								</span>
							</div>
							<p className="mt-3 text-[13px] leading-relaxed text-slate-500 dark:text-gray-400">{readiness.summary}</p>
							<p className="mt-3 text-[12px] font-medium text-slate-400 dark:text-gray-500">
								{readiness.coreBlockedCount} core blocked · {readiness.coreWarningCount} core warning{readiness.coreWarningCount === 1 ? '' : 's'}
								{readiness.optionalWarningCount > 0
									? ` · ${readiness.optionalWarningCount} optional warning${readiness.optionalWarningCount === 1 ? '' : 's'}`
									: ''}
							</p>
						</div>
						<div className="grid gap-px bg-slate-100 dark:bg-gray-800 sm:grid-cols-2">
							{readiness.checks.map(check => (
								<div key={check.id} className="bg-white p-4 dark:bg-surface-elevated-dark">
									<div className="flex items-start gap-3">
										<span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
											check.status === 'blocked'
												? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300'
												: check.status === 'warning'
													? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
													: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
										}`}>
											{check.status === 'ready' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
										</span>
										<div className="min-w-0">
											<p className="text-[13px] font-semibold text-slate-800 dark:text-gray-200">{check.label}</p>
											<p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-gray-500">{check.detail}</p>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

				<div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
					<div className="kf-panel p-6">
						<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">Availability</h3>
						<div className="mt-4 grid grid-cols-3 gap-2">
							{[
								{ value: 'draft', label: 'Draft', icon: Ban },
								{ value: 'published', label: 'Live', icon: Globe },
								{ value: 'closed', label: 'Closed', icon: Lock },
							].map(({ value, label, icon: Icon }) => (
								<button
									key={value}
									onClick={() => onStatusChange(value)}
									className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors ${
										status === value
											? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-900/25 dark:text-brand-300'
											: 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'
									}`}
								>
									<Icon className="h-4 w-4" />
									{label}
								</button>
							))}
						</div>

						<div className="mt-5 grid gap-3 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-gray-400">
									<Calendar className="h-3.5 w-3.5" />
									Opens
								</span>
								<input
									type="datetime-local"
									value={timestampToDatetimeLocal(settings.opensAt)}
									onChange={(event) => updateSetting('opensAt', datetimeLocalToTimestamp(event.target.value))}
									className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
								/>
							</label>
							<label className="block">
								<span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-gray-400">
									<Calendar className="h-3.5 w-3.5" />
									Closes
								</span>
								<input
									type="datetime-local"
									value={timestampToDatetimeLocal(settings.closesAt)}
									onChange={(event) => updateSetting('closesAt', datetimeLocalToTimestamp(event.target.value))}
									className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
								/>
							</label>
						</div>
					</div>

					<div className="kf-panel p-6">
						<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">Theme</h3>
						<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Applied as a restrained accent on the public form.</p>
						<div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
							{THEME_PRESETS.map((preset) => (
								<button
									key={preset.id}
									onClick={() => onThemeChange(preset.id)}
									className={`rounded-xl p-2 text-center transition-colors ${
										theme === preset.id ? 'bg-slate-100 dark:bg-gray-800' : 'hover:bg-slate-50 dark:hover:bg-gray-800/60'
									}`}
									title={preset.name}
								>
									<span
										className="mx-auto block h-8 w-8 rounded-full ring-1 ring-black/10"
										style={{
											backgroundColor: preset.preview,
											...(theme === preset.id ? { boxShadow: `0 0 0 3px ${preset.colors[100]}` } : {}),
										}}
									/>
									<span className="mt-1 block truncate text-[10px] text-slate-500 dark:text-gray-400">{preset.name}</span>
								</button>
							))}
						</div>
					</div>
				</div>

				<div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
					<div className="kf-panel p-6">
						<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">After Submit</h3>
						<label className="mt-4 block">
							<span className="mb-1.5 block text-[12px] font-medium text-slate-500 dark:text-gray-400">Thank-you message</span>
							<textarea
								value={settings.thankYouMessage || ''}
								onChange={(event) => updateSetting('thankYouMessage', event.target.value)}
								rows={3}
								placeholder="Thanks. Your response has been received."
								className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
							/>
						</label>
						<label className="mt-3 block">
							<span className="mb-1.5 block text-[12px] font-medium text-slate-500 dark:text-gray-400">Redirect URL</span>
							<input
								type="url"
								value={settings.redirectUrl || ''}
								onChange={(event) => updateSetting('redirectUrl', event.target.value)}
								placeholder="https://example.com/thank-you"
								className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
							/>
						</label>
					</div>

					<div className="kf-panel p-6">
						<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">Responses</h3>
						<div className="mt-4 space-y-4">
							<SettingsCheckbox
								label="Allow multiple submissions"
								checked={settings.allowMultiple !== false}
								onChange={(checked) => updateSetting('allowMultiple', checked)}
							/>
							<SettingsCheckbox
								label="Public results"
								checked={!!settings.publicResults}
								onChange={(checked) => updateSetting('publicResults', checked)}
							/>
							<SettingsCheckbox
								label="Show results after submit"
								checked={!!settings.showResultsAfterSubmit}
								disabled={!settings.publicResults}
								onChange={(checked) => updateSetting('showResultsAfterSubmit', checked)}
							/>
							{settings.publicResults && (
								<div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900/55">
									<label className="block">
										<span className="mb-1.5 block text-[12px] font-medium text-slate-500 dark:text-gray-400">Public results display</span>
										<select
											value={settings.publicResultsMode === 'summary_text' ? 'summary_text' : 'summary'}
											onChange={(event) => updateSetting('publicResultsMode', event.target.value as FormSettingsType['publicResultsMode'])}
											className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
										>
											<option value="summary">Summary only</option>
											<option value="summary_text">Summary plus text excerpts</option>
										</select>
									</label>
									<p className="mt-2 text-[12px] leading-relaxed text-slate-500 dark:text-gray-500">
										Contact, URL, file, signature, calculated, and hidden values are never exposed on public results.
									</p>
									<div className="mt-3 space-y-3">
										<SettingsCheckbox
											label="Show respondent count"
											checked={settings.publicResultsShowRespondentCount !== false}
											onChange={(checked) => updateSetting('publicResultsShowRespondentCount', checked)}
										/>
										<SettingsCheckbox
											label="Show fields with no public answers"
											checked={settings.publicResultsShowEmpty === true}
											onChange={(checked) => updateSetting('publicResultsShowEmpty', checked)}
										/>
									</div>
								</div>
							)}
							<label className="block">
								<span className="mb-1.5 block text-[12px] font-medium text-slate-500 dark:text-gray-400">Response limit</span>
								<input
									type="number"
									min={0}
									value={settings.maxResponses || 0}
									onChange={(event) => updateSetting('maxResponses', Number(event.target.value) || undefined)}
									className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
								/>
							</label>
							<PasswordProtectionControl
								hasPassword={hasPassword}
								onPasswordChange={onPasswordChange}
								onPasswordClear={onPasswordClear}
							/>
						</div>
					</div>
				</div>

				<div className="kf-panel p-6">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-gray-100">
								<Webhook className="h-4 w-4 text-slate-400" />
								Integrations
							</h3>
							<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Optional. Send accepted responses to webhooks after KoraForms stores and syncs them.</p>
						</div>
						<button
							type="button"
							onClick={addWebhook}
							className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
						>
							<Plus className="h-4 w-4" />
							Add webhook
						</button>
					</div>

					<div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-gray-800 dark:bg-gray-900/45">
						<div className="flex flex-col gap-3 xl:flex-row xl:items-end">
							<label className="block min-w-0 flex-1">
								<span className="mb-1.5 flex items-center gap-2 text-[12px] font-medium text-slate-500 dark:text-gray-400">
									<Mail className="h-3.5 w-3.5" />
									Email notification
								</span>
								<input
									type="email"
									value={settings.notifyEmail || ''}
									disabled={!EMAIL_NOTIFICATIONS_ENABLED}
									onChange={(event) => updateNotificationEmail(event.target.value)}
									placeholder="you@example.com"
									className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-brand-300 disabled:cursor-not-allowed disabled:opacity-55 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
								/>
							</label>
							<button
								type="button"
								onClick={testEmailNotification}
								disabled={!EMAIL_NOTIFICATIONS_ENABLED || !settings.notifyEmail || testingEmail || !onEmailTest}
								className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900"
							>
								{testingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
								Send test
							</button>
						</div>
						<p className="mt-2 text-[12px] leading-relaxed text-slate-500 dark:text-gray-400">
							{EMAIL_NOTIFICATIONS_ENABLED
								? 'Send an email to this address when a response is accepted.'
								: 'Prepared for launch, but turned off until Resend is configured.'}
						</p>
						{emailMessage && (
							<p className={`mt-2 text-[12px] ${
								emailMessage.kind === 'success'
									? 'text-emerald-600 dark:text-emerald-400'
									: emailMessage.kind === 'error'
										? 'text-red-600 dark:text-red-400'
										: 'text-slate-500 dark:text-gray-400'
							}`}>
								{emailMessage.text}
							</p>
						)}
					</div>

					{webhooks.length === 0 ? (
						<div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-[13px] text-slate-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
							No webhook is configured. This does not affect readiness; responses remain available in KoraForms. Add a webhook when you want to send a test event and inspect delivery history here.
						</div>
					) : (
						<div className="mt-4 space-y-3">
							{webhooks.map((hook, index) => {
								const message = webhookMessages[index]
								const headerDraft = headerDrafts[index] ?? JSON.stringify(hook.headers || {}, null, 2)
								return (
									<div key={index} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-gray-800 dark:bg-gray-900/45">
										<div className="grid gap-3 xl:grid-cols-[110px_1fr_auto_auto]">
											<label className="block">
												<span className="mb-1.5 block text-[12px] font-medium text-slate-500 dark:text-gray-400">Method</span>
												<select
													value={hook.method || 'POST'}
													onChange={(event) => updateWebhook(index, { method: event.target.value === 'PUT' ? 'PUT' : 'POST' })}
													className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
												>
													<option value="POST">POST</option>
													<option value="PUT">PUT</option>
												</select>
											</label>
											<label className="block min-w-0">
												<span className="mb-1.5 block text-[12px] font-medium text-slate-500 dark:text-gray-400">Endpoint URL</span>
												<input
													type="url"
													value={hook.url}
													onChange={(event) => updateWebhook(index, { url: event.target.value })}
													placeholder="https://hooks.example.com/koraforms"
													className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
												/>
											</label>
											<label className="flex items-end gap-2 pb-2 text-[13px] font-medium text-slate-600 dark:text-gray-300">
												<input
													type="checkbox"
													checked={hook.active !== false}
													onChange={(event) => updateWebhook(index, { active: event.target.checked })}
													className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
												/>
												Active
											</label>
											<div className="flex items-end gap-2">
												<button
													type="button"
													onClick={() => testWebhook(index)}
													disabled={!hook.url || testingWebhook === index || !onWebhookTest}
													className="inline-flex min-w-[92px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900"
												>
													{testingWebhook === index ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
													Test
												</button>
												<button
													type="button"
													onClick={() => removeWebhook(index)}
													className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-red-900/50 dark:hover:bg-red-900/20 dark:hover:text-red-300"
													aria-label="Remove webhook"
													title="Remove webhook"
												>
													<Trash2 className="h-4 w-4" />
												</button>
											</div>
										</div>
										<label className="mt-3 block">
											<span className="mb-1.5 block text-[12px] font-medium text-slate-500 dark:text-gray-400">Headers JSON</span>
											<textarea
												value={headerDraft}
												onChange={(event) => setHeaderDrafts({ ...headerDrafts, [index]: event.target.value })}
												onBlur={(event) => commitHeaderDraft(index, event.target.value)}
												rows={2}
												spellCheck={false}
												placeholder={'{\n  "Authorization": "Bearer ..."\n}'}
												className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-[12px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
											/>
										</label>
										{message && (
											<p className={`mt-2 text-[12px] ${
												message.kind === 'success'
													? 'text-emerald-600 dark:text-emerald-400'
													: message.kind === 'error'
														? 'text-red-600 dark:text-red-400'
														: 'text-slate-500 dark:text-gray-400'
											}`}>
												{message.text}
											</p>
										)}
									</div>
								)
							})}
						</div>
					)}
					<WebhookDeliveryHistory summary={webhookDeliverySummary} />
				</div>

				<div className="kf-panel p-6">
					<div className="flex items-center justify-between gap-4">
						<div>
							<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">Recent Activity</h3>
							<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Owner actions are recorded locally first, then synced for accountability.</p>
						</div>
						<span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-400 dark:bg-gray-900 dark:text-gray-500">
							<History className="h-4 w-4" />
						</span>
					</div>
					<div className="mt-4 divide-y divide-slate-100 dark:divide-gray-800">
						{auditEvents.length === 0 ? (
							<p className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-500 dark:bg-gray-900/50 dark:text-gray-400">
								No activity recorded yet.
							</p>
						) : auditEvents.map(event => (
							<div key={String(event.id || `${event.eventType}-${event.createdAt}`)} className="flex items-start justify-between gap-4 py-3">
								<div className="min-w-0">
									<p className="truncate text-[13px] font-semibold text-slate-800 dark:text-gray-200">{String(event.summary || 'Updated form')}</p>
									<p className="mt-0.5 text-[12px] text-slate-400 dark:text-gray-500">{formatAuditEventType(event.eventType)}</p>
								</div>
								<span className="shrink-0 text-[12px] text-slate-400 dark:text-gray-500">{formatAuditEventTime(event.createdAt)}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	)
}

function formatAuditEventType(value: unknown): string {
	return String(value || 'form_updated')
		.replace(/_/g, ' ')
		.replace(/\b\w/g, char => char.toUpperCase())
}

function formatAuditEventTime(value: unknown): string {
	const timestamp = Number(value || 0)
	if (!Number.isFinite(timestamp) || timestamp <= 0) return ''
	return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function PasswordProtectionControl({
	hasPassword,
	onPasswordChange,
	onPasswordClear,
}: {
	hasPassword: boolean
	onPasswordChange: (password: string) => Promise<void> | void
	onPasswordClear: () => void
}) {
	const [draft, setDraft] = useState('')
	const [status, setStatus] = useState('')

	useEffect(() => {
		setDraft('')
		setStatus(hasPassword ? 'Password set' : '')
	}, [hasPassword])

	const commitDraft = async () => {
		const nextPassword = draft.trim()
		if (!nextPassword) return
		setStatus('Securing password...')
		try {
			await onPasswordChange(nextPassword)
			setDraft('')
			setStatus('Password set')
		} catch {
			setStatus('Could not secure password in this browser')
		}
	}

	return (
		<div>
			<div className="mb-1.5 flex items-center justify-between gap-3">
				<span className="block text-[12px] font-medium text-slate-500 dark:text-gray-400">Password</span>
				{hasPassword && (
					<button
						type="button"
						onClick={() => {
							onPasswordClear()
							setDraft('')
							setStatus('')
						}}
						className="text-[12px] font-medium text-slate-400 transition-colors hover:text-brand-600"
					>
						Remove
					</button>
				)}
			</div>
			<input
				type="password"
				value={draft}
				onChange={(event) => {
					setDraft(event.target.value)
					setStatus(event.target.value ? 'Press Enter or leave the field to save' : hasPassword ? 'Password set' : '')
				}}
				onBlur={() => { commitDraft().catch(() => {}) }}
				onKeyDown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault()
						commitDraft().catch(() => {})
					}
				}}
				placeholder={hasPassword ? 'Enter a new password to replace it' : 'Optional'}
				className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
			/>
			{status && (
				<p className="mt-1.5 text-[11px] text-slate-400 dark:text-gray-500">{status}</p>
			)}
		</div>
	)
}

function WebhookDeliveryHistory({
	summary,
}: {
	summary: ReturnType<typeof buildDeliveryStatusSummary>
}) {
	if (summary.total === 0) {
		return (
			<div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-500 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-400">
				Webhook delivery history will appear here after accepted responses create delivery jobs.
			</div>
		)
	}

	return (
		<div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/40">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p className="text-[13px] font-semibold text-slate-900 dark:text-gray-100">Webhook delivery history</p>
					<p className="mt-1 text-[12px] text-slate-500 dark:text-gray-400">
						{summary.delivered} delivered · {summary.failed} failed · {summary.pending + summary.delivering} waiting
					</p>
				</div>
				{summary.failed > 0 && (
					<span className="inline-flex w-fit items-center rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-300">
						Needs attention
					</span>
				)}
			</div>
			<div className="mt-3 divide-y divide-slate-100 dark:divide-gray-800">
				{summary.latest.map(item => (
					<WebhookDeliveryRow key={item.id} item={item} />
				))}
			</div>
		</div>
	)
}

function WebhookDeliveryRow({ item }: { item: DeliveryStatusItem }) {
	const tone = item.status === 'delivered'
		? 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/20'
		: item.status === 'failed'
			? 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-900/20'
			: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/20'
	const Icon = item.status === 'delivered' ? CheckCircle2 : item.status === 'failed' ? AlertCircle : RotateCcw
	return (
		<div className="flex items-start gap-3 py-3">
			<span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone}`}>
				<Icon className={`h-3.5 w-3.5 ${item.status === 'delivering' ? 'animate-spin' : ''}`} />
			</span>
			<div className="min-w-0 flex-1">
				<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 items-center gap-2">
						<p className="truncate text-[13px] font-semibold text-slate-800 dark:text-gray-200">{item.targetLabel}</p>
						{item.isTest && (
							<span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-gray-900 dark:text-gray-400">
								Test
							</span>
						)}
					</div>
					<p className="shrink-0 text-[11px] text-slate-400 dark:text-gray-500">{formatDeliveryTime(item.updatedAt)}</p>
				</div>
				<p className="mt-1 text-[12px] text-slate-500 dark:text-gray-400">
					{deliveryStatusCopy(item)}
				</p>
			</div>
		</div>
	)
}

function deliveryStatusCopy(item: DeliveryStatusItem): string {
	const prefix = item.isTest ? 'Test event ' : ''
	if (item.status === 'delivered') return `${prefix}delivered after ${item.attempts || 1} attempt${(item.attempts || 1) === 1 ? '' : 's'}.`
	if (item.status === 'failed') {
		const retry = item.nextAttemptAt > Date.now() ? ` Next retry ${formatDeliveryTime(item.nextAttemptAt)}.` : ' Retry is queued.'
		return `${prefix}${item.lastError || 'delivery failed.'}${retry}`
	}
	if (item.status === 'delivering') return `${prefix}delivery is currently in progress.`
	return `${prefix}delivery is waiting for the next processor run.`
}

function formatDeliveryTime(value: number): string {
	if (!value) return 'Unknown time'
	try {
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
		}).format(new Date(value))
	} catch {
		return 'Unknown time'
	}
}

function SettingsCheckbox({
	label,
	checked,
	disabled,
	onChange,
}: {
	label: string
	checked: boolean
	disabled?: boolean
	onChange: (checked: boolean) => void
}) {
	return (
		<label className={`flex items-center justify-between gap-4 text-[13px] font-medium text-slate-600 dark:text-gray-300 ${disabled ? 'opacity-45' : ''}`}>
			<span>{label}</span>
			<input
				type="checkbox"
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked)}
				className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed"
			/>
		</label>
	)
}
