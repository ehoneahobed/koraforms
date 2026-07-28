import { useEffect, useState } from 'react'
import { AlertCircle, Ban, Calendar, CheckCircle2, Globe, History, Lock } from 'lucide-react'
import { updateSettingsValue, datetimeLocalToTimestamp, timestampToDatetimeLocal } from '../../features/forms/shell'
import { buildPublicFormReadiness } from '../../features/forms/readiness'
import { THEME_PRESETS } from '../../themes'
import type { FormField, FormSettings as FormSettingsType } from '../../types'

interface FormSettingsPanelProps {
	title: string
	status: string
	slug: string
	theme: string
	fields: FormField[]
	auditEvents?: Record<string, unknown>[]
	settings: FormSettingsType
	hasPassword: boolean
	onStatusChange: (status: string) => void
	onThemeChange: (theme: string) => void
	onSettingsChange: (settings: FormSettingsType) => void
	onPasswordChange: (password: string) => Promise<void> | void
	onPasswordClear: () => void
}

export function FormSettingsPanel({
	title,
	status,
	slug,
	theme,
	fields,
	auditEvents = [],
	settings,
	hasPassword,
	onStatusChange,
	onThemeChange,
	onSettingsChange,
	onPasswordChange,
	onPasswordClear,
}: FormSettingsPanelProps) {
	const updateSetting = <K extends keyof FormSettingsType>(key: K, value: FormSettingsType[K]) => {
		onSettingsChange(updateSettingsValue(settings, key, value))
	}
	const readiness = buildPublicFormReadiness({ title, status, slug, fields, settings, hasPassword })

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
								{readiness.blockedCount} blocked · {readiness.warningCount} warning{readiness.warningCount === 1 ? '' : 's'}
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
