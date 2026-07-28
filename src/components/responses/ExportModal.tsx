import { useState } from 'react'
import { Download, FileJson, FileSpreadsheet, X } from 'lucide-react'
import type { FormField } from '../../types'
import { responseFields } from '../../features/responses/utils'

type ExportFormat = 'csv' | 'json'

interface ExportModalProps {
	fields: FormField[]
	responseCount: number
	scopeLabel?: string
	onExportCsv: (fieldIds?: string[], sourceResponses?: Record<string, unknown>[], includeMetadata?: boolean) => void
	onExportJson: (fieldIds?: string[], sourceResponses?: Record<string, unknown>[], includeMetadata?: boolean) => void
	onClose: () => void
}

export function ExportModal({
	fields,
	responseCount,
	scopeLabel,
	onExportCsv,
	onExportJson,
	onClose,
}: ExportModalProps) {
	const [format, setFormat] = useState<ExportFormat>('csv')
	const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(
		new Set(responseFields(fields).map(field => field.id)),
	)
	const [includeMetadata, setIncludeMetadata] = useState(true)

	const dataFields = responseFields(fields)

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

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
			<div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
			<div className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-surface-elevated-dark rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
				<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Export responses</h2>
					<button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors">
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
						className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors shadow-sm"
					>
						<Download className="h-4 w-4" />
						Export {responseCount} responses
					</button>
				</div>
			</div>
		</div>
	)
}
