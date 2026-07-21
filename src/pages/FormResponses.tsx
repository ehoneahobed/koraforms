import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@korajs/react'
import { app } from '../kora'
import { setPageMeta } from '../utils/meta'
import { ArrowLeft, Download, FileSpreadsheet, ChevronDown, ChevronRight, BarChart3, Share2, ExternalLink, Clock, TrendingUp, FileText } from 'lucide-react'
import type { FormField } from '../types'

interface Props {
	formId: string
	navigate: (path: string) => void
}

export function FormResponses({ formId, navigate }: Props) {
	const allForms = useQuery(app.forms.where({}).orderBy('createdAt', 'desc'))
	const allResponses = useQuery(
		app.responses.where({}).orderBy('submittedAt', 'desc'),
	)

	const form = allForms.find((f) => f.id === formId)
	const responses = allResponses.filter((r) => String(r.formId) === formId)

	useEffect(() => {
		setPageMeta({
			title: form ? `Responses: ${form.title}` : 'Responses',
			description: 'View and export form responses.',
		})
	}, [form?.title])

	const [view, setView] = useState<'cards' | 'table' | 'analytics'>('cards')
	const [expandedId, setExpandedId] = useState<string | null>(null)

	if (!form) {
		return (
			<div className="text-center py-20 text-gray-500 animate-fade-in">
				<p className="text-lg mb-2">Form not found</p>
				<button onClick={() => navigate('dashboard')} className="text-brand-500 hover:underline text-sm">
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

	const exportPdf = () => {
		if (responses.length === 0) return

		// Parse all response data for the report
		const allData = responses.map((r) => {
			try { return JSON.parse(String(r.data || '{}')) as Record<string, string> } catch { return {} }
		})

		// Compute per-field summaries
		const fieldSummaries = fields
			.filter(f => f.type !== 'section' && f.type !== 'statement')
			.map(field => {
				const vals = allData.map(d => d[field.id] ?? '').filter(v => v !== '')
				const isCategorical = ['select', 'radio', 'checkbox', 'yesno'].includes(field.type)
				const isNumeric = ['number', 'rating', 'scale'].includes(field.type)

				if (isCategorical) {
					const counts: Record<string, number> = {}
					for (const v of vals) {
						const parts = field.type === 'checkbox' ? v.split(',') : [v]
						for (const p of parts) { const t = p.trim(); if (t) counts[t] = (counts[t] ?? 0) + 1 }
					}
					const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
					return { label: field.label, type: 'categorical' as const, data: sorted, total: vals.length }
				}
				if (isNumeric) {
					const nums = vals.map(Number).filter(n => !isNaN(n))
					if (nums.length > 0) {
						const sum = nums.reduce((a, b) => a + b, 0)
						return { label: field.label, type: 'numeric' as const, avg: (sum / nums.length).toFixed(1), min: Math.min(...nums), max: Math.max(...nums), count: nums.length }
					}
				}
				return { label: field.label, type: 'text' as const, total: vals.length, unique: new Set(vals).size }
			})

		// Compute avg completion time
		const durations: number[] = []
		for (const d of allData) {
			const meta = (d as Record<string, unknown>)._meta as { duration?: number } | undefined
			if (meta?.duration && meta.duration > 0 && meta.duration < 86400) durations.push(meta.duration)
		}
		const avgTime = durations.length > 0 ? formatDuration(Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)) : 'N/A'

		const title = String(form.title || 'Form')
		const now = new Date().toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })

		const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title} — Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px;color:#1a1a1a;max-width:800px;margin:0 auto;font-size:13px}
h1{font-size:22px;margin-bottom:4px}
.subtitle{color:#666;font-size:13px;margin-bottom:24px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}
.stat{background:#f8f9fa;border-radius:8px;padding:14px}
.stat-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
.stat-value{font-size:20px;font-weight:700}
h2{font-size:16px;margin:24px 0 12px;padding-top:16px;border-top:1px solid #eee}
.field-card{background:#fafafa;border-radius:8px;padding:14px;margin-bottom:12px}
.field-name{font-weight:600;margin-bottom:8px}
.bar-row{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.bar-label{width:140px;text-align:right;font-size:12px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{flex:1;background:#eee;border-radius:4px;height:14px;overflow:hidden}
.bar-fill{background:#e53e3e;border-radius:4px;height:100%}
.bar-count{font-size:11px;color:#888;width:60px}
.num-stats{display:flex;gap:20px;font-size:13px}
.num-stats span{color:#888}
.text-stats{font-size:13px;color:#555}
.footer{text-align:center;color:#aaa;font-size:11px;margin-top:40px;padding-top:16px;border-top:1px solid #eee}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
th{text-align:left;padding:6px 8px;background:#f0f0f0;border-bottom:1px solid #ddd;font-weight:600;font-size:11px;text-transform:uppercase;color:#666}
td{padding:6px 8px;border-bottom:1px solid #f0f0f0}
tr:nth-child(even){background:#fafafa}
@media print{body{padding:20px}h2{page-break-before:auto}.field-card{break-inside:avoid}}
</style></head><body>
<h1>${title}</h1>
<p class="subtitle">Report generated on ${now} &bull; ${responses.length} response${responses.length !== 1 ? 's' : ''}</p>
<div class="stats">
<div class="stat"><div class="stat-label">Responses</div><div class="stat-value">${responses.length}</div></div>
<div class="stat"><div class="stat-label">Fields</div><div class="stat-value">${fields.length}</div></div>
<div class="stat"><div class="stat-label">Avg. Time</div><div class="stat-value">${avgTime}</div></div>
<div class="stat"><div class="stat-label">Date Range</div><div class="stat-value" style="font-size:13px">${responses.length > 0 && responses.at(-1)?.submittedAt ? new Date(Number(responses.at(-1)!.submittedAt)).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'} — ${responses.length > 0 && responses[0]?.submittedAt ? new Date(Number(responses[0].submittedAt)).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</div></div>
</div>
<h2>Field Summary</h2>
${fieldSummaries.map(s => {
			if (s.type === 'categorical') {
				const maxC = s.data[0]?.[1] ?? 1
				return `<div class="field-card"><div class="field-name">${s.label}</div>${s.data.slice(0, 10).map(([label, count]) =>
					`<div class="bar-row"><div class="bar-label">${label}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round((count / maxC) * 100)}%"></div></div><div class="bar-count">${count} (${s.total > 0 ? Math.round((count / s.total) * 100) : 0}%)</div></div>`
				).join('')}</div>`
			}
			if (s.type === 'numeric') {
				return `<div class="field-card"><div class="field-name">${s.label}</div><div class="num-stats"><span>Average:</span> <strong>${s.avg}</strong> &nbsp; <span>Min:</span> <strong>${s.min}</strong> &nbsp; <span>Max:</span> <strong>${s.max}</strong> &nbsp; <span>Count:</span> <strong>${s.count}</strong></div></div>`
			}
			return `<div class="field-card"><div class="field-name">${s.label}</div><div class="text-stats">${s.total} responses, ${s.unique} unique values</div></div>`
		}).join('\n')}
<h2>All Responses</h2>
<table><thead><tr><th>#</th><th>Date</th>${fields.slice(0, 8).map(f => `<th>${f.label || f.id}</th>`).join('')}</tr></thead><tbody>
${responses.slice(0, 100).map((r, i) => {
			const data = allData[i] ?? {}
			const date = r.submittedAt ? new Date(Number(r.submittedAt)).toLocaleDateString() : ''
			return `<tr><td>${responses.length - i}</td><td>${date}</td>${fields.slice(0, 8).map(f => `<td>${(data[f.id] || '—').slice(0, 60)}</td>`).join('')}</tr>`
		}).join('\n')}
</tbody></table>
${responses.length > 100 ? `<p style="text-align:center;color:#888;margin-top:8px;font-size:12px">Showing first 100 of ${responses.length} responses</p>` : ''}
<div class="footer">Generated by KoraForms &bull; forms.korajs.dev</div>
</body></html>`

		const w = window.open('', '_blank')
		if (w) {
			w.document.write(html)
			w.document.close()
			setTimeout(() => w.print(), 500)
		}
	}

	const latestResponseTime = responses.length > 0 && responses[0]?.submittedAt
		? formatTimeSince(Number(responses[0].submittedAt))
		: null

	return (
		<div className="animate-fade-in">
			{/* Hero header */}
			<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-600 p-6 sm:p-8 mb-8 shadow-lg shadow-emerald-600/10">
				<div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
				<div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

				<div className="relative">
					<button
						onClick={() => navigate('dashboard')}
						className="inline-flex items-center gap-1.5 text-sm text-emerald-200 hover:text-white mb-5 transition-smooth"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to dashboard
					</button>

					<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
						<div>
							<h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">
								{String(form.title)}
							</h1>
							<div className="flex flex-wrap items-center gap-3 text-sm text-emerald-200">
								<span className="flex items-center gap-1.5">
									<BarChart3 className="h-3.5 w-3.5" />
									{responses.length} response{responses.length !== 1 ? 's' : ''}
								</span>
								<span className="flex items-center gap-1.5">
									<FileSpreadsheet className="h-3.5 w-3.5" />
									{fields.length} field{fields.length !== 1 ? 's' : ''}
								</span>
								{latestResponseTime && (
									<span className="flex items-center gap-1.5">
										<Clock className="h-3.5 w-3.5" />
										Last {latestResponseTime}
									</span>
								)}
							</div>
						</div>

						<div className="flex items-center gap-2 shrink-0">
							{responses.length > 0 && (
								<>
									<button
										onClick={exportPdf}
										className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition-smooth hover:bg-white/20 backdrop-blur-sm"
									>
										<FileText className="h-3.5 w-3.5" />
										PDF Report
									</button>
									<button
										onClick={exportCsv}
										className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition-smooth hover:bg-white/20 backdrop-blur-sm"
									>
										<Download className="h-3.5 w-3.5" />
										Export CSV
									</button>
								</>
							)}
							<button
								onClick={() => navigate(`fill/${formId}`)}
								className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-smooth hover:bg-emerald-50 shadow-sm"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								Open form
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Stats + view toggle bar */}
			{responses.length > 0 && (
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
					{/* Mini stats */}
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark px-4 py-2.5">
							<div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
								<TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
							</div>
							<div>
								<p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none">{responses.length}</p>
								<p className="text-[10px] text-gray-400 font-medium mt-0.5">Responses</p>
							</div>
						</div>
					</div>

					{/* View toggle */}
					<div className="flex items-center bg-gray-100 dark:bg-gray-800/80 rounded-xl p-1">
						{(['cards', 'table', 'analytics'] as const).map((v) => (
							<button
								key={v}
								onClick={() => setView(v)}
								className={`px-4 py-2 rounded-lg text-xs font-medium transition-smooth capitalize ${
									view === v
										? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
										: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
								}`}
							>
								{v}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Empty state */}
			{responses.length === 0 && (
				<div className="flex flex-col items-center justify-center py-20">
					<div className="relative mb-8">
						<div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/50 flex items-center justify-center shadow-lg shadow-gray-100/50 dark:shadow-none">
							<FileSpreadsheet className="h-10 w-10 text-gray-400" />
						</div>
						<div className="absolute -top-1 -right-1 w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-md">
							<BarChart3 className="h-3.5 w-3.5 text-white" />
						</div>
					</div>
					<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No responses yet</h2>
					<p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-sm mb-8 leading-relaxed">
						Share your form to start collecting responses. All data saves locally and syncs when connected.
					</p>
					<div className="flex items-center gap-3">
						<button
							onClick={() => navigate(`fill/${formId}`)}
							className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-smooth hover:bg-brand-500 active:scale-[0.98] shadow-sm shadow-brand-600/25"
						>
							Test form yourself
						</button>
						<button
							onClick={() => navigate(`build/${formId}`)}
							className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-smooth hover:bg-gray-50 dark:hover:bg-gray-700"
						>
							<Share2 className="h-3.5 w-3.5" />
							Share form
						</button>
					</div>
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

			{/* Analytics view */}
			{responses.length > 0 && view === 'analytics' && (
				<AnalyticsView fields={fields} responses={responses} />
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------
// Time-range type and helpers
// ---------------------------------------------------------------------------

type TimeRange = '7d' | '14d' | '30d' | '90d' | 'all'

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
	{ value: '7d', label: '7d' },
	{ value: '14d', label: '14d' },
	{ value: '30d', label: '30d' },
	{ value: '90d', label: '90d' },
	{ value: 'all', label: 'All' },
]

function daysForRange(range: TimeRange): number | null {
	if (range === '7d') return 7
	if (range === '14d') return 14
	if (range === '30d') return 30
	if (range === '90d') return 90
	return null
}

/** Return the start-of-day timestamp for `daysAgo` days before today. */
function startOfDaysAgo(daysAgo: number): number {
	const d = new Date()
	d.setHours(0, 0, 0, 0)
	d.setDate(d.getDate() - daysAgo + 1)
	return d.getTime()
}

/** Format a Date to a short label like "Jan 5". */
function shortDate(d: Date): string {
	return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Format a Date as YYYY-MM-DD (locale-independent key). */
function dateKey(d: Date): string {
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}

function median(nums: number[]): number {
	if (nums.length === 0) return 0
	const sorted = [...nums].sort((a, b) => a - b)
	const mid = Math.floor(sorted.length / 2)
	if (sorted.length % 2 === 0) {
		return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
	}
	return sorted[mid] ?? 0
}

// ---------------------------------------------------------------------------
// SVG Tooltip component
// ---------------------------------------------------------------------------

interface TooltipState {
	x: number
	y: number
	content: string
}

function ChartTooltip({ tooltip }: { tooltip: TooltipState | null }) {
	if (!tooltip) return null
	return (
		<div
			className="pointer-events-none absolute z-50 rounded-lg bg-gray-900 dark:bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-white dark:text-gray-900 shadow-lg whitespace-nowrap transition-opacity duration-150"
			style={{
				left: tooltip.x,
				top: tooltip.y,
				transform: 'translate(-50%, -100%) translateY(-8px)',
			}}
		>
			{tooltip.content}
			<div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
		</div>
	)
}

// ---------------------------------------------------------------------------
// Sparkline (tiny SVG line for summary cards)
// ---------------------------------------------------------------------------

function Sparkline({ data, className }: { data: number[]; className?: string }) {
	if (data.length < 2) return null
	const w = 64
	const h = 20
	const max = Math.max(...data, 1)
	const min = Math.min(...data, 0)
	const range = max - min || 1
	const points = data.map((v, i) => {
		const x = (i / (data.length - 1)) * w
		const y = h - ((v - min) / range) * (h - 2) - 1
		return `${x},${y}`
	})
	return (
		<svg width={w} height={h} className={className} viewBox={`0 0 ${w} ${h}`}>
			<polyline
				points={points.join(' ')}
				fill="none"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="stroke-brand-500"
			/>
		</svg>
	)
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

function SummaryCard({
	label,
	value,
	trend,
	sparkData,
}: {
	label: string
	value: string
	trend: number | null
	sparkData: number[]
}) {
	const trendPositive = trend !== null && trend > 0
	const trendNegative = trend !== null && trend < 0
	const trendZero = trend !== null && trend === 0

	return (
		<div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-4 flex flex-col gap-2">
			<span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
				{label}
			</span>
			<div className="flex items-end justify-between gap-2">
				<div className="flex items-baseline gap-2 min-w-0">
					<span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums truncate">
						{value}
					</span>
					{trend !== null && (
						<span
							className={`text-xs font-semibold tabular-nums flex items-center gap-0.5 ${
								trendPositive
									? 'text-emerald-600 dark:text-emerald-400'
									: trendNegative
										? 'text-red-500 dark:text-red-400'
										: 'text-gray-400'
							}`}
						>
							{trendPositive && (
								<svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
									<path d="M5 1 L9 6 L1 6 Z" fill="currentColor" />
								</svg>
							)}
							{trendNegative && (
								<svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
									<path d="M5 9 L9 4 L1 4 Z" fill="currentColor" />
								</svg>
							)}
							{trendZero ? '0%' : `${trend > 0 ? '+' : ''}${trend}%`}
						</span>
					)}
				</div>
				<Sparkline data={sparkData} className="shrink-0 opacity-60" />
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Bar Chart (responses over time)
// ---------------------------------------------------------------------------

function ResponsesBarChart({
	data,
}: {
	data: { date: Date; count: number; label: string }[]
}) {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null)

	if (data.length === 0) return null

	const maxCount = Math.max(...data.map((d) => d.count), 1)
	// Y-axis: pick nice tick values
	const yTicks = useMemo(() => {
		if (maxCount <= 4) return Array.from({ length: maxCount + 1 }, (_, i) => i)
		const step = Math.ceil(maxCount / 4)
		const ticks: number[] = []
		for (let v = 0; v <= maxCount; v += step) ticks.push(v)
		if (ticks[ticks.length - 1] !== maxCount && maxCount - (ticks[ticks.length - 1] ?? 0) > step * 0.3) {
			ticks.push(maxCount)
		}
		return ticks
	}, [maxCount])

	const chartHeight = 200
	const chartPadLeft = 40
	const chartPadRight = 12
	const chartPadTop = 8
	const chartPadBottom = 28
	const innerH = chartHeight - chartPadTop - chartPadBottom
	const barGap = 2

	// X-axis: show up to ~8 labels, spaced evenly
	const xLabelStep = Math.max(1, Math.ceil(data.length / 8))

	return (
		<div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 relative">
			<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
				Responses Over Time
			</h3>
			<div className="relative" style={{ height: chartHeight }}>
				<ChartTooltip tooltip={tooltip} />
				<svg
					width="100%"
					height={chartHeight}
					viewBox={`0 0 100 ${chartHeight}`}
					preserveAspectRatio="none"
					className="overflow-visible"
					style={{ width: '100%' }}
				>
					{/* Gridlines */}
					{yTicks.map((tick) => {
						const y = chartPadTop + innerH - (tick / maxCount) * innerH
						return (
							<line
								key={tick}
								x1={chartPadLeft}
								x2={100 - chartPadRight}
								y1={y}
								y2={y}
								className="stroke-gray-100 dark:stroke-gray-800"
								strokeWidth="0.3"
								vectorEffect="non-scaling-stroke"
							/>
						)
					})}
				</svg>
				{/* Render using a div-based approach for proper responsiveness */}
				<div
					className="absolute inset-0 flex"
					style={{
						paddingLeft: chartPadLeft,
						paddingRight: chartPadRight,
						paddingTop: chartPadTop,
						paddingBottom: chartPadBottom,
					}}
				>
					{/* Y-axis labels */}
					<div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between" style={{ paddingTop: chartPadTop, paddingBottom: chartPadBottom, width: chartPadLeft }}>
						{[...yTicks].reverse().map((tick) => (
							<span key={tick} className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums text-right pr-2 leading-none">
								{tick}
							</span>
						))}
					</div>
					{/* Bars */}
					<div className="flex-1 flex items-end" style={{ gap: barGap }}>
						{data.map((d, i) => {
							const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0
							return (
								<div
									key={d.label}
									className="flex-1 flex flex-col items-center justify-end h-full relative group"
									onMouseEnter={(e) => {
										const rect = e.currentTarget.getBoundingClientRect()
										const parentRect = e.currentTarget.closest('.relative')?.getBoundingClientRect()
										if (parentRect) {
											setTooltip({
												x: rect.left + rect.width / 2 - parentRect.left,
												y: rect.top - parentRect.top + (innerH - (pct / 100) * innerH),
												content: `${shortDate(d.date)}: ${d.count} response${d.count !== 1 ? 's' : ''}`,
											})
										}
									}}
									onMouseLeave={() => setTooltip(null)}
								>
									<div
										className="w-full rounded-t-[3px] bg-brand-500/80 group-hover:bg-brand-500 transition-all duration-200 min-h-[2px]"
										style={{ height: `${Math.max(pct, d.count > 0 ? 2 : 0)}%` }}
									/>
									{/* X-axis label */}
									{i % xLabelStep === 0 && (
										<span className="absolute -bottom-5 text-[9px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
											{shortDate(d.date)}
										</span>
									)}
								</div>
							)
						})}
					</div>
				</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Calendar Heatmap (GitHub-style)
// ---------------------------------------------------------------------------

function CalendarHeatmap({
	responses,
}: {
	responses: Record<string, unknown>[]
}) {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null)

	const { weeks, maxCount, monthLabels } = useMemo(() => {
		// Build a map of date -> count
		const counts: Record<string, number> = {}
		for (const r of responses) {
			if (r.submittedAt) {
				const key = dateKey(new Date(Number(r.submittedAt)))
				counts[key] = (counts[key] ?? 0) + 1
			}
		}

		// Build 12 weeks of data ending today
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		const totalWeeks = 12
		const totalDays = totalWeeks * 7

		// Find the Sunday that starts our grid
		const endDay = new Date(today)
		const startDay = new Date(today)
		startDay.setDate(startDay.getDate() - totalDays + 1)
		// Align to start of week (Sunday)
		const startDow = startDay.getDay()
		startDay.setDate(startDay.getDate() - startDow)

		const weeksArr: { date: Date; key: string; count: number; dow: number }[][] = []
		let currentWeek: { date: Date; key: string; count: number; dow: number }[] = []

		const cursor = new Date(startDay)
		while (cursor <= endDay || currentWeek.length > 0) {
			const key = dateKey(cursor)
			const dow = cursor.getDay()
			currentWeek.push({
				date: new Date(cursor),
				key,
				count: counts[key] ?? 0,
				dow,
			})
			if (dow === 6 || cursor.getTime() === endDay.getTime()) {
				weeksArr.push(currentWeek)
				currentWeek = []
			}
			cursor.setDate(cursor.getDate() + 1)
			if (cursor > endDay && currentWeek.length === 0) break
		}

		const max = Math.max(...Object.values(counts), 1)

		// Month labels: find the first occurrence of each month in the data
		const months: { label: string; weekIndex: number }[] = []
		let lastMonth = -1
		for (let wi = 0; wi < weeksArr.length; wi++) {
			const firstDayOfWeek = weeksArr[wi]?.[0]
			if (firstDayOfWeek) {
				const m = firstDayOfWeek.date.getMonth()
				if (m !== lastMonth) {
					months.push({
						label: firstDayOfWeek.date.toLocaleDateString(undefined, { month: 'short' }),
						weekIndex: wi,
					})
					lastMonth = m
				}
			}
		}

		return { weeks: weeksArr, dayCounts: counts, maxCount: max, monthLabels: months }
	}, [responses])

	const cellSize = 13
	const cellGap = 2
	const dayLabelWidth = 28
	const topPad = 18

	const gridWidth = dayLabelWidth + weeks.length * (cellSize + cellGap) + cellSize
	const gridHeight = topPad + 7 * (cellSize + cellGap)

	function heatColor(count: number): string {
		if (count === 0) return 'fill-gray-100 dark:fill-gray-800'
		const ratio = count / maxCount
		if (ratio <= 0.15) return 'fill-brand-100 dark:fill-brand-900/50'
		if (ratio <= 0.3) return 'fill-brand-200 dark:fill-brand-800/60'
		if (ratio <= 0.5) return 'fill-brand-300 dark:fill-brand-700/70'
		if (ratio <= 0.75) return 'fill-brand-400 dark:fill-brand-600'
		return 'fill-brand-600 dark:fill-brand-500'
	}

	const dayLabels = [
		{ dow: 0, label: 'Sun' },
		{ dow: 1, label: 'Mon' },
		{ dow: 2, label: 'Tue' },
		{ dow: 3, label: 'Wed' },
		{ dow: 4, label: 'Thu' },
		{ dow: 5, label: 'Fri' },
		{ dow: 6, label: 'Sat' },
	]

	return (
		<div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 relative">
			<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
				Activity
			</h3>
			<div className="overflow-x-auto relative">
				<ChartTooltip tooltip={tooltip} />
				<svg width="100%" viewBox={`0 0 ${gridWidth} ${gridHeight}`} preserveAspectRatio="xMinYMid meet" className="overflow-visible">
					{/* Month labels */}
					{monthLabels.map((m) => (
						<text
							key={`${m.label}-${m.weekIndex}`}
							x={dayLabelWidth + m.weekIndex * (cellSize + cellGap)}
							y={10}
							className="fill-gray-400 dark:fill-gray-500 text-[9px]"
							fontSize="9"
						>
							{m.label}
						</text>
					))}
					{/* Day labels */}
					{dayLabels.map(({ dow, label }) => (
						<text
							key={dow}
							x={0}
							y={topPad + dow * (cellSize + cellGap) + cellSize - 2}
							className="fill-gray-400 dark:fill-gray-500 text-[9px]"
							fontSize="9"
						>
							{label}
						</text>
					))}
					{/* Cells */}
					{weeks.map((week, wi) =>
						week.map((day) => (
							<rect
								key={day.key}
								x={dayLabelWidth + wi * (cellSize + cellGap)}
								y={topPad + day.dow * (cellSize + cellGap)}
								width={cellSize}
								height={cellSize}
								rx={2}
								className={`${heatColor(day.count)} transition-colors duration-200 cursor-default`}
								onMouseEnter={(e) => {
									const rect = e.currentTarget.getBoundingClientRect()
									const parentRect = e.currentTarget.closest('.relative')?.getBoundingClientRect()
									if (parentRect) {
										setTooltip({
											x: rect.left + rect.width / 2 - parentRect.left,
											y: rect.top - parentRect.top,
											content: `${shortDate(day.date)}: ${day.count} response${day.count !== 1 ? 's' : ''}`,
										})
									}
								}}
								onMouseLeave={() => setTooltip(null)}
							/>
						)),
					)}
				</svg>
			</div>
			{/* Legend */}
			<div className="flex items-center gap-1.5 mt-3 text-[9px] text-gray-400 dark:text-gray-500">
				<span>Less</span>
				{[0, 0.15, 0.3, 0.5, 0.75, 1].map((ratio, i) => (
					<svg key={i} width={cellSize} height={cellSize}>
						<rect
							width={cellSize}
							height={cellSize}
							rx={2}
							className={heatColor(Math.round(ratio * maxCount))}
						/>
					</svg>
				))}
				<span>More</span>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Horizontal bar chart for categorical fields
// ---------------------------------------------------------------------------

function CategoricalBarChart({
	counts,
	total,
}: {
	counts: [string, number][]
	total: number
}) {
	const maxCount = counts[0]?.[1] ?? 1
	const brandShades = [
		'bg-brand-600 dark:bg-brand-500',
		'bg-brand-500 dark:bg-brand-400',
		'bg-brand-400 dark:bg-brand-400/80',
		'bg-brand-300 dark:bg-brand-300/70',
		'bg-brand-200 dark:bg-brand-300/50',
	]

	return (
		<div className="space-y-2.5">
			{counts.map(([label, count], i) => {
				const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0
				const pctOfTotal = total > 0 ? Math.round((count / total) * 100) : 0
				const shade = brandShades[Math.min(i, brandShades.length - 1)] ?? brandShades[brandShades.length - 1]
				return (
					<div key={label}>
						<div className="flex items-center justify-between mb-1">
							<span className="text-sm text-gray-700 dark:text-gray-300 truncate mr-2">
								{label}
							</span>
							<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
								{count} ({pctOfTotal}%)
							</span>
						</div>
						<div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
							<div
								className={`h-full rounded-full transition-all duration-500 ${shade}`}
								style={{ width: `${widthPct}%` }}
							/>
						</div>
					</div>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------
// Histogram (small 5-bin distribution chart for numeric fields)
// ---------------------------------------------------------------------------

function MiniHistogram({ values }: { values: number[] }) {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null)

	const bins = useMemo(() => {
		if (values.length === 0) return []
		const sorted = [...values].sort((a, b) => a - b)
		const min = sorted[0] ?? 0
		const max = sorted[sorted.length - 1] ?? 0
		const binCount = 5
		const range = max - min || 1
		const step = range / binCount

		const result: { from: number; to: number; count: number }[] = []
		for (let i = 0; i < binCount; i++) {
			const from = min + step * i
			const to = i === binCount - 1 ? max + 0.001 : min + step * (i + 1)
			const count = sorted.filter((v) => v >= from && v < to).length
			result.push({ from, to: i === binCount - 1 ? max : to, count })
		}
		return result
	}, [values])

	if (bins.length === 0) return null
	const maxBin = Math.max(...bins.map((b) => b.count), 1)

	return (
		<div className="relative mt-3">
			<ChartTooltip tooltip={tooltip} />
			<div className="flex items-end gap-1 h-16">
				{bins.map((bin, i) => {
					const pct = (bin.count / maxBin) * 100
					const fromLabel = Number.isInteger(bin.from) ? bin.from.toString() : bin.from.toFixed(1)
					const toLabel = Number.isInteger(bin.to) ? bin.to.toString() : bin.to.toFixed(1)
					return (
						<div
							key={i}
							className="flex-1 flex flex-col items-center justify-end h-full group relative"
							onMouseEnter={(e) => {
								const rect = e.currentTarget.getBoundingClientRect()
								const parentRect = e.currentTarget.closest('.relative')?.getBoundingClientRect()
								if (parentRect) {
									setTooltip({
										x: rect.left + rect.width / 2 - parentRect.left,
										y: rect.top - parentRect.top + (64 - (pct / 100) * 64),
										content: `${fromLabel} - ${toLabel}: ${bin.count}`,
									})
								}
							}}
							onMouseLeave={() => setTooltip(null)}
						>
							<div
								className="w-full rounded-t-sm bg-brand-400/70 group-hover:bg-brand-500 transition-all duration-200 min-h-[2px]"
								style={{ height: `${Math.max(pct, bin.count > 0 ? 4 : 0)}%` }}
							/>
						</div>
					)
				})}
			</div>
			<div className="flex justify-between mt-1">
				<span className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">
					{Number.isInteger(bins[0]?.from ?? 0) ? (bins[0]?.from ?? 0).toString() : (bins[0]?.from ?? 0).toFixed(1)}
				</span>
				<span className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">
					{Number.isInteger(bins[bins.length - 1]?.to ?? 0) ? (bins[bins.length - 1]?.to ?? 0).toString() : (bins[bins.length - 1]?.to ?? 0).toFixed(1)}
				</span>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Per-field breakdown cards
// ---------------------------------------------------------------------------

interface CategoricalAnalysis {
	field: FormField
	type: 'categorical'
	counts: [string, number][]
	total: number
	fillRate: number
}

interface NumericAnalysis {
	field: FormField
	type: 'numeric'
	sum: number
	avg: number
	min: number
	max: number
	median: number
	count: number
	fillRate: number
	values: number[]
}

interface TextAnalysis {
	field: FormField
	type: 'text'
	total: number
	fillRate: number
	uniqueCount: number
	topValues: [string, number][]
}

type FieldAnalysis = CategoricalAnalysis | NumericAnalysis | TextAnalysis

function FieldBreakdownCard({
	analysis,
	totalResponses,
}: {
	analysis: FieldAnalysis
	totalResponses: number
}) {
	return (
		<div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate mr-2">
					{analysis.field.label || analysis.field.id}
				</h3>
				<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
					{analysis.fillRate}% fill rate
				</span>
			</div>

			{analysis.type === 'categorical' && (
				<CategoricalBarChart counts={analysis.counts} total={totalResponses} />
			)}

			{analysis.type === 'numeric' && (
				<div>
					<div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
						{([
							['Sum', analysis.sum.toLocaleString()],
							['Average', analysis.avg.toFixed(1)],
							['Median', analysis.median.toFixed(1)],
							['Min', analysis.min.toLocaleString()],
							['Max', analysis.max.toLocaleString()],
						] as const).map(([label, value]) => (
							<div key={label}>
								<span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
									{label}
								</span>
								<p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
									{value}
								</p>
							</div>
						))}
					</div>
					<MiniHistogram values={analysis.values} />
				</div>
			)}

			{analysis.type === 'text' && (
				<div>
					<div className="flex gap-6 text-sm mb-3">
						<div>
							<span className="text-gray-400 dark:text-gray-500 text-xs">Responses</span>
							<p className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
								{analysis.total}
							</p>
						</div>
						<div>
							<span className="text-gray-400 dark:text-gray-500 text-xs">Unique</span>
							<p className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
								{analysis.uniqueCount}
							</p>
						</div>
					</div>
					{analysis.topValues.length > 0 && (
						<div>
							<span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
								Top values
							</span>
							<div className="mt-1.5 space-y-1">
								{analysis.topValues.map(([val, count]) => (
									<div key={val} className="flex items-center justify-between text-sm">
										<span className="text-gray-700 dark:text-gray-300 truncate mr-2">
											{val}
										</span>
										<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
											{count}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------
// UA parser — lightweight device/browser detection
// ---------------------------------------------------------------------------

function parseUA(ua: string): { browser: string; os: string; device: string } {
	let browser = 'Other'
	let os = 'Other'
	let device = 'Desktop'

	// Browser detection
	if (/Edg\//i.test(ua)) browser = 'Edge'
	else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera'
	else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome'
	else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'
	else if (/Firefox\//i.test(ua)) browser = 'Firefox'

	// OS detection
	if (/Windows/i.test(ua)) os = 'Windows'
	else if (/Mac OS|Macintosh/i.test(ua)) os = 'macOS'
	else if (/Android/i.test(ua)) os = 'Android'
	else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
	else if (/Linux/i.test(ua)) os = 'Linux'
	else if (/CrOS/i.test(ua)) os = 'ChromeOS'

	// Device
	if (/Mobile|Android.*Mobile|iPhone/i.test(ua)) device = 'Mobile'
	else if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) device = 'Tablet'

	return { browser, os, device }
}

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`
	const m = Math.floor(seconds / 60)
	const s = seconds % 60
	if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
	const h = Math.floor(m / 60)
	return `${h}h ${m % 60}m`
}

// ---------------------------------------------------------------------------
// Donut chart for device/browser breakdowns
// ---------------------------------------------------------------------------

function DonutChart({
	data,
	title,
}: {
	data: [string, number][]
	title: string
}) {
	const total = data.reduce((s, d) => s + d[1], 0)
	if (total === 0) return null

	const colors = [
		'stroke-brand-500', 'stroke-emerald-500', 'stroke-amber-500',
		'stroke-purple-500', 'stroke-rose-500', 'stroke-cyan-500',
	]
	const bgColors = [
		'bg-brand-500', 'bg-emerald-500', 'bg-amber-500',
		'bg-purple-500', 'bg-rose-500', 'bg-cyan-500',
	]

	const radius = 40
	const circumference = 2 * Math.PI * radius
	let offset = 0

	return (
		<div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5">
			<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
			<div className="flex items-center gap-6">
				<svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
					{data.map(([label, count], i) => {
						const pct = count / total
						const dashLen = pct * circumference
						const dashGap = circumference - dashLen
						const currentOffset = offset
						offset += dashLen
						return (
							<circle
								key={label}
								cx="50" cy="50" r={radius}
								fill="none"
								strokeWidth="12"
								className={colors[i % colors.length]}
								strokeDasharray={`${dashLen} ${dashGap}`}
								strokeDashoffset={-currentOffset}
								transform="rotate(-90 50 50)"
							/>
						)
					})}
					<text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-gray-900 dark:fill-gray-100 text-lg font-bold" fontSize="16">
						{total}
					</text>
				</svg>
				<div className="space-y-1.5 min-w-0">
					{data.map(([label, count], i) => (
						<div key={label} className="flex items-center gap-2 text-sm">
							<div className={`w-2.5 h-2.5 rounded-full shrink-0 ${bgColors[i % bgColors.length]}`} />
							<span className="text-gray-700 dark:text-gray-300 truncate">{label}</span>
							<span className="text-xs text-gray-400 tabular-nums ml-auto shrink-0">
								{count} ({Math.round((count / total) * 100)}%)
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Main AnalyticsView
// ---------------------------------------------------------------------------

function AnalyticsView({
	fields,
	responses,
}: {
	fields: FormField[]
	responses: Record<string, unknown>[]
}) {
	const [range, setRange] = useState<TimeRange>('30d')

	// Filter responses by time range
	const filtered = useMemo(() => {
		const days = daysForRange(range)
		if (days === null) return responses
		const cutoff = startOfDaysAgo(days)
		return responses.filter((r) => {
			// Include responses without a timestamp (legacy data)
			if (!r.submittedAt) return true
			return Number(r.submittedAt) >= cutoff
		})
	}, [responses, range])

	// Previous period responses (for trend calculation)
	const previousPeriod = useMemo(() => {
		const days = daysForRange(range)
		if (days === null) return []
		const cutoffCurrent = startOfDaysAgo(days)
		const cutoffPrev = startOfDaysAgo(days * 2)
		return responses.filter((r) => {
			if (!r.submittedAt) return false
			const ts = Number(r.submittedAt)
			return ts >= cutoffPrev && ts < cutoffCurrent
		})
	}, [responses, range])

	// Parse all data once
	const allData = useMemo(() => {
		return filtered.map((r) => {
			try {
				return JSON.parse(String(r.data || '{}')) as Record<string, string>
			} catch {
				return {} as Record<string, string>
			}
		})
	}, [filtered])

	const prevData = useMemo(() => {
		return previousPeriod.map((r) => {
			try {
				return JSON.parse(String(r.data || '{}')) as Record<string, string>
			} catch {
				return {} as Record<string, string>
			}
		})
	}, [previousPeriod])

	// Daily counts for sparklines + bar chart
	const dailyCounts = useMemo(() => {
		const counts: Record<string, number> = {}
		for (const r of filtered) {
			if (r.submittedAt) {
				const key = dateKey(new Date(Number(r.submittedAt)))
				counts[key] = (counts[key] ?? 0) + 1
			}
		}

		// Build a complete date range
		const days = daysForRange(range)
		const numDays = days ?? 90 // for "all", show last 90 days of bars
		const result: { date: Date; count: number; label: string }[] = []
		const today = new Date()
		today.setHours(0, 0, 0, 0)

		for (let i = numDays - 1; i >= 0; i--) {
			const d = new Date(today)
			d.setDate(d.getDate() - i)
			const key = dateKey(d)
			result.push({ date: d, count: counts[key] ?? 0, label: key })
		}
		return result
	}, [filtered, range])

	// Sparkline data (last 7 data points grouped)
	const sparkline7 = useMemo(() => {
		const last7 = dailyCounts.slice(-7)
		return last7.map((d) => d.count)
	}, [dailyCounts])

	// Summary stats
	const totalResponses = filtered.length
	const prevTotalResponses = previousPeriod.length

	const trendPct = (current: number, previous: number): number | null => {
		const days = daysForRange(range)
		if (days === null) return null // no trend for "all"
		if (previous === 0 && current === 0) return 0
		if (previous === 0) return 100
		return Math.round(((current - previous) / previous) * 100)
	}

	// Completion rate: responses with all required fields filled
	const completionRate = useMemo(() => {
		const requiredFields = fields.filter((f) => f.required)
		if (requiredFields.length === 0) return totalResponses > 0 ? 100 : 0
		let complete = 0
		for (const d of allData) {
			const allFilled = requiredFields.every((f) => {
				const v = d[f.id]
				return v !== undefined && v !== null && v !== ''
			})
			if (allFilled) complete++
		}
		return totalResponses > 0 ? Math.round((complete / totalResponses) * 100) : 0
	}, [allData, fields, totalResponses])

	const prevCompletionRate = useMemo(() => {
		const requiredFields = fields.filter((f) => f.required)
		if (requiredFields.length === 0) return previousPeriod.length > 0 ? 100 : 0
		let complete = 0
		for (const d of prevData) {
			const allFilled = requiredFields.every((f) => {
				const v = d[f.id]
				return v !== undefined && v !== null && v !== ''
			})
			if (allFilled) complete++
		}
		return previousPeriod.length > 0 ? Math.round((complete / previousPeriod.length) * 100) : 0
	}, [prevData, fields, previousPeriod.length])

	// Average fill rate across all fields
	const avgFillRate = useMemo(() => {
		if (fields.length === 0 || totalResponses === 0) return 0
		let totalFill = 0
		for (const field of fields) {
			const filled = allData.filter((d) => {
				const v = d[field.id]
				return v !== undefined && v !== null && v !== ''
			}).length
			totalFill += filled / totalResponses
		}
		return Math.round((totalFill / fields.length) * 100)
	}, [allData, fields, totalResponses])

	const prevAvgFillRate = useMemo(() => {
		if (fields.length === 0 || previousPeriod.length === 0) return 0
		let totalFill = 0
		for (const field of fields) {
			const filled = prevData.filter((d) => {
				const v = d[field.id]
				return v !== undefined && v !== null && v !== ''
			}).length
			totalFill += filled / previousPeriod.length
		}
		return Math.round((totalFill / fields.length) * 100)
	}, [prevData, fields, previousPeriod.length])

	// Active days
	const activeDays = useMemo(() => {
		const days = new Set<string>()
		for (const r of filtered) {
			if (r.submittedAt) {
				days.add(dateKey(new Date(Number(r.submittedAt))))
			}
		}
		return days.size
	}, [filtered])

	const prevActiveDays = useMemo(() => {
		const days = new Set<string>()
		for (const r of previousPeriod) {
			if (r.submittedAt) {
				days.add(dateKey(new Date(Number(r.submittedAt))))
			}
		}
		return days.size
	}, [previousPeriod])

	// Per-field analytics
	const fieldAnalytics = useMemo((): FieldAnalysis[] => {
		// Skip non-data fields
		const dataFields = fields.filter((f) => f.type !== 'section' && f.type !== 'statement')

		return dataFields.map((field): FieldAnalysis => {
			const values = allData.map((d) => d[field.id] ?? '').filter((v) => v !== '')
			const total = values.length
			const fillRate = totalResponses > 0 ? Math.round((total / totalResponses) * 100) : 0

			if (['select', 'radio', 'checkbox', 'yesno'].includes(field.type)) {
				const counts: Record<string, number> = {}
				for (const v of values) {
					const parts = field.type === 'checkbox' ? v.split(',') : [v]
					for (const p of parts) {
						const trimmed = p.trim()
						if (trimmed) counts[trimmed] = (counts[trimmed] ?? 0) + 1
					}
				}
				const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]) as [string, number][]
				return { field, type: 'categorical', counts: sorted, total, fillRate }
			}

			if (['number', 'rating', 'scale'].includes(field.type)) {
				const nums = values.map(Number).filter((n) => !isNaN(n))
				if (nums.length > 0) {
					const sum = nums.reduce((a, b) => a + b, 0)
					const avg = sum / nums.length
					const min = Math.min(...nums)
					const max = Math.max(...nums)
					const med = median(nums)
					return {
						field,
						type: 'numeric',
						sum,
						avg,
						min,
						max,
						median: med,
						count: nums.length,
						fillRate,
						values: nums,
					}
				}
			}

			// Text / other
			const uniqueSet = new Set(values)
			const valueCounts: Record<string, number> = {}
			for (const v of values) {
				valueCounts[v] = (valueCounts[v] ?? 0) + 1
			}
			const topValues = Object.entries(valueCounts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5) as [string, number][]

			return {
				field,
				type: 'text',
				total,
				fillRate,
				uniqueCount: uniqueSet.size,
				topValues,
			}
		})
	}, [allData, fields, totalResponses])

	// Sparkline for completion rate (daily completion %)
	const completionSparkline = useMemo(() => {
		const requiredFields = fields.filter((f) => f.required)
		const last7 = dailyCounts.slice(-7)
		if (requiredFields.length === 0) return last7.map((d) => (d.count > 0 ? 100 : 0))

		// Group responses by day
		const byDay: Record<string, Record<string, string>[]> = {}
		for (let i = 0; i < filtered.length; i++) {
			const r = filtered[i]
			if (r?.submittedAt) {
				const key = dateKey(new Date(Number(r.submittedAt)))
				if (!byDay[key]) byDay[key] = []
				const d = allData[i]
				if (d) byDay[key].push(d)
			}
		}

		return last7.map((d) => {
			const dayResponses = byDay[d.label] ?? []
			if (dayResponses.length === 0) return 0
			let complete = 0
			for (const data of dayResponses) {
				if (requiredFields.every((f) => {
					const v = data[f.id]
					return v !== undefined && v !== null && v !== ''
				})) complete++
			}
			return Math.round((complete / dayResponses.length) * 100)
		})
	}, [allData, dailyCounts, fields, filtered])

	const fillRateSparkline = useMemo(() => {
		const last7 = dailyCounts.slice(-7)
		const byDay: Record<string, Record<string, string>[]> = {}
		for (let i = 0; i < filtered.length; i++) {
			const r = filtered[i]
			if (r?.submittedAt) {
				const key = dateKey(new Date(Number(r.submittedAt)))
				if (!byDay[key]) byDay[key] = []
				const d = allData[i]
				if (d) byDay[key].push(d)
			}
		}

		return last7.map((d) => {
			const dayResponses = byDay[d.label] ?? []
			if (dayResponses.length === 0 || fields.length === 0) return 0
			let totalFill = 0
			for (const field of fields) {
				const filled = dayResponses.filter((data) => {
					const v = data[field.id]
					return v !== undefined && v !== null && v !== ''
				}).length
				totalFill += filled / dayResponses.length
			}
			return Math.round((totalFill / fields.length) * 100)
		})
	}, [allData, dailyCounts, fields, filtered])

	// Average completion time (from _meta embedded in response data)
	const avgCompletionTime = useMemo(() => {
		const durations: number[] = []
		for (const d of allData) {
			const meta = (d as Record<string, unknown>)._meta as { duration?: number } | undefined
			if (meta?.duration && meta.duration > 0 && meta.duration < 86400) {
				durations.push(meta.duration)
			}
		}
		if (durations.length === 0) return null
		return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
	}, [allData])

	// Device / browser / OS breakdown
	const deviceBreakdown = useMemo(() => {
		const browsers: Record<string, number> = {}
		const devices: Record<string, number> = {}
		const oses: Record<string, number> = {}
		for (const d of allData) {
			const meta = (d as Record<string, unknown>)._meta as { ua?: string } | undefined
			if (meta?.ua) {
				const parsed = parseUA(meta.ua)
				browsers[parsed.browser] = (browsers[parsed.browser] ?? 0) + 1
				devices[parsed.device] = (devices[parsed.device] ?? 0) + 1
				oses[parsed.os] = (oses[parsed.os] ?? 0) + 1
			}
		}
		const toSorted = (obj: Record<string, number>) =>
			Object.entries(obj).sort((a, b) => b[1] - a[1]) as [string, number][]
		const hasData = Object.keys(browsers).length > 0
		return { browsers: toSorted(browsers), devices: toSorted(devices), oses: toSorted(oses), hasData }
	}, [allData])

	return (
		<div className="space-y-5 animate-fade-in">
			{/* Time range selector */}
			<div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-1 w-fit">
				{TIME_RANGE_OPTIONS.map((opt) => (
					<button
						key={opt.value}
						onClick={() => setRange(opt.value)}
						className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
							range === opt.value
								? 'bg-brand-500 text-white shadow-sm'
								: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
						}`}
					>
						{opt.label}
					</button>
				))}
			</div>

			{/* Summary cards */}
			<div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
				<SummaryCard
					label="Total Responses"
					value={totalResponses.toLocaleString()}
					trend={trendPct(totalResponses, prevTotalResponses)}
					sparkData={sparkline7}
				/>
				<SummaryCard
					label="Completion Rate"
					value={`${completionRate}%`}
					trend={trendPct(completionRate, prevCompletionRate)}
					sparkData={completionSparkline}
				/>
				<SummaryCard
					label="Avg. Fill Rate"
					value={`${avgFillRate}%`}
					trend={trendPct(avgFillRate, prevAvgFillRate)}
					sparkData={fillRateSparkline}
				/>
				<SummaryCard
					label="Avg. Time"
					value={avgCompletionTime !== null ? formatDuration(avgCompletionTime) : '—'}
					trend={null}
					sparkData={[]}
				/>
				<SummaryCard
					label="Active Days"
					value={String(activeDays)}
					trend={trendPct(activeDays, prevActiveDays)}
					sparkData={sparkline7.map((v) => (v > 0 ? 1 : 0))}
				/>
			</div>

			{/* Responses over time bar chart */}
			<ResponsesBarChart data={dailyCounts} />

			{/* Calendar heatmap */}
			<CalendarHeatmap responses={filtered} />

			{/* Device & browser breakdown */}
			{deviceBreakdown.hasData && (
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
						Respondent Insights
					</h3>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<DonutChart data={deviceBreakdown.devices} title="Devices" />
						<DonutChart data={deviceBreakdown.browsers} title="Browsers" />
						<DonutChart data={deviceBreakdown.oses} title="Operating Systems" />
					</div>
				</div>
			)}

			{/* Per-field breakdown */}
			{fieldAnalytics.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
						Field Breakdown
					</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{fieldAnalytics.map((analysis) => (
							<FieldBreakdownCard
								key={analysis.field.id}
								analysis={analysis}
								totalResponses={totalResponses}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

function formatTimeSince(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000)
	if (seconds < 60) return 'just now'
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.floor(hours / 24)
	if (days < 7) return `${days}d ago`
	return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
