import { useState, useEffect } from 'react'
import { BarChart3, Users } from 'lucide-react'
import type { FormField } from '../types'
import { getThemeCSSVars } from '../themes'
import { setPageMeta } from '../utils/meta'
import { InlineLoader } from '../components/shared/BrandLoader'
import { PoweredByBadge } from '../components/shared/PoweredByBadge'
import { getResponseFields, parseFormFields, parseResponseData } from '../domain/forms'
import { isPublicResultsFieldVisible, publicResultsDisplaySettings, type PublicResultsDisplaySettings } from '../domain/publicResults'

interface Props {
	slug: string
	navigate: (path: string) => void
}

interface ResultsData {
	form: {
		id: string
		title: string
		description: string
		fields: string
		theme: string
		results?: PublicResultsDisplaySettings
	}
	responses: { data: string; submittedAt: number }[]
	pagination?: {
		limit: number
		returned: number
		hasMore: boolean
	}
}

export function PublicResults({ slug, navigate }: Props) {
	const [data, setData] = useState<ResultsData | null>(null)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		fetch(`/api/public/forms/${encodeURIComponent(slug)}/results?limit=500`)
			.then(res => {
				if (!res.ok) throw new Error(res.status === 403 ? 'Results are not public for this form.' : 'Form not found.')
				return res.json()
			})
			.then(setData)
			.catch(err => setError(err.message))
			.finally(() => setLoading(false))
	}, [slug])

	useEffect(() => {
		if (data) {
			setPageMeta({ title: `Results: ${data.form.title}`, description: `Public results for ${data.form.title}` })
		}
	}, [data])

	if (loading) return <InlineLoader message="Loading results..." />

	if (error || !data) {
		return (
			<div className="flex items-center justify-center min-h-screen px-4">
				<div className="text-center animate-fade-in">
					<p className="text-gray-500 text-lg mb-2">{error || 'Results not available.'}</p>
					<button onClick={() => navigate('dashboard')} className="text-brand-500 hover:underline text-sm">
						Go back
					</button>
				</div>
			</div>
		)
	}

	const fields: FormField[] = parseFormFields(data.form.fields)
	const displaySettings = data.form.results || publicResultsDisplaySettings({})
	const visibleFields = getResponseFields(fields).filter(field => isPublicResultsFieldVisible(field, displaySettings))
	const responses = data.responses
	const resultFields = visibleFields.map(field => {
		const values = responses.map(r => parseResponseData(r.data)[field.id] || '').filter(Boolean)
		return { field, values }
	}).filter(({ values }) => values.length > 0 || displaySettings.showEmptyFields)
	const hasMoreResults = data.pagination?.hasMore === true
	const themeVars = getThemeCSSVars(data.form.theme || 'blue')

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-surface-dark" style={themeVars as React.CSSProperties}>
			{/* Header */}
			<div className="bg-white dark:bg-surface-elevated-dark border-b border-gray-100 dark:border-gray-800">
				<div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
					<h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
						{data.form.title}
					</h1>
					{data.form.description && (
						<p className="text-sm text-gray-500 dark:text-gray-400">{data.form.description}</p>
					)}
					<div className="flex items-center gap-4 mt-4 text-sm text-gray-400 dark:text-gray-500">
						{displaySettings.showRespondentCount && (
							<span className="flex items-center gap-1.5">
								<Users className="h-4 w-4" />
								{responses.length} response{responses.length !== 1 ? 's' : ''}
								{hasMoreResults ? ' shown' : ''}
							</span>
						)}
						<span className="flex items-center gap-1.5">
							<BarChart3 className="h-4 w-4" />
							{displaySettings.mode === 'summary_text' ? 'Summaries and selected text' : 'Summary results'}
						</span>
					</div>
					{hasMoreResults && (
						<p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
							Public results are capped to {data.pagination?.limit || responses.length} responses for fast loading.
						</p>
					)}
				</div>
			</div>

			{/* Results */}
			<div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
				{resultFields.map(({ field, values }) => {
					return (
						<div key={field.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5">
							<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
								{field.label || field.id}
							</h3>
							<p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
								{values.length} response{values.length !== 1 ? 's' : ''}
							</p>

							{/* Choice-based fields → bar chart */}
							{['radio', 'select', 'checkbox', 'yesno'].includes(field.type) ? (
								<ChoiceBarChart values={values} field={field} />
							) : ['rating', 'scale', 'number'].includes(field.type) ? (
								<NumericSummary values={values} />
							) : (
								<TextResponses values={values} />
							)}
						</div>
					)
				})}
				{resultFields.length === 0 && (
					<div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-surface-elevated-dark">
						<BarChart3 className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-700" />
						<h2 className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">No public fields selected</h2>
						<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">The owner is sharing this results page without exposing individual answer fields.</p>
					</div>
				)}

				<div className="pt-4 flex justify-center">
					<PoweredByBadge slug={slug} variant="prominent" />
				</div>
			</div>
		</div>
	)
}

function ChoiceBarChart({ values, field }: { values: string[]; field: FormField }) {
	// Count occurrences (checkbox values are comma-separated)
	const counts: Record<string, number> = {}
	for (const v of values) {
		if (field.type === 'checkbox') {
			for (const opt of v.split(',')) {
				const trimmed = opt.trim()
				if (trimmed) counts[trimmed] = (counts[trimmed] || 0) + 1
			}
		} else {
			counts[v] = (counts[v] || 0) + 1
		}
	}

	const total = values.length
	const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
	const max = sorted[0]?.[1] || 1

	return (
		<div className="space-y-2">
			{sorted.map(([label, count]) => {
				const pct = total > 0 ? Math.round((count / total) * 100) : 0
				return (
					<div key={label}>
						<div className="flex items-center justify-between text-xs mb-1">
							<span className="text-gray-700 dark:text-gray-300 font-medium">{label}</span>
							<span className="text-gray-400 tabular-nums">{count} ({pct}%)</span>
						</div>
						<div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
							<div
								className="h-full rounded-full bg-brand-500 transition-all duration-500"
								style={{ width: `${(count / max) * 100}%` }}
							/>
						</div>
					</div>
				)
			})}
		</div>
	)
}

function NumericSummary({ values }: { values: string[] }) {
	const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n))
	if (nums.length === 0) return <p className="text-sm text-gray-400">No numeric responses</p>

	const avg = nums.reduce((a, b) => a + b, 0) / nums.length
	const min = Math.min(...nums)
	const max = Math.max(...nums)

	return (
		<div className="grid grid-cols-3 gap-4">
			{[
				{ label: 'Average', value: avg.toFixed(1) },
				{ label: 'Min', value: String(min) },
				{ label: 'Max', value: String(max) },
			].map(stat => (
				<div key={stat.label} className="text-center">
					<p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{stat.value}</p>
					<p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{stat.label}</p>
				</div>
			))}
		</div>
	)
}

function TextResponses({ values }: { values: string[] }) {
	const [showAll, setShowAll] = useState(false)
	const display = showAll ? values : values.slice(0, 5)

	return (
		<div className="space-y-2">
			{display.map((v, i) => (
				<div key={i} className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
					{v.length > 200 ? v.slice(0, 200) + '...' : v}
				</div>
			))}
			{values.length > 5 && !showAll && (
				<button
					onClick={() => setShowAll(true)}
					className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 font-medium"
				>
					Show all {values.length} responses
				</button>
			)}
		</div>
	)
}
