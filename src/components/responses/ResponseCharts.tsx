import { useMemo, useState } from 'react'
import type { FieldAnalysis } from '../../features/responses/analytics'
import {
	buildCategoricalBarData,
	buildHeatmapModel,
	buildHistogramBins,
	heatmapColorClass,
} from '../../features/responses/charts'
import {
	shortDate,
	staticFieldLabel,
} from '../../features/responses/utils'

// Chart Helper Components (used by AnalyticsView and FieldInsightsView)
// ============================================================================

interface TooltipState { x: number; y: number; content: string }

function ChartTooltip({ tooltip }: { tooltip: TooltipState | null }) {
	if (!tooltip) return null
	return (
		<div
			className="pointer-events-none absolute z-50 rounded-lg bg-gray-900 dark:bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-white dark:text-gray-900 shadow-lg whitespace-nowrap transition-opacity duration-150"
			style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%) translateY(-8px)' }}
		>
			{tooltip.content}
			<div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
		</div>
	)
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
	if (data.length < 2) return null
	const w = 64; const h = 20
	const max = Math.max(...data, 1); const min = Math.min(...data, 0)
	const range = max - min || 1
	const points = data.map((v, i) => {
		const x = (i / (data.length - 1)) * w
		const y = h - ((v - min) / range) * (h - 2) - 1
		return `${x},${y}`
	})
	return (
		<svg width={w} height={h} className={className} viewBox={`0 0 ${w} ${h}`}>
			<polyline points={points.join(' ')} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-brand-500" />
		</svg>
	)
}

export function SummaryCard({ label, value, trend, sparkData }: { label: string; value: string; trend: number | null; sparkData: number[] }) {
	const trendPositive = trend !== null && trend > 0
	const trendNegative = trend !== null && trend < 0
	const trendZero = trend !== null && trend === 0
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-4 shadow-sm flex flex-col gap-2">
			<span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</span>
			<div className="flex items-end justify-between gap-2">
				<div className="flex items-baseline gap-2 min-w-0">
					<span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums truncate">{value}</span>
					{trend !== null && (
						<span className={`text-xs font-semibold tabular-nums flex items-center gap-0.5 ${
							trendPositive ? 'text-emerald-600 dark:text-emerald-400' : trendNegative ? 'text-red-500 dark:text-red-400' : 'text-gray-400'
						}`}>
							{trendPositive && <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0"><path d="M5 1 L9 6 L1 6 Z" fill="currentColor" /></svg>}
							{trendNegative && <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0"><path d="M5 9 L9 4 L1 4 Z" fill="currentColor" /></svg>}
							{trendZero ? '0%' : `${trend > 0 ? '+' : ''}${trend}%`}
						</span>
					)}
				</div>
				<Sparkline data={sparkData} className="shrink-0 opacity-60" />
			</div>
		</div>
	)
}

// ============================================================================
// Bar Chart (responses over time)
// ============================================================================

export function ResponsesBarChart({ data }: { data: { date: Date; count: number; label: string }[] }) {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null)
	if (data.length === 0) return null
	const maxCount = Math.max(...data.map(d => d.count), 1)
	const yTicks = useMemo(() => {
		if (maxCount <= 4) return Array.from({ length: maxCount + 1 }, (_, i) => i)
		const step = Math.ceil(maxCount / 4)
		const ticks: number[] = []
		for (let v = 0; v <= maxCount; v += step) ticks.push(v)
		if (ticks[ticks.length - 1] !== maxCount && maxCount - (ticks[ticks.length - 1] ?? 0) > step * 0.3) ticks.push(maxCount)
		return ticks
	}, [maxCount])
	const chartHeight = 200; const chartPadLeft = 40; const chartPadRight = 12; const chartPadTop = 8; const chartPadBottom = 28
	const innerH = chartHeight - chartPadTop - chartPadBottom; const barGap = 2
	const xLabelStep = Math.max(1, Math.ceil(data.length / 8))
	const chartRef = 'responses-over-time-chart'

	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 relative shadow-sm">
			<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Responses Over Time</h3>
			<div className="relative" data-chart={chartRef} style={{ height: chartHeight }}>
				<ChartTooltip tooltip={tooltip} />
				<svg width="100%" height={chartHeight} viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none" className="overflow-visible" style={{ width: '100%' }}>
					{yTicks.map(tick => {
						const y = chartPadTop + innerH - (tick / maxCount) * innerH
						return <line key={tick} x1={chartPadLeft} x2={100 - chartPadRight} y1={y} y2={y} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
					})}
				</svg>
				<div className="absolute inset-0 flex" style={{ paddingLeft: chartPadLeft, paddingRight: chartPadRight, paddingTop: chartPadTop, paddingBottom: chartPadBottom }}>
					<div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between" style={{ paddingTop: chartPadTop, paddingBottom: chartPadBottom, width: chartPadLeft }}>
						{[...yTicks].reverse().map(tick => (
							<span key={tick} className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums text-right pr-2 leading-none">{tick}</span>
						))}
					</div>
					<div className="flex-1 flex items-end" style={{ gap: barGap }}>
						{data.map((d, i) => {
							const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0
							return (
								<div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full relative group"
									onMouseMove={e => {
										const rect = e.currentTarget.getBoundingClientRect()
										const parentRect = e.currentTarget.closest(`[data-chart="${chartRef}"]`)?.getBoundingClientRect()
										if (parentRect) {
											setTooltip({
												x: rect.left + rect.width / 2 - parentRect.left,
												y: chartPadTop + innerH - (pct / 100) * innerH,
												content: `${shortDate(d.date)}: ${d.count} response${d.count !== 1 ? 's' : ''}`,
											})
										}
									}}
									onMouseLeave={() => setTooltip(null)}
								>
									<div className="w-full rounded-t-[3px] bg-brand-500/80 group-hover:bg-brand-500 transition-all duration-200 min-h-[2px]" style={{ height: `${Math.max(pct, d.count > 0 ? 2 : 0)}%` }} />
									{i % xLabelStep === 0 && <span className="absolute -bottom-5 text-[9px] text-gray-400 dark:text-gray-500 whitespace-nowrap">{shortDate(d.date)}</span>}
								</div>
							)
						})}
					</div>
				</div>
			</div>
		</div>
	)
}

// ============================================================================
// Calendar Heatmap
// ============================================================================

export function CalendarHeatmap({ responses }: { responses: Record<string, unknown>[] }) {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null)
	const { weeks, maxCount, monthLabels } = useMemo(() => buildHeatmapModel(responses), [responses])

	const cellSize = 11; const cellGap = 3; const dayLabelWidth = 30; const topPad = 20
	const gridWidth = dayLabelWidth + weeks.length * (cellSize + cellGap) + cellSize
	const gridHeight = topPad + 7 * (cellSize + cellGap)

	const dayLabels = [{ dow: 0, label: 'Sun' }, { dow: 1, label: 'Mon' }, { dow: 2, label: 'Tue' }, { dow: 3, label: 'Wed' }, { dow: 4, label: 'Thu' }, { dow: 5, label: 'Fri' }, { dow: 6, label: 'Sat' }]

	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 relative shadow-sm">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Activity</h3>
					<p className="text-[11px] text-gray-400 dark:text-gray-500">Last year</p>
				</div>
				<span className="text-[11px] text-gray-400 dark:text-gray-500">{responses.length} total</span>
			</div>
			<div className="relative overflow-x-auto rounded-xl border border-slate-100 px-4 py-3 dark:border-gray-800">
				<ChartTooltip tooltip={tooltip} />
				<svg viewBox={`0 0 ${gridWidth} ${gridHeight}`} className="block w-full min-w-[760px] overflow-visible">
					{monthLabels.map(m => <text key={`${m.label}-${m.weekIndex}`} x={dayLabelWidth + m.weekIndex * (cellSize + cellGap)} y={10} className="fill-gray-400 dark:fill-gray-500 text-[9px]" fontSize="9">{m.label}</text>)}
					{dayLabels.filter(({ dow }) => dow % 2 === 1).map(({ dow, label }) => <text key={dow} x={0} y={topPad + dow * (cellSize + cellGap) + cellSize - 1} className="fill-gray-400 dark:fill-gray-500 text-[9px]" fontSize="9">{label}</text>)}
					{weeks.map((week, wi) => week.map(day => (
						<rect key={day.key} x={dayLabelWidth + wi * (cellSize + cellGap)} y={topPad + day.dow * (cellSize + cellGap)} width={cellSize} height={cellSize} rx={2.5} className={`${heatmapColorClass(day.count, maxCount)} transition-colors duration-200 cursor-default`}
							onMouseMove={e => { const rect = e.currentTarget.getBoundingClientRect(); const parentRect = e.currentTarget.closest('.relative')?.getBoundingClientRect(); if (parentRect) setTooltip({ x: rect.left + rect.width / 2 - parentRect.left, y: rect.top - parentRect.top, content: `${shortDate(day.date)}: ${day.count} response${day.count !== 1 ? 's' : ''}` }) }}
							onMouseLeave={() => setTooltip(null)}
						/>
					)))}
				</svg>
			</div>
			<div className="flex items-center gap-1.5 mt-3 text-[9px] text-gray-400 dark:text-gray-500">
				<span>Less</span>
				{[0, 0.15, 0.3, 0.5, 0.75, 1].map((ratio, i) => <svg key={i} width={cellSize} height={cellSize}><rect width={cellSize} height={cellSize} rx={2} className={heatmapColorClass(Math.round(ratio * maxCount), maxCount)} /></svg>)}
				<span>More</span>
			</div>
		</div>
	)
}

// ============================================================================
// Categorical Bar Chart & Histogram
// ============================================================================

function CategoricalBarChart({ counts, total }: { counts: [string, number][]; total: number }) {
	const data = useMemo(() => buildCategoricalBarData(counts, total), [counts, total])
	const brandShades = ['bg-brand-600 dark:bg-brand-500', 'bg-brand-500 dark:bg-brand-400', 'bg-brand-400 dark:bg-brand-400/80', 'bg-brand-300 dark:bg-brand-300/70', 'bg-brand-200 dark:bg-brand-300/50']
	return (
		<div className="space-y-2.5">
			{data.map(({ label, count, widthPct, pctOfTotal }, i) => {
				const shade = brandShades[Math.min(i, brandShades.length - 1)] ?? brandShades[brandShades.length - 1]
				return (
					<div key={label}>
						<div className="flex items-center justify-between mb-1">
							<span className="text-sm text-gray-700 dark:text-gray-300 truncate mr-2">{label}</span>
							<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">{count} ({pctOfTotal}%)</span>
						</div>
						<div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
							<div className={`h-full rounded-full transition-all duration-500 ${shade}`} style={{ width: `${widthPct}%` }} />
						</div>
					</div>
				)
			})}
		</div>
	)
}

function MiniHistogram({ values }: { values: number[] }) {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null)
	const bins = useMemo(() => buildHistogramBins(values), [values])
	if (bins.length === 0) return null
	const maxBin = Math.max(...bins.map(b => b.count), 1)
	return (
		<div className="relative mt-3">
			<ChartTooltip tooltip={tooltip} />
			<div className="flex items-end gap-1 h-16">
				{bins.map((bin, i) => {
					const pct = (bin.count / maxBin) * 100
					const fromLabel = Number.isInteger(bin.from) ? bin.from.toString() : bin.from.toFixed(1)
					const toLabel = Number.isInteger(bin.to) ? bin.to.toString() : bin.to.toFixed(1)
					return (
						<div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative"
							onMouseEnter={e => { const rect = e.currentTarget.getBoundingClientRect(); const parentRect = e.currentTarget.closest('.relative')?.getBoundingClientRect(); if (parentRect) setTooltip({ x: rect.left + rect.width / 2 - parentRect.left, y: rect.top - parentRect.top + (64 - (pct / 100) * 64), content: `${fromLabel} - ${toLabel}: ${bin.count}` }) }}
							onMouseLeave={() => setTooltip(null)}
						>
							<div className="w-full rounded-t-sm bg-brand-400/70 group-hover:bg-brand-500 transition-all duration-200 min-h-[2px]" style={{ height: `${Math.max(pct, bin.count > 0 ? 4 : 0)}%` }} />
						</div>
					)
				})}
			</div>
			<div className="flex justify-between mt-1">
				<span className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">{Number.isInteger(bins[0]?.from ?? 0) ? (bins[0]?.from ?? 0).toString() : (bins[0]?.from ?? 0).toFixed(1)}</span>
				<span className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">{Number.isInteger(bins[bins.length - 1]?.to ?? 0) ? (bins[bins.length - 1]?.to ?? 0).toString() : (bins[bins.length - 1]?.to ?? 0).toFixed(1)}</span>
			</div>
		</div>
	)
}

// ============================================================================
// Field Breakdown Card (per-field analysis)
// ============================================================================

export function FieldBreakdownCard({ analysis, totalResponses }: { analysis: FieldAnalysis; totalResponses: number }) {
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 shadow-sm">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate mr-2">{staticFieldLabel(analysis.field)}</h3>
				<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">{analysis.fillRate}% fill rate</span>
			</div>
			{analysis.type === 'categorical' && <CategoricalBarChart counts={analysis.counts} total={totalResponses} />}
			{analysis.type === 'numeric' && (
				<div>
					<div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
						{([['Sum', analysis.sum.toLocaleString()], ['Average', analysis.avg.toFixed(1)], ['Median', analysis.median.toFixed(1)], ['Min', analysis.min.toLocaleString()], ['Max', analysis.max.toLocaleString()]] as const).map(([label, value]) => (
							<div key={label}>
								<span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">{label}</span>
								<p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
							</div>
						))}
					</div>
					<MiniHistogram values={analysis.values} />
				</div>
			)}
			{analysis.type === 'text' && (
				<div>
					<div className="flex gap-6 text-sm mb-3">
						<div><span className="text-gray-400 dark:text-gray-500 text-xs">Responses</span><p className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{analysis.total}</p></div>
						<div><span className="text-gray-400 dark:text-gray-500 text-xs">Unique</span><p className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{analysis.uniqueCount}</p></div>
					</div>
					{analysis.topValues.length > 0 && (
						<div>
							<span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">Top values</span>
							<div className="mt-1.5 space-y-1">
								{analysis.topValues.map(([val, count]) => (
									<div key={val} className="flex items-center justify-between text-sm">
										<span className="text-gray-700 dark:text-gray-300 truncate mr-2">{val}</span>
										<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">{count}</span>
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

// ============================================================================
// Donut Chart
// ============================================================================

export function DonutChart({ data, title }: { data: [string, number][]; title: string }) {
	const total = data.reduce((s, d) => s + d[1], 0)
	if (total === 0) return null
	const colors = ['stroke-brand-500', 'stroke-emerald-500', 'stroke-amber-500', 'stroke-purple-500', 'stroke-rose-500', 'stroke-cyan-500']
	const bgColors = ['bg-brand-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500']
	const radius = 40; const circumference = 2 * Math.PI * radius; let offset = 0
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 shadow-sm">
			<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
			<div className="flex items-center gap-6">
				<svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
					{data.map(([label, count], i) => {
						const pct = count / total; const dashLen = pct * circumference; const dashGap = circumference - dashLen; const currentOffset = offset; offset += dashLen
						return <circle key={label} cx="50" cy="50" r={radius} fill="none" strokeWidth="12" className={colors[i % colors.length]} strokeDasharray={`${dashLen} ${dashGap}`} strokeDashoffset={-currentOffset} transform="rotate(-90 50 50)" />
					})}
					<text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-gray-900 dark:fill-gray-100 text-lg font-bold" fontSize="16">{total}</text>
				</svg>
				<div className="space-y-1.5 min-w-0">
					{data.map(([label, count], i) => (
						<div key={label} className="flex items-center gap-2 text-sm">
							<div className={`w-2.5 h-2.5 rounded-full shrink-0 ${bgColors[i % bgColors.length]}`} />
							<span className="text-gray-700 dark:text-gray-300 truncate">{label}</span>
							<span className="text-xs text-gray-400 tabular-nums ml-auto shrink-0">{count} ({Math.round((count / total) * 100)}%)</span>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

// ============================================================================
// NPS Gauge
// ============================================================================

export function NpsGauge({ nps, promoters, passives, detractors, total, fieldLabel }: { nps: number; promoters: number; passives: number; detractors: number; total: number; fieldLabel: string }) {
	const pPct = Math.round((promoters / total) * 100); const paPct = Math.round((passives / total) * 100); const dPct = Math.round((detractors / total) * 100)
	let scoreColor = 'text-red-500'; let scoreBg = 'bg-red-50 dark:bg-red-900/20'
	if (nps >= 50) { scoreColor = 'text-emerald-600 dark:text-emerald-400'; scoreBg = 'bg-emerald-50 dark:bg-emerald-900/20' }
	else if (nps >= 0) { scoreColor = 'text-amber-600 dark:text-amber-400'; scoreBg = 'bg-amber-50 dark:bg-amber-900/20' }
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 shadow-sm">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">NPS Score</h3>
				<span className="text-[10px] text-gray-400 truncate ml-2">{fieldLabel}</span>
			</div>
			<div className="flex items-center gap-5">
				<div className={`w-20 h-20 rounded-2xl ${scoreBg} flex items-center justify-center shrink-0`}>
					<span className={`text-3xl font-bold ${scoreColor} tabular-nums`}>{nps}</span>
				</div>
				<div className="flex-1 space-y-2">
					<div className="flex items-center gap-2 text-xs"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /><span className="text-gray-600 dark:text-gray-400">Promoters (9-10)</span><span className="ml-auto tabular-nums text-gray-500">{promoters} ({pPct}%)</span></div>
					<div className="flex items-center gap-2 text-xs"><div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" /><span className="text-gray-600 dark:text-gray-400">Passives (7-8)</span><span className="ml-auto tabular-nums text-gray-500">{passives} ({paPct}%)</span></div>
					<div className="flex items-center gap-2 text-xs"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" /><span className="text-gray-600 dark:text-gray-400">Detractors (0-6)</span><span className="ml-auto tabular-nums text-gray-500">{detractors} ({dPct}%)</span></div>
				</div>
			</div>
			<div className="flex h-2.5 rounded-full overflow-hidden mt-4">
				{dPct > 0 && <div className="bg-red-500" style={{ width: `${dPct}%` }} />}
				{paPct > 0 && <div className="bg-amber-400" style={{ width: `${paPct}%` }} />}
				{pPct > 0 && <div className="bg-emerald-500" style={{ width: `${pPct}%` }} />}
			</div>
			<p className="text-[10px] text-gray-400 mt-2">{total} responses</p>
		</div>
	)
}

// ============================================================================
// Drop-off Funnel
// ============================================================================

export function DropoffFunnel({ data }: { data: { label: string; filled: number; pct: number }[] }) {
	if (data.length === 0) return null
	const weakest = [...data].sort((a, b) => a.pct - b.pct)[0]
	const reviewCount = data.filter(d => d.pct < 75).length
	const watchCount = data.filter(d => d.pct >= 75 && d.pct < 90).length
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 shadow-sm">
			<div className="mb-4 flex items-start justify-between gap-4">
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Field completion</h3>
					<p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Spot where respondents slow down or skip questions.</p>
				</div>
				{weakest && reviewCount === 0 && watchCount === 0 && (
					<span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
						All healthy
					</span>
				)}
				{(reviewCount > 0 || watchCount > 0) && (
					<span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${reviewCount > 0 ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}>
						{reviewCount > 0 ? `${reviewCount} review` : `${watchCount} watch`}
					</span>
				)}
			</div>
			<div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60 dark:border-gray-800 dark:bg-gray-900/35">
				{data.map((d, i) => {
					const isDropoff = i > 0 && d.pct < (data[i - 1]?.pct ?? 100) - 10
					const status = d.pct >= 90 ? 'Healthy' : d.pct >= 75 ? 'Watch' : 'Review'
					const statusClass = d.pct >= 90
						? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
						: d.pct >= 75
							? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
							: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
					const barClass = d.pct >= 90
						? 'bg-emerald-400 dark:bg-emerald-500'
						: d.pct >= 75
							? 'bg-amber-400 dark:bg-amber-500'
							: 'bg-brand-500 dark:bg-brand-400'
					return (
						<div key={`${d.label}-${i}`} className="border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-gray-800">
							<div className="grid grid-cols-[1fr_auto] gap-3">
								<div className="min-w-0 pr-2">
									<div className="flex min-w-0 items-center gap-2">
										<span className="w-5 text-[11px] text-gray-400 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
										<span className={`truncate text-[13px] font-semibold ${isDropoff ? 'text-brand-700 dark:text-brand-300' : 'text-gray-800 dark:text-gray-200'}`}>{d.label}</span>
									</div>
									<p className="mt-0.5 pl-7 text-[11px] text-gray-400 dark:text-gray-500">{d.filled} filled · {Math.max(0, data[0]!.filled - d.filled)} fewer than first field</p>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{status}</span>
									<span className="w-9 text-right text-[12px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">{d.pct}%</span>
								</div>
							</div>
							<div className="mt-2 ml-7 h-1.5 overflow-hidden rounded-full bg-white dark:bg-gray-800">
								<div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${d.pct}%` }} />
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

// ============================================================================
