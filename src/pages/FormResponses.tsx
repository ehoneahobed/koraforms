import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@korajs/react'
import { app } from '../kora'
import { setPageMeta } from '../utils/meta'
import { downloadJsonFile, downloadTextFile } from '../utils/download'
import {
	Download, ChevronRight, ChevronLeft,
	BarChart3, Search, Trash2,
	ArrowUpDown,
	Inbox, Calendar,
	Lightbulb, ListChecks
} from 'lucide-react'
import type { FormField } from '../types'
import { AnalyticsView, FieldInsightsView } from '../components/responses/ResponseAnalyticsPanels'
import { ExportModal } from '../components/responses/ExportModal'
import { EmptyState, FollowUpView, ResponseOverview } from '../components/responses/ResponseInboxPanels'
import { ResponseSlideOut } from '../components/responses/ResponseSlideOut'
import { ShareModal } from '../components/shared/ShareModal'
import { parseFormFields } from '../domain/forms'
import {
	formatResponseValue,
	parseResponseData,
	responseCompletionPct,
	responseFields,
	staticFieldLabel,
} from '../features/responses/utils'
import {
	buildResponsesCsvExport,
	buildResponsesJsonExport,
	deleteResponsesMessage,
	responseIdsForDeletion,
} from '../features/responses/actions'
import {
	formatResponseDateRange,
	paginateResponses,
	searchAndSortResponses,
} from '../features/responses/summary'
import {
	buildCompletionStats,
	buildResponseOverview,
} from '../features/responses/inbox'
import {
	reconcileSelectedResponseIds,
	responsesSubTabFromSearch,
	toggleSelectedResponseId,
	toggleVisibleResponseSelection,
	updateResponsesSubTabUrl,
	type ResponsesSubTab,
} from '../features/responses/navigation'

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
	const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
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

	useEffect(() => {
		setConfirmingBulkDelete(false)
	}, [selectedIds.size])

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
		for (const id of responseIdsForDeletion(selectedIds)) {
			app.responses.delete(id)
		}
		setSelectedIds(new Set())
		setConfirmingBulkDelete(false)
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
						{confirmingBulkDelete ? (
							<>
								<span className="max-w-[260px] text-sm font-medium">{deleteResponsesMessage(selectedIds.size)}</span>
								<button
									onClick={() => setConfirmingBulkDelete(false)}
									className="text-xs text-gray-400 dark:text-gray-600 hover:text-white dark:hover:text-gray-900 transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={deleteSelected}
									className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400"
								>
									<Trash2 className="h-3.5 w-3.5" />
									Delete
								</button>
							</>
						) : (
							<>
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
									onClick={() => setConfirmingBulkDelete(true)}
									className="inline-flex items-center gap-1.5 text-sm font-medium text-red-400 dark:text-red-600 hover:text-red-300 dark:hover:text-red-500 transition-colors"
								>
									<Trash2 className="h-3.5 w-3.5" />
									Delete
								</button>
							</>
						)}
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
