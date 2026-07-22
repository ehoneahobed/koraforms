import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { FormField } from '../../types'
import {
	buildFieldAnalyses,
	fieldHealthBarClass,
	fieldInsightTone,
	filledCountForAnalysis,
	type FieldAnalysis,
} from '../../features/responses/analytics'
import {
	buildResponsesAnalyticsSummary,
	calculateTrendPct,
	type ResponseFilter,
} from '../../features/responses/summary'
import {
	formatDuration,
	parseResponseData,
	responseFields,
	staticFieldLabel,
	type TimeRange,
} from '../../features/responses/utils'
import {
	CalendarHeatmap,
	DonutChart,
	DropoffFunnel,
	FieldBreakdownCard,
	NpsGauge,
	ResponsesBarChart,
	SummaryCard,
} from './ResponseCharts'

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
	{ value: '7d', label: '7d' },
	{ value: '14d', label: '14d' },
	{ value: '30d', label: '30d' },
	{ value: '90d', label: '90d' },
	{ value: 'all', label: 'All' },
]

// ============================================================================
// AnalyticsView (full analytics dashboard under the Analytics sub-tab)
// ============================================================================

export function AnalyticsView({ fields, responses }: { fields: FormField[]; responses: Record<string, unknown>[] }) {
	const [range, setRange] = useState<TimeRange>('30d')
	const [filters, setFilters] = useState<ResponseFilter[]>([])

	const summary = useMemo(() => {
		return buildResponsesAnalyticsSummary(fields, responses, range, filters)
	}, [fields, filters, range, responses])
	const filtered = summary.filteredResponses
	const dailyCounts = summary.dailyCounts
	const sparkline7 = summary.sparkline7
	const totalResponses = summary.totalResponses
	const prevTotalResponses = summary.previousTotalResponses
	const completionRate = summary.completionRate
	const prevCompletionRate = summary.previousCompletionRate
	const avgFillRate = summary.averageFillRate
	const prevAvgFillRate = summary.previousAverageFillRate
	const activeDays = summary.activeDays
	const prevActiveDays = summary.previousActiveDays
	const avgCompletionTime = summary.averageCompletionTime
	const npsData = summary.npsData
	const funnelData = summary.funnelData
	const deviceBreakdown = summary.deviceBreakdown
	const crossInsights = summary.crossInsights
	const completionSparkline = summary.completionSparkline
	const fillRateSparkline = summary.fillRateSparkline

	const trendPct = (current: number, previous: number): number | null => {
		return calculateTrendPct(current, previous, range)
	}

	return (
		<div className="space-y-5 animate-fade-in">
			{/* Time range selector */}
			<div className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-1 w-fit">
				{TIME_RANGE_OPTIONS.map(opt => (
					<button key={opt.value} onClick={() => setRange(opt.value)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${range === opt.value ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
						{opt.label}
					</button>
				))}
			</div>

			{/* Response filters */}
			<div className="flex flex-wrap items-center gap-2">
				{filters.map((f, i) => {
					const field = fields.find(fld => fld.id === f.fieldId)
					return (
						<span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 px-2.5 py-1.5 text-xs font-medium">
							{field?.label || f.fieldId}: {f.value}
							<button onClick={() => setFilters(filters.filter((_, j) => j !== i))} className="p-0.5 hover:text-red-500 transition-colors">&times;</button>
						</span>
					)
				})}
				<div className="relative">
					<select value="" onChange={e => { if (!e.target.value) return; const fieldId = e.target.value; const val = prompt(`Filter "${fields.find(f => f.id === fieldId)?.label || fieldId}" contains:`); if (val) setFilters([...filters, { fieldId, value: val }]); e.target.value = '' }} className="text-xs rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-transparent px-2.5 py-1.5 text-gray-500 dark:text-gray-400 outline-none cursor-pointer">
						<option value="">+ Filter</option>
						{responseFields(fields).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
					</select>
				</div>
				{filters.length > 0 && <button onClick={() => setFilters([])} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Clear all</button>}
			</div>

			{/* Summary cards */}
			<div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
				<SummaryCard label="Total Responses" value={totalResponses.toLocaleString()} trend={trendPct(totalResponses, prevTotalResponses)} sparkData={sparkline7} />
				<SummaryCard label="Completion Rate" value={`${completionRate}%`} trend={trendPct(completionRate, prevCompletionRate)} sparkData={completionSparkline} />
				<SummaryCard label="Avg. Fill Rate" value={`${avgFillRate}%`} trend={trendPct(avgFillRate, prevAvgFillRate)} sparkData={fillRateSparkline} />
				<SummaryCard label="Avg. Time" value={avgCompletionTime !== null ? formatDuration(avgCompletionTime) : '—'} trend={null} sparkData={[]} />
				<SummaryCard label="Active Days" value={String(activeDays)} trend={trendPct(activeDays, prevActiveDays)} sparkData={sparkline7.map(v => (v > 0 ? 1 : 0))} />
			</div>

			<ResponsesBarChart data={dailyCounts} />
			<CalendarHeatmap responses={filtered} />

			{(funnelData.length > 0 || npsData) && (
				<div className={`grid grid-cols-1 gap-4 ${npsData ? 'xl:grid-cols-[1.1fr_0.9fr]' : ''}`}>
					{funnelData.length > 0 && <DropoffFunnel data={funnelData} />}
					{npsData && (
					<NpsGauge nps={npsData.nps} promoters={npsData.promoters} passives={npsData.passives} detractors={npsData.detractors} total={npsData.total} fieldLabel={npsData.fieldLabel} />
					)}
				</div>
			)}

			{deviceBreakdown.hasData && (
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Respondent Insights</h3>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<DonutChart data={deviceBreakdown.devices} title="Devices" />
						<DonutChart data={deviceBreakdown.browsers} title="Browsers" />
						<DonutChart data={deviceBreakdown.oses} title="Operating Systems" />
					</div>
				</div>
			)}

			{crossInsights.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Cross-Question Insights</h3>
					<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark overflow-hidden divide-y divide-gray-100 dark:divide-gray-800 shadow-sm">
						{crossInsights.map((insight, i) => (
							<div key={i} className="px-4 py-3 flex items-start gap-3">
								<div className="shrink-0 w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-600 dark:text-violet-400 text-sm font-bold">{insight.percentage}%</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm text-gray-800 dark:text-gray-200">
										People who answered <span className="font-semibold text-brand-600 dark:text-brand-400">&ldquo;{insight.sourceValue}&rdquo;</span> for <span className="text-gray-500">{insight.sourceLabel}</span> also chose <span className="font-semibold text-violet-600 dark:text-violet-400">&ldquo;{insight.targetValue}&rdquo;</span> for <span className="text-gray-500">{insight.targetLabel}</span>
									</p>
									<p className="text-[11px] text-gray-400 mt-0.5">{insight.coCount} of {insight.sourceCount} respondents</p>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

// ============================================================================
// FieldInsightsView (per-field analysis under the "Field insights" sub-tab)
// ============================================================================

export function FieldInsightsView({ fields, responses }: { fields: FormField[]; responses: Record<string, unknown>[] }) {
	const [query, setQuery] = useState('')
	const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
	const allData = useMemo(() => {
		return responses.map(parseResponseData)
	}, [responses])

	const totalResponses = responses.length

	const fieldAnalytics = useMemo((): FieldAnalysis[] => {
		return buildFieldAnalyses(fields, allData, totalResponses)
	}, [allData, fields, totalResponses])

	useEffect(() => {
		if (fieldAnalytics.length === 0) {
			if (selectedFieldId !== null) setSelectedFieldId(null)
			return
		}
		if (!selectedFieldId || !fieldAnalytics.some(analysis => analysis.field.id === selectedFieldId)) {
			setSelectedFieldId(fieldAnalytics[0]!.field.id)
		}
	}, [fieldAnalytics, selectedFieldId])

	if (fieldAnalytics.length === 0) {
		return (
			<div className="text-center py-16">
				<p className="text-sm text-gray-400 dark:text-gray-500">No analyzable fields found.</p>
			</div>
		)
	}

	const sortedAnalytics = fieldAnalytics
		.map((analysis, index) => ({ analysis, index }))
		.sort((a, b) => a.analysis.fillRate - b.analysis.fillRate || a.index - b.index)
		.map(item => item.analysis)

	const filteredAnalytics = sortedAnalytics.filter(analysis => {
		const label = staticFieldLabel(analysis.field).toLowerCase()
		return label.includes(query.trim().toLowerCase())
	})

	const selectedAnalysis =
		fieldAnalytics.find(analysis => analysis.field.id === selectedFieldId) ||
		filteredAnalytics[0] ||
		sortedAnalytics[0]!
	const avgFillRate = Math.round(fieldAnalytics.reduce((sum, analysis) => sum + analysis.fillRate, 0) / fieldAnalytics.length)
	const reviewCount = fieldAnalytics.filter(analysis => analysis.fillRate < 75).length
	const watchCount = fieldAnalytics.filter(analysis => analysis.fillRate >= 75 && analysis.fillRate < 90).length
	const strongest = [...fieldAnalytics].sort((a, b) => b.fillRate - a.fillRate)[0]!
	const weakest = sortedAnalytics[0]!

	return (
		<div className="space-y-5 animate-fade-in">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h3 className="text-[18px] font-bold tracking-[-0.01em] text-slate-950 dark:text-gray-100">Field insights</h3>
					<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Understand every question without scanning every response manually.</p>
				</div>
				<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{fieldAnalytics.length} fields · {totalResponses} responses</span>
			</div>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<FieldInsightMetric label="Average fill" value={`${avgFillRate}%`} tone={avgFillRate >= 90 ? 'good' : avgFillRate >= 75 ? 'watch' : 'review'} detail="Across answer fields" />
				<FieldInsightMetric label="Needs review" value={String(reviewCount)} tone={reviewCount > 0 ? 'review' : 'good'} detail={watchCount > 0 ? `${watchCount} watch` : 'No weak fields'} />
				<FieldInsightMetric label="Strongest field" value={`${strongest.fillRate}%`} tone="good" detail={staticFieldLabel(strongest.field)} />
				<FieldInsightMetric label="Lowest field" value={`${weakest.fillRate}%`} tone={weakest.fillRate >= 90 ? 'good' : weakest.fillRate >= 75 ? 'watch' : 'review'} detail={staticFieldLabel(weakest.field)} />
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
				<aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
					<div className="relative mb-3">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
						<input
							value={query}
							onChange={event => setQuery(event.target.value)}
							placeholder="Search fields..."
							className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[13px] outline-none transition-all placeholder:text-slate-400 focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:focus:bg-surface-elevated-dark"
						/>
					</div>
					<div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
						{filteredAnalytics.length === 0 ? (
							<div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-[13px] text-slate-400 dark:border-gray-800">
								No matching fields.
							</div>
						) : filteredAnalytics.map((analysis, index) => (
							<FieldInsightRow
								key={analysis.field.id}
								analysis={analysis}
								index={index}
								selected={selectedAnalysis.field.id === analysis.field.id}
								onSelect={() => setSelectedFieldId(analysis.field.id)}
							/>
						))}
					</div>
				</aside>

				<section className="space-y-4">
					<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="min-w-0">
								<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Selected field</p>
								<h4 className="mt-1 text-[20px] font-bold tracking-[-0.01em] text-slate-950 dark:text-gray-100">{staticFieldLabel(selectedAnalysis.field)}</h4>
								<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">{filledCountForAnalysis(selectedAnalysis)} filled responses from {totalResponses} submissions.</p>
							</div>
							<div className="flex items-center gap-3">
								<FieldStatusBadge fillRate={selectedAnalysis.fillRate} />
								<span className="text-[24px] font-bold tabular-nums text-slate-950 dark:text-gray-100">{selectedAnalysis.fillRate}%</span>
							</div>
						</div>
						<div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800">
							<div className={`h-full rounded-full ${fieldHealthBarClass(selectedAnalysis.fillRate)}`} style={{ width: `${selectedAnalysis.fillRate}%` }} />
						</div>
					</div>

					<FieldBreakdownCard analysis={selectedAnalysis} totalResponses={totalResponses} />
				</section>
			</div>
		</div>
	)
}

function FieldStatusBadge({ fillRate }: { fillRate: number }) {
	const tone = fieldInsightTone(fillRate)
	const label = tone === 'good' ? 'Healthy' : tone === 'watch' ? 'Watch' : 'Review'
	const className = tone === 'good'
		? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
		: tone === 'watch'
			? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
			: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
	return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>{label}</span>
}

function FieldInsightMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'good' | 'watch' | 'review' }) {
	const toneClass = tone === 'good'
		? 'text-emerald-600 dark:text-emerald-400'
		: tone === 'watch'
			? 'text-amber-600 dark:text-amber-400'
			: 'text-brand-600 dark:text-brand-400'
	return (
		<div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
			<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">{label}</p>
			<p className={`mt-2 text-[24px] font-bold tracking-[-0.01em] tabular-nums ${toneClass}`}>{value}</p>
			<p className="mt-1 truncate text-[12px] text-slate-500 dark:text-gray-400">{detail}</p>
		</div>
	)
}

function FieldInsightRow({ analysis, index, selected, onSelect }: { analysis: FieldAnalysis; index: number; selected: boolean; onSelect: () => void }) {
	const label = staticFieldLabel(analysis.field)
	return (
		<button
			onClick={onSelect}
			className={`w-full rounded-xl border px-3.5 py-3 text-left transition-all ${
				selected
					? 'border-brand-200 bg-brand-50/70 shadow-sm dark:border-brand-800 dark:bg-brand-900/15'
					: 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white dark:border-gray-800 dark:bg-gray-900/45 dark:hover:bg-gray-900'
			}`}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex min-w-0 items-center gap-2">
						<span className="text-[11px] text-slate-400 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
						<span className="truncate text-[13px] font-semibold text-slate-800 dark:text-gray-200">{label}</span>
					</div>
					<p className="mt-1 text-[11px] text-slate-400 dark:text-gray-500">{filledCountForAnalysis(analysis)} filled · {analysis.type}</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<FieldStatusBadge fillRate={analysis.fillRate} />
					<span className="w-9 text-right text-[12px] font-semibold tabular-nums text-slate-500 dark:text-gray-400">{analysis.fillRate}%</span>
				</div>
			</div>
			<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white dark:bg-gray-800">
				<div className={`h-full rounded-full ${fieldHealthBarClass(analysis.fillRate)}`} style={{ width: `${analysis.fillRate}%` }} />
			</div>
		</button>
	)
}
