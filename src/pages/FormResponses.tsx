import { useState } from 'react'
import { useQuery, useCollection } from '@korajs/react'
import { ArrowLeft, Download, FileSpreadsheet, ChevronDown, ChevronRight, BarChart3 } from 'lucide-react'
import type { FormField } from '../types'

interface Props {
	formId: string
	navigate: (path: string) => void
}

export function FormResponses({ formId, navigate }: Props) {
	const forms = useCollection('forms')
	const responsesCollection = useCollection('responses')
	const allForms = useQuery(forms.where({}).orderBy('createdAt', 'desc'))
	const allResponses = useQuery(
		responsesCollection.where({}).orderBy('submittedAt', 'desc'),
	)

	const form = allForms.find((f) => f.id === formId)
	const responses = allResponses.filter((r) => String(r.formId) === formId)
	const [view, setView] = useState<'cards' | 'table'>('cards')
	const [expandedId, setExpandedId] = useState<string | null>(null)

	if (!form) {
		return (
			<div className="text-center py-20 text-gray-500 animate-fade-in">
				<p className="text-lg mb-2">Form not found</p>
				<button onClick={() => navigate('')} className="text-brand-500 hover:underline text-sm">
					Go back
				</button>
			</div>
		)
	}

	let fields: FormField[] = []
	try {
		fields = JSON.parse(String(form.fields || '[]'))
	} catch {
		// ignore
	}

	const exportCsv = () => {
		if (responses.length === 0) return

		const headers = ['#', 'Submitted At', ...fields.map((f) => f.label || f.id)]
		const rows = responses.map((r, i) => {
			let data: Record<string, string> = {}
			try {
				data = JSON.parse(String(r.data || '{}'))
			} catch {
				// ignore
			}
			const submittedAt = r.submittedAt
				? new Date(Number(r.submittedAt)).toLocaleString()
				: ''
			return [String(i + 1), submittedAt, ...fields.map((f) => data[f.id] || '')]
		})

		const csvContent = [headers, ...rows]
			.map((row) =>
				row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
			)
			.join('\n')

		const blob = new Blob([csvContent], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${String(form.title || 'form')}-responses.csv`
		a.click()
		URL.revokeObjectURL(url)
	}

	return (
		<div className="animate-fade-in">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<button
					onClick={() => navigate('')}
					className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
				>
					<ArrowLeft className="h-4 w-4" />
					Back
				</button>
				<div className="flex items-center gap-2">
					{responses.length > 0 && (
						<>
							<div className="flex rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
								<button
									onClick={() => setView('cards')}
									className={`px-3 py-1.5 text-xs font-medium transition-smooth ${
										view === 'cards'
											? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
											: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
									}`}
								>
									Cards
								</button>
								<button
									onClick={() => setView('table')}
									className={`px-3 py-1.5 text-xs font-medium transition-smooth ${
										view === 'table'
											? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
											: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
									}`}
								>
									Table
								</button>
							</div>
							<button
								onClick={exportCsv}
								className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 transition-smooth hover:bg-gray-200 dark:hover:bg-gray-700"
							>
								<Download className="h-3.5 w-3.5" />
								CSV
							</button>
						</>
					)}
				</div>
			</div>

			{/* Title + stats */}
			<div className="mb-8">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
					{String(form.title)}
				</h1>
				<div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
					<span className="flex items-center gap-1.5">
						<BarChart3 className="h-4 w-4" />
						{responses.length} response{responses.length !== 1 ? 's' : ''}
					</span>
				</div>
			</div>

			{/* Empty state */}
			{responses.length === 0 && (
				<div className="flex flex-col items-center justify-center py-20">
					<div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
						<FileSpreadsheet className="h-8 w-8 text-gray-400" />
					</div>
					<h2 className="text-lg font-semibold mb-2">No responses yet</h2>
					<p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-sm mb-6">
						Share the form to start collecting responses. All data is saved locally and syncs when connected.
					</p>
					<button
						onClick={() => navigate(`fill/${formId}`)}
						className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-smooth hover:bg-brand-500 active:scale-[0.98]"
					>
						Test form yourself
					</button>
				</div>
			)}

			{/* Card view */}
			{responses.length > 0 && view === 'cards' && (
				<div className="space-y-2">
					{responses.map((response, index) => {
						let data: Record<string, string> = {}
						try {
							data = JSON.parse(String(response.data || '{}'))
						} catch {
							// ignore
						}
						const submittedAt = response.submittedAt
							? new Date(Number(response.submittedAt)).toLocaleString()
							: 'Unknown'
						const isExpanded = expandedId === response.id
						const firstField = fields[0]
						const preview = firstField ? data[firstField.id] || '' : ''

						return (
							<div
								key={response.id}
								className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark overflow-hidden transition-smooth"
							>
								<button
									onClick={() => setExpandedId(isExpanded ? null : response.id)}
									className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-smooth"
								>
									<span className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-500 shrink-0">
										{responses.length - index}
									</span>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
											{preview || 'Response'}
										</p>
										<p className="text-xs text-gray-400 dark:text-gray-500">
											{submittedAt}
										</p>
									</div>
									{isExpanded ? (
										<ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
									) : (
										<ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
									)}
								</button>

								{isExpanded && (
									<div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-800 animate-fade-in">
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
											{fields.map((field) => (
												<div key={field.id}>
													<p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">
														{field.label || field.id}
													</p>
													<p className="text-sm text-gray-900 dark:text-gray-100">
														{data[field.id] || (
															<span className="text-gray-300 dark:text-gray-600 italic">
																Empty
															</span>
														)}
													</p>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)
					})}
				</div>
			)}

			{/* Table view */}
			{responses.length > 0 && view === 'table' && (
				<div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-gray-100 dark:border-gray-800">
								<th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
									#
								</th>
								<th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
									Date
								</th>
								{fields.map((field) => (
									<th
										key={field.id}
										className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap"
									>
										{field.label || field.id}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{responses.map((response, index) => {
								let data: Record<string, string> = {}
								try {
									data = JSON.parse(String(response.data || '{}'))
								} catch {
									// ignore
								}
								const submittedAt = response.submittedAt
									? new Date(Number(response.submittedAt)).toLocaleDateString()
									: ''

								return (
									<tr
										key={response.id}
										className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-smooth"
									>
										<td className="px-4 py-3 text-gray-400 tabular-nums">
											{responses.length - index}
										</td>
										<td className="px-4 py-3 text-gray-500 whitespace-nowrap">
											{submittedAt}
										</td>
										{fields.map((field) => (
											<td
												key={field.id}
												className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-[200px] truncate"
											>
												{data[field.id] || (
													<span className="text-gray-300 dark:text-gray-600">
														—
													</span>
												)}
											</td>
										))}
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}
