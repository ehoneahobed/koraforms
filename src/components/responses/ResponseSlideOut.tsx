import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Globe, Monitor, Smartphone, Timer, Trash2, X } from 'lucide-react'
import type { FormField } from '../../types'
import { parseResponseData as parsePersistedResponseData } from '../../domain/forms'
import {
	fieldLabel,
	formatDuration,
	formatResponseValue,
	parseResponseMeta,
	parseUA,
	responseFields,
} from '../../features/responses/utils'
import { copyToClipboard as copyTextToClipboard } from '../../utils/clipboard'
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility'

interface ResponseSlideOutProps {
	responseId: string
	responses: Record<string, unknown>[]
	fields: FormField[]
	onClose: () => void
	onNavigate: (id: string) => void
	onDelete: (id: string) => void
}

export function ResponseSlideOut({
	responseId,
	responses,
	fields,
	onClose,
	onNavigate,
	onDelete,
}: ResponseSlideOutProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	const currentIndex = responses.findIndex(response => response.id === responseId)
	const response = responses[currentIndex]
	const hasPrev = currentIndex > 0
	const hasNext = currentIndex < responses.length - 1
	const responseNumber = responses.length - currentIndex

	const data = parsePersistedResponseData(response?.data)
	const meta = parseResponseMeta(response || {})
	const uaInfo = meta?.ua ? parseUA(meta.ua) : null
	const submittedAt = response?.submittedAt ? new Date(Number(response.submittedAt)) : null
	const dialogRef = useDialogAccessibility<HTMLDivElement>({ onClose, initialFocus: 'dialog' })

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'ArrowUp' && hasPrev) onNavigate(String(responses[currentIndex - 1]?.id))
			else if (event.key === 'ArrowDown' && hasNext) onNavigate(String(responses[currentIndex + 1]?.id))
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [currentIndex, hasPrev, hasNext, onClose, onNavigate, responses])

	useEffect(() => {
		setConfirmingDelete(false)
	}, [responseId])

	const copyToClipboard = async () => {
		const lines: string[] = []
		lines.push(`Response #${responseNumber}`)
		if (submittedAt) lines.push(`Submitted: ${submittedAt.toLocaleString()}`)
		lines.push('')
		for (const field of responseFields(fields)) {
			const value = data[field.id]
			const formatted = formatResponseValue(field, value)
			lines.push(`${fieldLabel(field, data, fields)}: ${formatted.kind === 'empty' ? '(empty)' : formatted.values.join(', ')}`)
		}
		if (meta?.duration) {
			lines.push('')
			lines.push(`Duration: ${formatDuration(Math.round(meta.duration))}`)
		}
		if (uaInfo) lines.push(`Device: ${uaInfo.device} | Browser: ${uaInfo.browser} | OS: ${uaInfo.os}`)
		await copyTextToClipboard(lines.join('\n'))
	}

	if (!response) return null

	return (
		<>
			<div
				className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300"
				onClick={onClose}
			/>

			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="response-slideout-title"
				tabIndex={-1}
				className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] bg-white dark:bg-surface-elevated-dark shadow-2xl flex flex-col animate-slide-in-right outline-none"
			>
				<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
					<div className="min-w-0">
						<h2 id="response-slideout-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
							Response #{responseNumber}
						</h2>
						{submittedAt && (
							<p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
								{submittedAt.toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {submittedAt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
							</p>
						)}
					</div>
					<button
						onClick={onClose}
						aria-label="Close response details"
						className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors shrink-0"
					>
						<X className="h-4 w-4 text-gray-400" />
					</button>
				</div>

				<div className="flex items-center justify-between px-6 py-2 border-b border-gray-50 dark:border-gray-800/50 shrink-0">
					<span className="text-[11px] text-gray-400 tabular-nums">{currentIndex + 1} of {responses.length}</span>
					<div className="flex items-center gap-1">
						<button
							onClick={() => hasPrev && onNavigate(String(responses[currentIndex - 1]?.id))}
							disabled={!hasPrev}
							aria-label="Previous response"
							className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
						<button
							onClick={() => hasNext && onNavigate(String(responses[currentIndex + 1]?.id))}
							disabled={!hasNext}
							aria-label="Next response"
							className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						>
							<ChevronRight className="h-4 w-4" />
						</button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-5">
					{meta && (
						<div className="flex flex-wrap items-center gap-3 mb-5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
							{meta.duration != null && meta.duration > 0 && (
								<span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
									<Timer className="h-3.5 w-3.5 text-gray-400" />
									{formatDuration(Math.round(meta.duration))}
								</span>
							)}
							{uaInfo && (
								<>
									<span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
										{uaInfo.device === 'Mobile' ? <Smartphone className="h-3.5 w-3.5 text-gray-400" /> : <Monitor className="h-3.5 w-3.5 text-gray-400" />}
										{uaInfo.device}
									</span>
									<span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
										<Globe className="h-3.5 w-3.5 text-gray-400" />
										{uaInfo.browser} / {uaInfo.os}
									</span>
								</>
							)}
							{meta.screen && (
								<span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
									<Monitor className="h-3.5 w-3.5 text-gray-400" />
									{meta.screen}
								</span>
							)}
						</div>
					)}

					<div className="flex items-center gap-2 mb-4">
						<span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Answers</span>
						<div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
					</div>

					<div className="space-y-4">
						{responseFields(fields).map(field => {
							const value = data[field.id]
							const formatted = formatResponseValue(field, value)
							return (
								<div key={field.id} className="rounded-xl bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 p-4">
									<p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
										{fieldLabel(field, data, fields)}
										{field.required && <span className="text-red-400 ml-0.5">*</span>}
									</p>
									{formatted.kind === 'list' ? (
										<div className="flex flex-wrap gap-1.5">
											{formatted.values.map(item => (
												<span key={item} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700">
													{item}
												</span>
											))}
										</div>
									) : formatted.kind === 'text' ? (
										<p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap break-words">
											{formatted.values[0]}
										</p>
									) : (
										<p className="text-sm text-gray-300 dark:text-gray-600 italic">Empty</p>
									)}
								</div>
							)
						})}
					</div>
				</div>

				<div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 shrink-0">
					{confirmingDelete ? (
						<div className="flex w-full items-center justify-between gap-3">
							<p className="text-xs font-medium text-gray-600 dark:text-gray-300">Delete this response?</p>
							<div className="flex items-center gap-2">
								<button
									onClick={() => setConfirmingDelete(false)}
									className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
								>
									Cancel
								</button>
								<button
									onClick={() => onDelete(String(response.id))}
									className="inline-flex items-center rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-500"
								>
									Delete
								</button>
							</div>
						</div>
					) : (
						<>
							<div className="flex items-center gap-1.5">
								<button
									onClick={copyToClipboard}
									className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								>
									<Copy className="h-3.5 w-3.5" />
									Copy
								</button>
								<button
									onClick={() => setConfirmingDelete(true)}
									className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
								>
									<Trash2 className="h-3.5 w-3.5" />
									Delete
								</button>
							</div>
							<button
								onClick={onClose}
								className="inline-flex items-center rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 transition-colors shadow-sm"
							>
								Done
							</button>
						</>
					)}
				</div>
			</div>
		</>
	)
}
