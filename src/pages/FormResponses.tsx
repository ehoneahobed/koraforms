import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@korajs/react'
import { app } from '../kora'
import { setPageMeta } from '../utils/meta'
import { downloadJsonFile, downloadTextFile } from '../utils/download'
import {
	Download, ChevronRight, ChevronLeft,
	BarChart3, Share2, Search, Trash2,
	ArrowUpDown, Copy,
	Inbox, CheckCircle2, AlertTriangle, Calendar,
	Lightbulb, ListChecks
} from 'lucide-react'
import type { FormField } from '../types'
import { ExportModal } from '../components/responses/ExportModal'
import { ResponseSlideOut } from '../components/responses/ResponseSlideOut'
import { ShareModal } from '../components/shared/ShareModal'
import { parseFormFields } from '../domain/forms'
import {
	dateKey,
	fieldLabel,
	formatDuration,
	formatResponseValue,
	formatTimeSince,
	parseResponseData,
	responseCompletionPct,
	responseFields,
	shortDate,
	staticFieldLabel,
	type TimeRange,
} from '../features/responses/utils'
import {
	buildResponsesCsvExport,
	buildResponsesJsonExport,
	deleteResponsesMessage,
	responseIdsForDeletion,
} from '../features/responses/actions'
import {
	buildFieldAnalyses,
	fieldHealthBarClass,
	fieldInsightTone,
	filledCountForAnalysis,
	type FieldAnalysis,
} from '../features/responses/analytics'
import {
	buildResponsesAnalyticsSummary,
	calculateTrendPct,
	formatResponseDateRange,
	paginateResponses,
	type ResponseFilter,
	searchAndSortResponses,
} from '../features/responses/summary'
import {
	buildCompletionStats,
	buildFollowUpReview,
	buildResponseOverview,
	type ResponseOverviewSummary,
} from '../features/responses/inbox'
import {
	reconcileSelectedResponseIds,
	responsesSubTabFromSearch,
	toggleSelectedResponseId,
	toggleVisibleResponseSelection,
	updateResponsesSubTabUrl,
	type ResponsesSubTab,
} from '../features/responses/navigation'
import {
	buildCategoricalBarData,
	buildHeatmapModel,
	buildHistogramBins,
	heatmapColorClass,
} from '../features/responses/charts'

// ============================================================================
// Types & Constants
// ============================================================================

interface Props {
	formId: string
	navigate: (path: string) => void
}

type SubTab = ResponsesSubTab
type ExportFormat = 'csv' | 'json'

const SUB_TABS: { key: SubTab; label: string; icon: typeof Inbox }[] = [
	{ key: 'all', label: 'Inbox', icon: Inbox },
	{ key: 'analytics', label: 'Analytics', icon: BarChart3 },
	{ key: 'insights', label: 'Field insights', icon: Lightbulb },
	{ key: 'todo', label: 'To do', icon: ListChecks },
]

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
	{ value: '7d', label: '7d' },
	{ value: '14d', label: '14d' },
	{ value: '30d', label: '30d' },
	{ value: '90d', label: '90d' },
	{ value: 'all', label: 'All' },
]

const ITEMS_PER_PAGE = 25

function getResponsesSubTabFromUrl(): SubTab {
	if (typeof window === 'undefined') return 'all'
	return responsesSubTabFromSearch(window.location.search)
}

function setResponsesSubTabInUrl(tab: SubTab) {
	if (typeof window === 'undefined') return
	window.history.replaceState(null, '', updateResponsesSubTabUrl(window.location.href, tab))
}

// ============================================================================
// Main FormResponses Component
// ============================================================================

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

	// --- State ---
	const [subTab, setSubTab] = useState<SubTab>(() => getResponsesSubTabFromUrl())
	const [expandedId, setExpandedId] = useState<string | null>(null)
	const [selectedResponse, setSelectedResponse] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [sortCol, setSortCol] = useState<string>('_date')
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
	const [showShareModal, setShowShareModal] = useState(false)
	const [showExportModal, setShowExportModal] = useState(false)
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [currentPage, setCurrentPage] = useState(1)

	const switchSubTab = (tab: SubTab) => {
		setSubTab(tab)
		setResponsesSubTabInUrl(tab)
	}

	useEffect(() => {
		const handlePopState = () => setSubTab(getResponsesSubTabFromUrl())
		window.addEventListener('popstate', handlePopState)
		return () => window.removeEventListener('popstate', handlePopState)
	}, [])

	// --- Derived data ---
	const fields: FormField[] = parseFormFields(form?.fields)

	const filteredResponses = useMemo(() => {
		return searchAndSortResponses(responses, search, { column: sortCol, direction: sortDir })
	}, [responses, search, sortCol, sortDir])

	// Reset page when search changes
	useEffect(() => { setCurrentPage(1) }, [search])

	// Pagination
	const pagination = useMemo(
		() => paginateResponses(filteredResponses, currentPage, ITEMS_PER_PAGE),
		[filteredResponses, currentPage],
	)
	const totalPages = pagination.totalPages
	const paginatedResponses = pagination.items
	const paginationStart = pagination.start
	const paginationEnd = pagination.end

	// --- Stat computations ---
	const completionStats = useMemo(() => {
		return buildCompletionStats(fields, responses)
	}, [responses, fields])

	const responseOverview = useMemo(() => {
		return buildResponseOverview(fields, responses)
	}, [responses, fields])

	useEffect(() => {
		setSelectedIds(prev => {
			return reconcileSelectedResponseIds(prev, filteredResponses.map(response => String(response.id)))
		})
	}, [filteredResponses])

	// --- Actions ---
	const toggleSort = (col: string) => {
		if (sortCol === col) {
			setSortDir(d => d === 'asc' ? 'desc' : 'asc')
		} else {
			setSortCol(col)
			setSortDir('asc')
		}
	}

	const toggleSelect = (id: string) => {
		setSelectedIds(prev => toggleSelectedResponseId(prev, id))
	}

	const selectAll = () => {
		setSelectedIds(prev => toggleVisibleResponseSelection(prev, paginatedResponses.map(response => String(response.id))))
	}

	const deleteSelected = () => {
		if (selectedIds.size === 0) return
		if (!window.confirm(deleteResponsesMessage(selectedIds.size))) return
		for (const id of responseIdsForDeletion(selectedIds)) {
			app.responses.delete(id)
		}
		setSelectedIds(new Set())
	}

	const exportCsv = (selectedFieldIds?: string[], sourceResponses: Record<string, unknown>[] = responses, includeMetadata = true) => {
		const exported = buildResponsesCsvExport({
			fields,
			responses: sourceResponses,
			formTitle: String(form?.title || 'form'),
			selectedFieldIds,
			includeMetadata,
		})
		if (!exported) return
		downloadTextFile(exported.content, exported.filename, exported.type)
	}

	const exportJson = (selectedFieldIds?: string[], sourceResponses: Record<string, unknown>[] = responses, includeMetadata = true) => {
		const exported = buildResponsesJsonExport({
			fields,
			responses: sourceResponses,
			formTitle: String(form?.title || 'form'),
			selectedFieldIds,
			includeMetadata,
		})
		if (!exported) return
		downloadJsonFile(exported.data, exported.filename)
	}

	// --- Date range display ---
	const dateRangeLabel = useMemo(() => {
		return formatResponseDateRange(responses)
	}, [responses])

	// --- Not found ---
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

	// --- Key fields for table (first 3 respondent-answer fields) ---
	const tableFields = responseFields(fields).slice(0, 3)

	// ========================================================================
	// RENDER
	// ========================================================================
	return (
		<div className="animate-fade-in rounded-b-2xl border border-t-0 border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark sm:p-6">
			{/* ---------------------------------------------------------------- */}
			{/* Sub-tabs                                                         */}
			{/* ---------------------------------------------------------------- */}
			<div className="border-b border-slate-100 dark:border-gray-800 mb-5 -mx-5 sm:-mx-6 px-5 sm:px-6">
				<div className="flex items-center justify-between gap-4">
					<div>
						<h2 className="text-[24px] font-bold text-slate-950 dark:text-gray-100 tracking-[-0.01em]">Responses</h2>
						<p className="text-[14px] text-slate-500 dark:text-gray-400 mt-1.5">Review, organise and understand every submission.</p>
					</div>
					<button
						onClick={() => setShowExportModal(true)}
						disabled={responses.length === 0}
						className="hidden sm:inline-flex items-center gap-2 kf-control px-5 py-3 text-[14px] font-semibold disabled:opacity-45 disabled:cursor-not-allowed"
					>
						<Download className="h-4 w-4" />
						Export
					</button>
				</div>
				<nav className="flex gap-2 mt-5 overflow-x-auto pb-1" aria-label="Response tabs">
					{SUB_TABS.map(tab => {
						const Icon = tab.icon
						return (
							<button
								key={tab.key}
								onClick={() => switchSubTab(tab.key)}
							className={`relative inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition-colors duration-200 ${
								subTab === tab.key
									? 'bg-brand-50 text-brand-700 dark:bg-brand-900/25 dark:text-brand-300'
										: 'text-gray-400 dark:text-gray-500 hover:bg-slate-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300'
								}`}
							>
								<Icon className="h-4 w-4" />
								{tab.label}
								{tab.key === 'all' && responses.length > 0 && <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-800">{responses.length}</span>}
							</button>
						)
					})}
				</nav>
			</div>

			{/* ---------------------------------------------------------------- */}
			{/* ALL TAB                                                          */}
			{/* ---------------------------------------------------------------- */}
			{subTab === 'all' && (
				<>
					{responses.length === 0 ? (
						<EmptyState formId={formId} navigate={navigate} form={form} />
					) : (
						<>
							<ResponseOverview
								totalResponses={responses.length}
								completionRate={completionStats.rate}
								dropOff={completionStats.dropOff}
								overview={responseOverview}
							/>

							{/* Controls bar */}
							<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
								<div className="relative flex-1 min-w-0 w-full sm:max-w-xs">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
									<input
										type="text"
										value={search}
										onChange={e => setSearch(e.target.value)}
										placeholder="Search responses..."
										className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm outline-none transition-all placeholder-gray-400 focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:focus:bg-surface-elevated-dark"
									/>
								</div>
								<div className="flex items-center gap-2 flex-wrap">
									{dateRangeLabel && (
										<span className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-800">
											<Calendar className="h-3.5 w-3.5" />
											{dateRangeLabel}
										</span>
									)}
									<button
										onClick={() => toggleSort('_date')}
										className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-surface-elevated-dark rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
									>
										<ArrowUpDown className="h-3.5 w-3.5" />
										{sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
									</button>
								</div>
							</div>

							{/* Response table */}
							<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-surface-elevated-dark">
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
												<th className="px-4 py-3 w-10">
													<input
														type="checkbox"
														checked={selectedIds.size === paginatedResponses.length && paginatedResponses.length > 0}
														onChange={selectAll}
														className="rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500/20"
													/>
												</th>
												<th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
													#
												</th>
												<th
													onClick={() => toggleSort('_date')}
													className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
												>
													<span className="inline-flex items-center gap-1">
														Submitted
														{sortCol === '_date' ? (
															<span className="text-brand-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
														) : (
															<ArrowUpDown className="h-3 w-3 opacity-30" />
														)}
													</span>
												</th>
												{tableFields.map(field => (
													<th
														key={field.id}
														onClick={() => toggleSort(field.id)}
														className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
													>
														<span className="inline-flex items-center gap-1">
											{staticFieldLabel(field)}
															{sortCol === field.id ? (
																<span className="text-brand-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
															) : (
																<ArrowUpDown className="h-3 w-3 opacity-30" />
															)}
														</span>
													</th>
												))}
												<th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
													Status
												</th>
												<th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
													Completion
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
											{paginatedResponses.map((response, index) => {
												const data = parseResponseData(response)
												const submittedAt = response.submittedAt
													? new Date(Number(response.submittedAt)).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
													: ''
												const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index
												const responseNum = filteredResponses.length - globalIndex
												const completionPct = responseCompletionPct(fields, data)
												const isComplete = completionPct === 100

												return (
													<tr
														key={response.id}
														onClick={() => setSelectedResponse(response.id)}
														className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer group"
													>
														<td className="px-4 py-3">
															<input
																type="checkbox"
																checked={selectedIds.has(response.id)}
																onChange={() => toggleSelect(response.id)}
																className="rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500/20"
																onClick={e => e.stopPropagation()}
															/>
														</td>
														<td className="px-4 py-3 text-gray-400 dark:text-gray-500 tabular-nums text-xs font-medium">
															{responseNum}
														</td>
														<td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
															{submittedAt}
														</td>
														{tableFields.map(field => {
															const formatted = formatResponseValue(field, data[field.id])
															return (
																<td key={field.id} className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-[180px] truncate text-sm">
																	{formatted.kind === 'empty' ? <span className="text-gray-300 dark:text-gray-600">—</span> : formatted.values.join(', ')}
																</td>
															)
														})}
														<td className="px-4 py-3">
															<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
																isComplete
																	? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
																	: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
															}`}>
																{isComplete ? 'Complete' : 'Partial'}
															</span>
														</td>
														<td className="px-4 py-3">
															<div className="flex items-center gap-2">
																<div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
																	<div
																		className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-amber-400'}`}
																		style={{ width: `${completionPct}%` }}
																	/>
																</div>
																<span className="text-[10px] text-gray-400 tabular-nums">{completionPct}%</span>
															</div>
														</td>
													</tr>
												)
											})}
										</tbody>
									</table>
								</div>

								{/* Pagination */}
								{filteredResponses.length > ITEMS_PER_PAGE && (
									<div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20">
										<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
											{paginationStart}-{paginationEnd} of {filteredResponses.length}
										</span>
										<div className="flex items-center gap-1">
											<button
												onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
												disabled={currentPage === 1}
												className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
											>
												<ChevronLeft className="h-4 w-4" />
											</button>
											{Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
												let pageNum: number
												if (totalPages <= 5) {
													pageNum = i + 1
												} else if (currentPage <= 3) {
													pageNum = i + 1
												} else if (currentPage >= totalPages - 2) {
													pageNum = totalPages - 4 + i
												} else {
													pageNum = currentPage - 2 + i
												}
												return (
													<button
														key={pageNum}
														onClick={() => setCurrentPage(pageNum)}
														className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
															currentPage === pageNum
																? 'bg-brand-500 text-white shadow-sm'
																: 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
														}`}
													>
														{pageNum}
													</button>
												)
											})}
											<button
												onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
												disabled={currentPage === totalPages}
												className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
											>
												<ChevronRight className="h-4 w-4" />
											</button>
										</div>
									</div>
								)}
							</div>
						</>
					)}
				</>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* ANALYTICS TAB                                                    */}
			{/* ---------------------------------------------------------------- */}
			{subTab === 'analytics' && (
				<>
					{responses.length === 0 ? (
						<EmptyState formId={formId} navigate={navigate} form={form} />
					) : (
						<AnalyticsView fields={fields} responses={responses} />
					)}
				</>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* FIELD INSIGHTS TAB                                               */}
			{/* ---------------------------------------------------------------- */}
			{subTab === 'insights' && (
				<>
					{responses.length === 0 ? (
						<EmptyState formId={formId} navigate={navigate} form={form} />
					) : (
						<FieldInsightsView fields={fields} responses={responses} />
					)}
				</>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* TO DO TAB                                                        */}
			{/* ---------------------------------------------------------------- */}
			{subTab === 'todo' && (
				<FollowUpView
					fields={fields}
					responses={responses}
					onOpenResponse={setSelectedResponse}
					onInspectField={(fieldId) => {
						void fieldId
						switchSubTab('insights')
						setSearch('')
					}}
				/>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* Bulk action bar                                                  */}
			{/* ---------------------------------------------------------------- */}
			{selectedIds.size > 0 && (
				<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-scale-in">
					<div className="flex items-center gap-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-2xl shadow-2xl px-5 py-3 backdrop-blur-sm">
						<span className="text-sm font-medium">{selectedIds.size} selected</span>
						<button
							onClick={() => setSelectedIds(new Set())}
							className="text-xs text-gray-400 dark:text-gray-600 hover:text-white dark:hover:text-gray-900 transition-colors"
						>
							Clear
						</button>
						<div className="w-px h-5 bg-gray-700 dark:bg-gray-300" />
						<button
							onClick={() => exportCsv(undefined, responses.filter(response => selectedIds.has(String(response.id))))}
							className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-200 dark:text-gray-700 hover:text-white dark:hover:text-gray-900 transition-colors"
						>
							<Download className="h-3.5 w-3.5" />
							Export
						</button>
						<div className="w-px h-5 bg-gray-700 dark:bg-gray-300" />
						<button
							onClick={deleteSelected}
							className="inline-flex items-center gap-1.5 text-sm font-medium text-red-400 dark:text-red-600 hover:text-red-300 dark:hover:text-red-500 transition-colors"
						>
							<Trash2 className="h-3.5 w-3.5" />
							Delete
						</button>
					</div>
				</div>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* Response detail slide-out                                        */}
			{/* ---------------------------------------------------------------- */}
			{selectedResponse && (
				<ResponseSlideOut
					responseId={selectedResponse}
					responses={filteredResponses}
					fields={fields}
					onClose={() => setSelectedResponse(null)}
					onNavigate={setSelectedResponse}
					onDelete={(id) => {
						app.responses.delete(id)
						setSelectedResponse(null)
					}}
				/>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* Export modal                                                     */}
			{/* ---------------------------------------------------------------- */}
			{showExportModal && (
				<ExportModal
					fields={fields}
					responseCount={responses.length}
					onExportCsv={exportCsv}
					onExportJson={exportJson}
					onClose={() => setShowExportModal(false)}
				/>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* Share modal                                                      */}
			{/* ---------------------------------------------------------------- */}
			{showShareModal && (
				<ShareModal
					slug={String(form.slug || formId)}
					title={String(form.title || 'Form')}
					onClose={() => setShowShareModal(false)}
				/>
			)}
		</div>
	)
}

// ============================================================================
// StatCard Component
// ============================================================================

function ResponseOverview({
	totalResponses,
	completionRate,
	dropOff,
	overview,
}: {
	totalResponses: number
	completionRate: number
	dropOff: number
	overview: ResponseOverviewSummary
}) {
	const health = completionRate >= 85 ? 'Strong' : completionRate >= 60 ? 'Watch' : 'Needs review'
	const healthClass = completionRate >= 85
		? 'text-emerald-700 dark:text-emerald-300'
		: completionRate >= 60
			? 'text-amber-700 dark:text-amber-300'
			: 'text-red-600 dark:text-red-300'
	const primarySignal = overview.requiredGaps[0]
		? `${staticFieldLabel(overview.requiredGaps[0].field)} missing in ${overview.requiredGaps[0].missing}`
		: overview.lowFillFields[0]
			? `${staticFieldLabel(overview.lowFillFields[0].field)} at ${overview.lowFillFields[0].pct}% fill`
			: 'No urgent review signals'

	return (
		<section className="mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
			<div className="grid grid-cols-2 gap-y-4 md:grid-cols-[1.1fr_repeat(4,0.7fr)] md:items-center">
				<div className="col-span-2 min-w-0 md:col-span-1">
					<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Health</p>
					<div className="mt-0.5 flex items-center gap-2">
						<span className={`text-[15px] font-semibold ${healthClass}`}>{health}</span>
						<span className="text-[12px] text-slate-400 dark:text-gray-500">{primarySignal}</span>
					</div>
				</div>
				<ResponseMetric label="Responses" value={totalResponses.toLocaleString()} helper={overview.lastResponseAt ? formatTimeSince(overview.lastResponseAt) : 'No activity'} />
				<ResponseMetric label="Complete" value={`${completionRate}%`} helper={`${dropOff} partial`} tone={dropOff > 0 ? 'warn' : 'good'} />
				<ResponseMetric label="Median" value={overview.medianDuration ? formatDuration(overview.medianDuration) : '—'} helper="Completion time" />
				<ResponseMetric label="Mobile" value={overview.mobilePct == null ? '—' : `${overview.mobilePct}%`} helper="Respondents" />
			</div>
		</section>
	)
}

function ResponseMetric({ label, value, helper, tone = 'neutral' }: { label: string; value: string; helper: string; tone?: 'neutral' | 'good' | 'warn' }) {
	const valueClass = tone === 'good' ? 'text-emerald-700 dark:text-emerald-300' : tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-950 dark:text-gray-100'
	return (
		<div className="min-w-0 md:border-l md:border-slate-100 md:pl-4 md:dark:border-gray-800">
			<p className="text-[11px] font-medium text-slate-400 dark:text-gray-500">{label}</p>
			<p className={`mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight ${valueClass}`}>{value}</p>
			<p className="truncate text-[11px] text-slate-400 dark:text-gray-600">{helper}</p>
		</div>
	)
}

function StatCard({
	icon,
	iconBg,
	iconColor,
	label,
	value,
	trend,
}: {
	icon: React.ReactNode
	iconBg: string
	iconColor: string
	label: string
	value: string
	trend?: 'up' | 'down' | 'flat'
}) {
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 shadow-sm">
			<div className="flex items-start justify-between mb-3">
				<div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>
					{icon}
				</div>
				{trend && (
					<span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
						trend === 'up' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
						trend === 'down' ? 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400' :
						'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
					}`}>
						{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
					</span>
				)}
			</div>
			<p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums tracking-tight">{value}</p>
			<p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
		</div>
	)
}

// ============================================================================
// Empty State
// ============================================================================

function FollowUpView({
	fields,
	responses,
	onOpenResponse,
	onInspectField,
}: {
	fields: FormField[]
	responses: Record<string, unknown>[]
	onOpenResponse: (id: string) => void
	onInspectField: (fieldId: string) => void
}) {
	const review = useMemo(() => {
		return buildFollowUpReview(fields, responses)
	}, [fields, responses])

	const hasWork = review.incomplete.length > 0 || review.slow.length > 0 || review.lowFillFields.length > 0 || review.duplicateGroups.length > 0

	if (responses.length === 0) {
		return (
			<div className="py-16 text-center">
				<ListChecks className="mx-auto h-8 w-8 text-slate-300 dark:text-gray-700" />
				<h2 className="mt-3 text-lg font-semibold text-slate-950 dark:text-gray-100">Nothing to review yet</h2>
				<p className="mt-1 text-sm text-slate-400 dark:text-gray-500">Follow-up suggestions appear after submissions arrive.</p>
			</div>
		)
	}

	return (
		<div className="space-y-5 animate-fade-in">
			<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Review queue</p>
						<h2 className="mt-1 text-[24px] font-bold tracking-tight text-slate-950 dark:text-gray-100">
							{hasWork ? 'Suggested follow-ups' : 'Everything looks clean'}
						</h2>
						<p className="mt-1 text-[14px] text-slate-500 dark:text-gray-400">
							KoraForms scans required gaps, slow submissions, low-fill fields, and duplicate-looking respondents.
						</p>
					</div>
					<div className="grid grid-cols-4 gap-2 text-center">
						<QueueCount label="Incomplete" value={review.incomplete.length} />
						<QueueCount label="Slow" value={review.slow.length} />
						<QueueCount label="Fields" value={review.lowFillFields.length} />
						<QueueCount label="Dupes" value={review.duplicateGroups.length} />
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				<ReviewSection
					title="Incomplete required answers"
					description="Responses missing one or more required fields."
					empty="No required gaps found."
				>
					{review.incomplete.map(item => (
						<ReviewResponseRow
							key={String(item.response.id)}
							response={item.response}
							title={`${item.missingFields.length} missing required field${item.missingFields.length !== 1 ? 's' : ''}`}
							detail={item.missingFields.map(staticFieldLabel).join(', ')}
							badge={`${item.completion}%`}
							onOpen={() => onOpenResponse(String(item.response.id))}
						/>
					))}
				</ReviewSection>

				<ReviewSection
					title="Slow submissions"
					description={`Responses that took longer than ${formatDuration(Math.round(review.slowThreshold))}.`}
					empty="No unusually slow submissions."
				>
					{review.slow.map(item => (
						<ReviewResponseRow
							key={String(item.response.id)}
							response={item.response}
							title="Long completion time"
							detail="This may indicate confusing wording or too many fields."
							badge={formatDuration(Math.round(Number(item.meta?.duration) || 0))}
							onOpen={() => onOpenResponse(String(item.response.id))}
						/>
					))}
				</ReviewSection>

				<ReviewSection
					title="Low-fill fields"
					description="Fields with fill rates below 75%."
					empty="No low-fill fields detected."
				>
					{review.lowFillFields.map(item => (
						<button
							key={item.field.id}
							onClick={() => onInspectField(item.field.id)}
							className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-brand-800"
						>
							<div className="min-w-0">
								<p className="truncate text-[14px] font-semibold text-slate-800 dark:text-gray-200">{staticFieldLabel(item.field)}</p>
								<p className="mt-0.5 text-[12px] text-slate-400 dark:text-gray-500">{item.missing} blank response{item.missing !== 1 ? 's' : ''}</p>
							</div>
							<span className="rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{item.pct}%</span>
						</button>
					))}
				</ReviewSection>

				<ReviewSection
					title="Possible duplicates"
					description="Repeated names, emails, or phone numbers."
					empty="No duplicate-looking respondents."
				>
					{review.duplicateGroups.map(group => (
						<button
							key={`${group.field.id}-${group.value}`}
							onClick={() => onOpenResponse(String(group.responses[0]?.id))}
							className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-brand-800"
						>
							<div className="min-w-0">
								<p className="truncate text-[14px] font-semibold text-slate-800 dark:text-gray-200">{group.value}</p>
								<p className="mt-0.5 text-[12px] text-slate-400 dark:text-gray-500">{staticFieldLabel(group.field)}</p>
							</div>
							<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600 dark:bg-gray-800 dark:text-gray-300">{group.responses.length}x</span>
						</button>
					))}
				</ReviewSection>
			</div>
		</div>
	)
}

function QueueCount({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-900/60">
			<p className="text-[18px] font-bold tabular-nums text-slate-950 dark:text-gray-100">{value}</p>
			<p className="text-[10px] font-medium text-slate-400 dark:text-gray-500">{label}</p>
		</div>
	)
}

function ReviewSection({ title, description, empty, children }: { title: string; description: string; empty: string; children: React.ReactNode }) {
	const hasChildren = Array.isArray(children) ? children.length > 0 : !!children
	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
			<div className="mb-4">
				<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">{title}</h3>
				<p className="mt-1 text-[12px] text-slate-400 dark:text-gray-500">{description}</p>
			</div>
			<div className="space-y-2">
				{hasChildren ? children : (
					<div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-[13px] text-slate-400 dark:border-gray-800 dark:text-gray-600">
						{empty}
					</div>
				)}
			</div>
		</section>
	)
}

function ReviewResponseRow({
	response,
	title,
	detail,
	badge,
	onOpen,
}: {
	response: Record<string, unknown>
	title: string
	detail: string
	badge: string
	onOpen: () => void
}) {
	return (
		<button
			onClick={onOpen}
			className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-brand-800"
		>
			<div className="min-w-0">
				<p className="truncate text-[14px] font-semibold text-slate-800 dark:text-gray-200">{title}</p>
				<p className="mt-0.5 truncate text-[12px] text-slate-400 dark:text-gray-500">{detail}</p>
					{response.submittedAt ? (
						<p className="mt-1 text-[11px] text-slate-400 dark:text-gray-600">{formatTimeSince(Number(response.submittedAt))}</p>
					) : null}
			</div>
			<span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{badge}</span>
		</button>
	)
}

function EmptyState({
	formId,
	navigate,
	form,
}: {
	formId: string
	navigate: (path: string) => void
	form: Record<string, unknown>
}) {
	const [copied, setCopied] = useState(false)

	const copyLink = () => {
		const slug = String(form.slug || formId)
		const url = `${window.location.origin}/f/${slug}`
		navigator.clipboard.writeText(url)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	return (
		<div className="flex flex-col items-center justify-center py-16 animate-fade-in">
			{/* Icon */}
			<div className="relative mb-8">
				<div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 flex items-center justify-center shadow-lg shadow-gray-100/50 dark:shadow-none">
					<Inbox className="h-10 w-10 text-gray-300 dark:text-gray-600" />
				</div>
			</div>

			{/* Message */}
			<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No responses yet</h2>
			<p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mb-8 leading-relaxed">
				Share your form to start collecting data. New submissions will appear here automatically — even when you are offline.
			</p>

			{/* Buttons */}
			<div className="flex items-center gap-3 mb-12">
				<button
					onClick={() => navigate(`share/${formId}`)}
					className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 active:scale-[0.98] shadow-sm shadow-brand-600/25"
				>
					<Share2 className="h-4 w-4" />
					Share form
				</button>
				<button
					onClick={copyLink}
					className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
				>
					{copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
					{copied ? 'Copied!' : 'Copy link'}
				</button>
			</div>

			{/* Steps */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-lg mb-10">
				{[
					{ step: 1, title: 'Share', desc: 'Share a link or QR code' },
					{ step: 2, title: 'Collect', desc: 'Respond anytime online or offline' },
					{ step: 3, title: 'Understand', desc: 'Data insights when enough data arrives' },
				].map(item => (
					<div key={item.step} className="text-center">
						<div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-sm font-bold mx-auto mb-2">
							{item.step}
						</div>
						<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
						<p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.desc}</p>
					</div>
				))}
			</div>

			{/* Offline banner */}
			<div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 px-4 py-2.5 mb-8">
				<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
				<span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Ready to collect offline</span>
			</div>

			{/* Analytics teaser */}
			<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 p-5 max-w-sm w-full text-center">
				<p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">When will analytics appear?</p>
				<p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
					Response trends and comparisons become available after 5 responses.
				</p>
				<div className="flex items-center gap-2 justify-center">
					<div className="flex-1 max-w-[120px] h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
						<div className="h-full rounded-full bg-brand-400" style={{ width: '0%' }} />
					</div>
					<span className="text-[10px] text-gray-400 tabular-nums">0 of 5</span>
				</div>
			</div>
		</div>
	)
}

// ============================================================================
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

function SummaryCard({ label, value, trend, sparkData }: { label: string; value: string; trend: number | null; sparkData: number[] }) {
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

function ResponsesBarChart({ data }: { data: { date: Date; count: number; label: string }[] }) {
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

function CalendarHeatmap({ responses }: { responses: Record<string, unknown>[] }) {
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

function FieldBreakdownCard({ analysis, totalResponses }: { analysis: FieldAnalysis; totalResponses: number }) {
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

function DonutChart({ data, title }: { data: [string, number][]; title: string }) {
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

function NpsGauge({ nps, promoters, passives, detractors, total, fieldLabel }: { nps: number; promoters: number; passives: number; detractors: number; total: number; fieldLabel: string }) {
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

function DropoffFunnel({ data }: { data: { label: string; filled: number; pct: number }[] }) {
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
// AnalyticsView (full analytics dashboard under the Analytics sub-tab)
// ============================================================================

function AnalyticsView({ fields, responses }: { fields: FormField[]; responses: Record<string, unknown>[] }) {
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

function FieldInsightsView({ fields, responses }: { fields: FormField[]; responses: Record<string, unknown>[] }) {
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
