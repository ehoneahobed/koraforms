import { useState } from 'react'
import { Download, FileJson, FileSpreadsheet, X } from 'lucide-react'
import type { FormField } from '../../types'
import { responseFields } from '../../features/responses/utils'
import type { ResponseExportPreset } from '../../features/responses/actions'
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility'

type ExportFormat = 'csv' | 'json'

interface ExportModalProps {
	fields: FormField[]
	responseCount: number
	scopeLabel?: string
	onExportCsv: (fieldIds?: string[], sourceResponses?: Record<string, unknown>[], includeMetadata?: boolean) => void
	onExportJson: (fieldIds?: string[], sourceResponses?: Record<string, unknown>[], includeMetadata?: boolean) => void
	savedPresets?: ResponseExportPreset[]
	onSavePreset?: (preset: { name: string; format: ExportFormat; selectedFieldIds: string[]; includeMetadata: boolean }) => Promise<void> | void
	onDeletePreset?: (id: string) => Promise<void> | void
	onClose: () => void
}

export function ExportModal({
	fields,
	responseCount,
	scopeLabel,
	onExportCsv,
	onExportJson,
	savedPresets = [],
	onSavePreset,
	onDeletePreset,
	onClose,
}: ExportModalProps) {
	const [format, setFormat] = useState<ExportFormat>('csv')
	const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(
		new Set(responseFields(fields).map(field => field.id)),
	)
	const [includeMetadata, setIncludeMetadata] = useState(true)
	const [showSavePreset, setShowSavePreset] = useState(false)
	const [presetName, setPresetName] = useState('')
	const [isSavingPreset, setIsSavingPreset] = useState(false)
	const [busyPresetId, setBusyPresetId] = useState<string | null>(null)
	const dialogRef = useDialogAccessibility<HTMLDivElement>({ onClose })

	const dataFields = responseFields(fields)
	const validFieldIds = new Set(dataFields.map(field => field.id))

	const toggleField = (id: string) => {
		setSelectedFieldIds(prev => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const handleExport = () => {
		const ids = Array.from(selectedFieldIds)
		if (format === 'csv') onExportCsv(ids, undefined, includeMetadata)
		else onExportJson(ids, undefined, includeMetadata)
		onClose()
	}

	const applyPreset = (preset: ResponseExportPreset) => {
		const ids = preset.selectedFieldIds.filter(id => validFieldIds.has(id))
		setFormat(preset.format)
		setSelectedFieldIds(new Set(ids.length > 0 ? ids : dataFields.map(field => field.id)))
		setIncludeMetadata(preset.includeMetadata)
	}

	const savePreset = async () => {
		const name = presetName.trim()
		if (!name || !onSavePreset) return
		setIsSavingPreset(true)
		try {
			await onSavePreset({
				name,
				format,
				selectedFieldIds: Array.from(selectedFieldIds),
				includeMetadata,
			})
			setPresetName('')
			setShowSavePreset(false)
		} finally {
			setIsSavingPreset(false)
		}
	}

	const deletePreset = async (preset: ResponseExportPreset) => {
		if (!onDeletePreset) return
		setBusyPresetId(preset.id)
		try {
			await onDeletePreset(preset.id)
		} finally {
			setBusyPresetId(null)
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
			<div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="export-dialog-title"
				tabIndex={-1}
				className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-surface-elevated-dark rounded-2xl shadow-2xl overflow-hidden animate-fade-in outline-none"
			>
				<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
					<h2 id="export-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">Export responses</h2>
					<button
						onClick={onClose}
						aria-label="Close export dialog"
						className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
					>
						<X className="h-4 w-4 text-gray-400" />
					</button>
				</div>

				<div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
					<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/50">
						<p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500">Scope</p>
						<p className="mt-1 text-sm font-medium text-slate-700 dark:text-gray-300">
							{scopeLabel || 'All responses currently visible in this view'}
						</p>
					</div>

					{(savedPresets.length > 0 || onSavePreset) && (
						<div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/40">
							<div className="mb-2 flex items-center justify-between gap-3">
								<div>
									<p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500">Presets</p>
									<p className="mt-0.5 text-xs text-slate-400 dark:text-gray-500">Save field and format choices for repeat exports.</p>
								</div>
								{onSavePreset && !showSavePreset && (
									<button
										onClick={() => setShowSavePreset(true)}
										className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
									>
										Save preset
									</button>
								)}
							</div>
							{showSavePreset && (
								<form
									onSubmit={event => {
										event.preventDefault()
										void savePreset()
									}}
									className="mb-2 flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-gray-800 dark:bg-gray-950"
								>
									<input
										value={presetName}
										onChange={event => setPresetName(event.target.value)}
										placeholder="Preset name"
										maxLength={64}
										className="h-8 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2 text-xs font-medium text-slate-700 outline-none placeholder:text-slate-400 dark:text-gray-200"
										aria-label="Export preset name"
									/>
									<button
										type="submit"
										disabled={!presetName.trim() || isSavingPreset}
										className="h-8 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950"
									>
										Save
									</button>
									<button
										type="button"
										onClick={() => {
											setShowSavePreset(false)
											setPresetName('')
										}}
										className="h-8 rounded-md px-2 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-gray-200"
									>
										Cancel
									</button>
								</form>
							)}
							{savedPresets.length > 0 && (
								<div className="flex gap-2 overflow-x-auto pb-1">
									{savedPresets.map(preset => (
										<div key={preset.id} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-50 p-1 ring-1 ring-slate-200 dark:bg-gray-950 dark:ring-gray-800">
											<button
												onClick={() => applyPreset(preset)}
												className="rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-white dark:text-gray-300 dark:hover:bg-gray-900"
											>
												{preset.name}
												<span className="ml-1 font-medium uppercase text-slate-400 dark:text-gray-500">{preset.format}</span>
											</button>
											{onDeletePreset && (
												<button
													onClick={() => void deletePreset(preset)}
													disabled={busyPresetId === preset.id}
													className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-red-500 disabled:opacity-40 dark:hover:bg-gray-900"
													aria-label={`Delete export preset ${preset.name}`}
												>
													&times;
												</button>
											)}
										</div>
									))}
								</div>
							)}
						</div>
					)}

					<div>
						<label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Format</label>
						<div className="flex gap-2">
							{(['csv', 'json'] as const).map(exportFormat => (
								<button
									key={exportFormat}
									onClick={() => setFormat(exportFormat)}
									className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
										format === exportFormat
											? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800'
											: 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
									}`}
								>
									{exportFormat === 'csv' ? (
										<span className="inline-flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" />CSV</span>
									) : (
										<span className="inline-flex items-center gap-1.5"><FileJson className="h-3.5 w-3.5" />JSON</span>
									)}
								</button>
							))}
						</div>
					</div>

					<div>
						<label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Fields</label>
						<div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 p-3">
							{dataFields.map(field => (
								<label key={field.id} className="flex items-center gap-2 cursor-pointer py-0.5">
									<input
										type="checkbox"
										checked={selectedFieldIds.has(field.id)}
										onChange={() => toggleField(field.id)}
										className="rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500/20"
									/>
									<span className="text-sm text-gray-700 dark:text-gray-300 truncate">{field.label || field.id}</span>
								</label>
							))}
						</div>
					</div>

					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={includeMetadata}
							onChange={event => setIncludeMetadata(event.target.checked)}
							className="rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500/20"
						/>
						<span className="text-sm text-gray-700 dark:text-gray-300">Include submission date and status</span>
					</label>

					<div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 px-4 py-3">
						<p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
							This export may contain personal information.
						</p>
					</div>

					<div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
						<span>Generated on this device</span>
						<span className="tabular-nums">{format.toUpperCase()} · {responseCount} responses · {selectedFieldIds.size} fields</span>
					</div>
				</div>

				<div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
					<button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
						Cancel
					</button>
					<button
						onClick={handleExport}
						disabled={selectedFieldIds.size === 0}
						className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-45"
					>
						<Download className="h-4 w-4" />
						Export {responseCount} responses
					</button>
				</div>
			</div>
		</div>
	)
}
