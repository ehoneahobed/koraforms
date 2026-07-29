import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { FormField } from '../../types'
import {
	buildFieldAnalyses,
	buildSmartFieldSuggestions,
	fieldHealthBarClass,
	fieldInsightTone,
	filledCountForAnalysis,
	type FieldAnalysis,
} from '../../features/responses/analytics'
import {
	buildResponsesAnalyticsSummary,
	calculateTrendPct,
	type SavedAnalyticsFilterView,
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

export function AnalyticsView({
	fields,
	responses,
	analyticsEvents = [],
	savedViews = [],
	onSaveView,
	onDeleteView,
}: {
	fields: FormField[]
	responses: Record<string, unknown>[]
	analyticsEvents?: Record<string, unknown>[]
	savedViews?: SavedAnalyticsFilterView[]
	onSaveView?: (view: { name: string; timeRange: TimeRange; filters: ResponseFilter[] }) => Promise<void> | void
	onDeleteView?: (id: string) => Promise<void> | void
}) {
	const [range, setRange] = useState<TimeRange>('30d')
	const [filters, setFilters] = useState<ResponseFilter[]>([])
	const [filterFieldId, setFilterFieldId] = useState('')
	const [filterValue, setFilterValue] = useState('')
	const [showSaveView, setShowSaveView] = useState(false)
	const [saveViewName, setSaveViewName] = useState('')
	const [savedViewBusyId, setSavedViewBusyId] = useState<string | null>(null)
	const [isSavingView, setIsSavingView] = useState(false)
	const filterableFields = useMemo(() => responseFields(fields), [fields])
	const selectedFilterField = filterableFields.find(field => field.id === filterFieldId) ?? filterableFields[0]

	const summary = useMemo(() => {
		return buildResponsesAnalyticsSummary(fields, responses, range, filters, analyticsEvents)
	}, [analyticsEvents, fields, filters, range, responses])
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
	const lifecycle = summary.lifecycle
	const fieldJourney = summary.fieldJourney
	const formVersions = summary.formVersions

	const trendPct = (current: number, previous: number): number | null => {
		return calculateTrendPct(current, previous, range)
	}

	const addFilter = () => {
		const value = filterValue.trim()
		if (!selectedFilterField || !value) return
		setFilters(current => [...current, { fieldId: selectedFilterField.id, value }])
		setFilterValue('')
		setFilterFieldId(selectedFilterField.id)
	}

	const saveCurrentView = async () => {
		const name = saveViewName.trim()
		if (!name || !onSaveView) return
		setIsSavingView(true)
		try {
			await onSaveView({ name, timeRange: range, filters })
			setSaveViewName('')
			setShowSaveView(false)
		} finally {
			setIsSavingView(false)
		}
	}

	const applySavedView = (view: SavedAnalyticsFilterView) => {
		setRange(view.timeRange)
		setFilters(view.filters)
		setFilterValue('')
		setFilterFieldId(view.filters[0]?.fieldId ?? selectedFilterField?.id ?? '')
	}

	const deleteSavedView = async (view: SavedAnalyticsFilterView) => {
		if (!onDeleteView) return
		setSavedViewBusyId(view.id)
		try {
			await onDeleteView(view.id)
		} finally {
			setSavedViewBusyId(null)
		}
	}

	return (
		<div className="space-y-5 animate-fade-in">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				{/* Time range selector */}
				<div className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-1 w-fit">
					{TIME_RANGE_OPTIONS.map(opt => (
						<button key={opt.value} onClick={() => setRange(opt.value)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${range === opt.value ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
							{opt.label}
						</button>
					))}
				</div>

				{onSaveView && (
					<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
						{showSaveView ? (
							<form
								onSubmit={event => {
									event.preventDefault()
									void saveCurrentView()
								}}
								className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-gray-800 dark:bg-surface-elevated-dark"
							>
								<input
									value={saveViewName}
									onChange={event => setSaveViewName(event.target.value)}
									placeholder="View name"
									className="h-8 w-40 rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-slate-700 outline-none placeholder:text-slate-400 dark:text-gray-200"
									aria-label="Saved analytics view name"
									maxLength={64}
								/>
								<button
									type="submit"
									disabled={!saveViewName.trim() || isSavingView}
									className="h-8 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950"
								>
									Save
								</button>
								<button
									type="button"
									onClick={() => {
										setShowSaveView(false)
										setSaveViewName('')
									}}
									className="h-8 rounded-lg px-2 text-xs font-semibold text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
								>
									Cancel
								</button>
							</form>
						) : (
							<button
								onClick={() => setShowSaveView(true)}
								className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-gray-800 dark:bg-surface-elevated-dark dark:text-gray-300 dark:hover:bg-gray-800"
							>
								Save view
							</button>
						)}
					</div>
				)}
			</div>

			{savedViews.length > 0 && (
				<section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
					<div className="mb-2 flex items-center justify-between gap-3">
						<div>
							<h3 className="text-[13px] font-semibold text-slate-800 dark:text-gray-200">Saved views</h3>
							<p className="text-[11px] text-slate-400 dark:text-gray-500">Reuse common response segments across devices.</p>
						</div>
					</div>
					<div className="flex gap-2 overflow-x-auto pb-1">
						{savedViews.map(view => (
							<div key={view.id} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-gray-800 dark:bg-gray-900/60">
								<button
									onClick={() => applySavedView(view)}
									className="rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-white dark:text-gray-300 dark:hover:bg-gray-950"
								>
									{view.name}
									<span className="ml-1 font-medium text-slate-400 dark:text-gray-500">
										{view.timeRange}{view.filters.length > 0 ? ` · ${view.filters.length}` : ''}
									</span>
								</button>
								{onDeleteView && (
									<button
										onClick={() => void deleteSavedView(view)}
										disabled={savedViewBusyId === view.id}
										className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-red-500 disabled:opacity-40 dark:hover:bg-gray-950"
										aria-label={`Delete saved view ${view.name}`}
									>
										&times;
									</button>
								)}
							</div>
						))}
					</div>
				</section>
			)}

			{/* Response filters */}
			<div className="flex flex-wrap items-center gap-2">
				{filters.map((f, i) => {
					const field = fields.find(fld => fld.id === f.fieldId)
					return (
						<span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 px-2.5 py-1.5 text-xs font-medium">
							{field ? staticFieldLabel(field) : f.fieldId}: {f.value}
							<button
								onClick={() => setFilters(filters.filter((_, j) => j !== i))}
								className="p-0.5 hover:text-red-500 transition-colors"
								aria-label={`Remove ${field ? staticFieldLabel(field) : f.fieldId} filter`}
							>
								&times;
							</button>
						</span>
					)
				})}
				<form
					onSubmit={event => {
						event.preventDefault()
						addFilter()
					}}
					className="inline-flex min-w-0 flex-wrap items-center gap-1 rounded-xl border border-dashed border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-surface-elevated-dark"
				>
					<select
						value={selectedFilterField?.id ?? ''}
						onChange={event => setFilterFieldId(event.target.value)}
						disabled={filterableFields.length === 0}
						className="h-8 rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-gray-500 outline-none disabled:opacity-50 dark:text-gray-400"
						aria-label="Filter field"
					>
						{filterableFields.length === 0 ? (
							<option value="">No fields</option>
						) : filterableFields.map(field => (
							<option key={field.id} value={field.id}>{staticFieldLabel(field)}</option>
						))}
					</select>
					<div className="relative">
						<Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
						<input
							value={filterValue}
							onChange={event => setFilterValue(event.target.value)}
							placeholder="Contains..."
							className="h-8 w-36 rounded-lg border-0 bg-slate-50 pl-7 pr-2 text-xs text-gray-700 outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-500/10 dark:bg-gray-900 dark:text-gray-200 dark:focus:bg-gray-900"
							aria-label="Filter value"
						/>
					</div>
					<button
						type="submit"
						disabled={!selectedFilterField || filterValue.trim().length === 0}
						className="h-8 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-gray-100"
					>
						Add
					</button>
				</form>
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

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
				<LifecycleCard label="Views" value={lifecycle.totalViews} helper={`${lifecycle.uniqueViewers} unique`} />
				<LifecycleCard label="Started" value={lifecycle.started} helper={`${lifecycle.viewToStartRate}% of views`} />
				<LifecycleCard label="Completed" value={lifecycle.completed} helper={`${lifecycle.startToCompleteRate}% of starts`} tone="good" />
				<LifecycleCard label="Partial" value={lifecycle.partial} helper="Started but not submitted" tone={lifecycle.partial > 0 ? 'watch' : 'muted'} />
				<LifecycleCard label="Abandoned" value={lifecycle.abandoned} helper={lifecycle.dropOffAnsweredCount === null ? 'No stale partials' : `Usually after ${lifecycle.dropOffAnsweredCount} answer${lifecycle.dropOffAnsweredCount === 1 ? '' : 's'}`} tone={lifecycle.abandoned > 0 ? 'review' : 'muted'} />
				<LifecycleCard label="Unique complete" value={`${lifecycle.uniqueCompletionRate}%`} helper="Completed / unique viewers" tone={lifecycle.uniqueCompletionRate >= 70 ? 'good' : lifecycle.uniqueCompletionRate >= 40 ? 'watch' : 'review'} />
			</div>

			{fieldJourney.length > 0 && <FieldJourneyPanel steps={fieldJourney} />}

			{formVersions.length > 0 && <FormVersionPanel versions={formVersions} />}

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

function FormVersionPanel({ versions }: { versions: ReturnType<typeof buildResponsesAnalyticsSummary>['formVersions'] }) {
	const current = versions.find(version => version.isCurrent) ?? versions[0]
	const olderVersions = versions.filter(version => version.versionHash !== current?.versionHash)
	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
			<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h3 className="text-[16px] font-semibold tracking-[-0.01em] text-slate-950 dark:text-gray-100">Version performance</h3>
					<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">
						Compare published revisions without mixing old form behavior into the current experience.
					</p>
				</div>
				{current && (
					<span className="rounded-full bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-600 dark:bg-gray-900 dark:text-gray-300">
						{versions.length} version{versions.length === 1 ? '' : 's'}
					</span>
				)}
			</div>
			<div className="mt-5 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
				{current && (
					<div className="rounded-2xl bg-slate-950 p-4 text-white dark:bg-white dark:text-slate-950">
						<div className="flex items-center justify-between gap-3">
							<p className="text-[12px] font-semibold uppercase tracking-wide text-white/55 dark:text-slate-500">Current version</p>
							<span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold dark:bg-slate-100">Active</span>
						</div>
						<p className="mt-3 text-[18px] font-semibold">{current.label}</p>
						<div className="mt-4 grid grid-cols-3 gap-2">
							<VersionMetric value={current.responses} label="Responses" inverted />
							<VersionMetric value={`${current.conversionRate}%`} label="Conversion" inverted />
							<VersionMetric value={current.partialSessions} label="Partials" inverted />
						</div>
					</div>
				)}
				<div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-gray-800">
					{olderVersions.length === 0 ? (
						<div className="px-4 py-6 text-[13px] text-slate-500 dark:text-gray-400">
							No older published versions in this range.
						</div>
					) : olderVersions.slice(0, 5).map(version => (
						<div key={version.versionHash} className="grid grid-cols-[minmax(0,1fr)_72px_88px_72px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-gray-800">
							<div className="min-w-0">
								<p className="truncate text-[13px] font-semibold text-slate-800 dark:text-gray-200">{version.label}</p>
								<p className="mt-0.5 text-[11px] text-slate-400 dark:text-gray-500">{formatVersionDate(version.lastSeenAt)}</p>
							</div>
							<p className="text-right text-[13px] font-semibold tabular-nums text-slate-700 dark:text-gray-300">{version.responses}</p>
							<p className="text-right text-[13px] font-semibold tabular-nums text-slate-700 dark:text-gray-300">{version.conversionRate}%</p>
							<p className="text-right text-[13px] font-semibold tabular-nums text-slate-500 dark:text-gray-400">{version.partialSessions}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

function VersionMetric({ value, label, inverted = false }: { value: number | string; label: string; inverted?: boolean }) {
	return (
		<div className={inverted ? 'rounded-xl bg-white/10 px-3 py-2 dark:bg-slate-100' : 'rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-900'}>
			<p className="text-[18px] font-bold tabular-nums">{value}</p>
			<p className={inverted ? 'mt-0.5 text-[11px] font-medium text-white/55 dark:text-slate-500' : 'mt-0.5 text-[11px] font-medium text-slate-500 dark:text-gray-500'}>{label}</p>
		</div>
	)
}

function formatVersionDate(timestamp: number): string {
	if (!timestamp) return 'No timestamp'
	return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function FieldJourneyPanel({ steps }: { steps: ReturnType<typeof buildResponsesAnalyticsSummary>['fieldJourney'] }) {
	const friction = steps.find(step => step.impact === 'high') ?? steps.find(step => step.impact === 'medium') ?? null
	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
			<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h3 className="text-[16px] font-semibold tracking-[-0.01em] text-slate-950 dark:text-gray-100">Respondent journey</h3>
					<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">
						See where people reach, answer, skip, or abandon the form.
					</p>
				</div>
				{friction && (
					<span className="rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
						Review {friction.label}
					</span>
				)}
			</div>
			<div className="mt-5 space-y-3">
				{steps.slice(0, 10).map(step => (
					<div key={step.field.id} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/45 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
						<div className="min-w-0">
							<div className="flex min-w-0 items-center gap-2">
								<span className="text-[11px] text-slate-400 tabular-nums">{String(step.index + 1).padStart(2, '0')}</span>
								<p className="truncate text-[13px] font-semibold text-slate-800 dark:text-gray-200">{step.label}</p>
								<span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-400 dark:bg-gray-800 dark:text-gray-500">{step.fieldType}</span>
							</div>
							<p className="mt-1 text-[11px] text-slate-400 dark:text-gray-500">
								{step.reached} reached · {step.answered} answered · {step.skipped} skipped · {step.abandoned} abandoned here
							</p>
						</div>
						<div>
							<div className="flex items-center justify-between text-[11px] font-medium text-slate-400 dark:text-gray-500">
								<span>{step.answerRate}% answer rate</span>
								<span className={step.impact === 'high' ? 'text-red-500' : step.impact === 'medium' ? 'text-amber-600' : 'text-emerald-600'}>{step.abandonRate}% abandon</span>
							</div>
							<div className="mt-2 h-2 overflow-hidden rounded-full bg-white dark:bg-gray-800">
								<div
									className={step.impact === 'high' ? 'h-full rounded-full bg-red-400' : step.impact === 'medium' ? 'h-full rounded-full bg-amber-400' : 'h-full rounded-full bg-emerald-400'}
									style={{ width: `${Math.max(4, step.answerRate)}%` }}
								/>
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	)
}

function LifecycleCard({
	label,
	value,
	helper,
	tone = 'muted',
}: {
	label: string
	value: number | string
	helper: string
	tone?: 'good' | 'watch' | 'review' | 'muted'
}) {
	const toneClass = tone === 'good'
		? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
		: tone === 'watch'
			? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
			: tone === 'review'
				? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
				: 'bg-slate-50 text-slate-700 dark:bg-gray-900 dark:text-gray-300'
	return (
		<div className={`rounded-2xl border border-slate-100 p-4 shadow-sm dark:border-gray-800 ${toneClass}`}>
			<p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
			<p className="mt-2 text-[24px] font-bold tabular-nums tracking-[-0.01em]">{typeof value === 'number' ? value.toLocaleString() : value}</p>
			<p className="mt-1 truncate text-[11px] font-medium opacity-70">{helper}</p>
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
	const suggestions = buildSmartFieldSuggestions(fieldAnalytics, totalResponses)

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

			{suggestions.length > 0 && (
				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
					<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<h4 className="text-[16px] font-semibold tracking-[-0.01em] text-slate-950 dark:text-gray-100">Suggestions</h4>
							<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Practical improvements based on response behavior.</p>
						</div>
						<span className="rounded-full bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-600 dark:bg-gray-900 dark:text-gray-300">
							{suggestions.length} found
						</span>
					</div>
					<div className="mt-4 grid gap-3 lg:grid-cols-3">
						{suggestions.slice(0, 3).map(suggestion => (
							<div key={suggestion.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/45">
								<div className="flex items-start justify-between gap-3">
									<p className="text-[13px] font-semibold text-slate-800 dark:text-gray-200">{suggestion.title}</p>
									<span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
										suggestion.severity === 'high'
											? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300'
											: suggestion.severity === 'medium'
												? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
												: 'bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400'
									}`}>
										{suggestion.severity}
									</span>
								</div>
								<p className="mt-2 text-[12px] leading-relaxed text-slate-500 dark:text-gray-400">{suggestion.reason}</p>
								<p className="mt-3 text-[12px] font-medium leading-relaxed text-slate-700 dark:text-gray-300">{suggestion.action}</p>
							</div>
						))}
					</div>
				</section>
			)}

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
