import { useQuery, useMutation, useSyncStatus } from '@korajs/react'
import { app } from '../kora'
import { setPageMeta } from '../utils/meta'
import {
	Plus,
	MoreHorizontal,
	Trash2,
	Eye,
	Pencil,
	Copy,
	LayoutTemplate,
	ArrowRight,
	BarChart3,
	Send,
	Check,
	CopyPlus,
	TrendingUp,
	Globe,
	Clock,
	Sparkles,
	Zap,
	ExternalLink,
	Archive,
	ArchiveRestore,
	Download,
	FileText,
	ChevronDown,
	ShieldCheck,
	Activity,
	AlertCircle,
	WifiOff,
	Upload,
} from 'lucide-react'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { FORM_TEMPLATES, TEMPLATE_CATEGORIES, createFieldsFromTemplate } from '../templates'
import { ShareModal } from '../components/shared/ShareModal'
import { Share2, Search } from 'lucide-react'
import { getThemeById } from '../themes'
import { copyToClipboard } from '../utils/clipboard'
import { downloadJsonFile } from '../utils/download'
import { parseFormFields } from '../domain/forms'
import { readJsonFromStorage, writeJsonToStorage } from '../utils/storage'
import type { FormSettings } from '../types'
import {
	buildDashboardResponseStats,
	buildDuplicateFormPayload,
	buildFormExportPayload,
	buildLastSeenMap,
	buildTemplateFormPayload,
	buildWorkspaceHealthSnapshot,
	buildWorkspaceBackupPayload,
	buildRestoredFormPayload,
	buildRestoredResponsePayload,
	filterDashboardForms,
	formExportFilename,
	groupDashboardForms,
	isArchivedForm,
	parseWorkspaceRestorePlan,
	publicFormIdentifier,
	serializeArchiveSettings,
	workspaceBackupFilename,
	type DashboardFilter,
	type FormRecord,
	type ResponseRecord,
} from '../features/forms/dashboard'
import {
	getPublicOfflineDiagnostics,
	type PublicOfflineDiagnostics,
	type PublicOfflineFormDiagnostics,
} from '../features/form-fill/offlineRuntime'
import { recordAuditEvent } from '../features/audit/events'

interface Props {
	navigate: (path: string) => void
	userId: string
}

/** Generate a decorative gradient background based on theme color */
function getCardGradient(themeId: string): string {
	const theme = getThemeById(themeId)
	const c = theme.colors

	const gradients: Record<string, string> = {
		blue: `linear-gradient(135deg, ${c[400]} 0%, ${c[600]} 40%, #0d9488 100%)`,
		indigo: `linear-gradient(135deg, ${c[400]} 0%, ${c[600]} 50%, #7c3aed 100%)`,
		rose: `linear-gradient(135deg, ${c[400]} 0%, ${c[600]} 50%, #f97316 100%)`,
		emerald: `linear-gradient(135deg, ${c[400]} 0%, ${c[600]} 50%, #06b6d4 100%)`,
		amber: `linear-gradient(135deg, ${c[400]} 0%, ${c[500]} 50%, #f97316 100%)`,
		violet: `linear-gradient(135deg, ${c[400]} 0%, ${c[600]} 50%, #ec4899 100%)`,
		sky: `linear-gradient(135deg, ${c[400]} 0%, ${c[600]} 50%, #3b82f6 100%)`,
		orange: `linear-gradient(135deg, ${c[400]} 0%, ${c[600]} 50%, #ef4444 100%)`,
		teal: `linear-gradient(135deg, ${c[400]} 0%, ${c[600]} 50%, #10b981 100%)`,
		pink: `linear-gradient(135deg, ${c[400]} 0%, ${c[600]} 50%, #a855f7 100%)`,
		cyan: `linear-gradient(135deg, ${c[400]} 0%, ${c[600]} 50%, #0ea5e9 100%)`,
		slate: `linear-gradient(135deg, ${c[400]} 0%, ${c[600]} 50%, #6366f1 100%)`,
		red: `linear-gradient(135deg, ${c[400]} 0%, ${c[500]} 50%, #f97316 100%)`,
	}

	return gradients[themeId] || `linear-gradient(135deg, ${c[400]} 0%, ${c[600]} 50%, ${c[800]} 100%)`
}

export function FormList({ navigate, userId }: Props) {
	useEffect(() => {
		setPageMeta({ title: 'Dashboard', description: 'Manage your forms and view responses.' })
	}, [])

	const allForms = useQuery(
		userId
			? app.forms.where({ ownerId: userId }).orderBy('createdAt', 'desc')
			: app.forms.where({}).orderBy('createdAt', 'desc'),
	)
	const allResponses = useQuery(app.responses.where({}).orderBy('submittedAt', 'desc'))
	const syncStatus = useSyncStatus()
	const { mutateAsync: deleteForm } = useMutation((id: string) => app.forms.delete(id))
	const { mutateAsync: createForm } = useMutation(
		(data: Record<string, unknown>) => app.forms.insert(data),
	)
	const { mutateAsync: duplicateForm } = useMutation(
		(data: Record<string, unknown>) => app.forms.insert(data),
	)
	const { mutateAsync: createResponse } = useMutation(
		(data: Record<string, unknown>) => app.responses.insert(data),
	)

	const { mutate: updateForm } = useMutation(
		(data: { id: string; settings: string }) =>
			app.forms.update(data.id, { settings: data.settings }),
	)

	const [showTemplates, setShowTemplates] = useState(false)
	const [copiedId, setCopiedId] = useState<string | null>(null)
	const [shareForm, setShareForm] = useState<Record<string, unknown> | null>(null)
	const [filter, setFilter] = useState<DashboardFilter>('all')
	const [searchQuery, setSearchQuery] = useState('')
	const [publicOfflineDiagnostics, setPublicOfflineDiagnostics] = useState<PublicOfflineDiagnostics | null>(null)
	const [restoreStatus, setRestoreStatus] = useState<{ tone: 'success' | 'error' | 'muted'; message: string } | null>(null)
	const restoreInputRef = useRef<HTMLInputElement | null>(null)

	const handleArchive = (form: Record<string, unknown>) => {
		updateForm({ id: String(form.id), settings: JSON.stringify(serializeArchiveSettings(form.settings, true)) })
		void recordAuditEvent(app.audit_events, {
			formId: String(form.id),
			actorId: userId,
			eventType: 'form_archived',
			summary: 'Archived form',
		})
	}

	const handleUnarchive = (form: Record<string, unknown>) => {
		updateForm({ id: String(form.id), settings: JSON.stringify(serializeArchiveSettings(form.settings, false)) })
		void recordAuditEvent(app.audit_events, {
			formId: String(form.id),
			actorId: userId,
			eventType: 'form_restored',
			summary: 'Restored form',
		})
	}

	const handleCreateFromTemplate = async (key: string) => {
		const payload = key === 'blank'
			? { title: 'Untitled Form', description: '', fields: '[]', status: 'draft', ownerId: userId, theme: 'red' }
			: buildTemplateFormPayload(key, userId)
		if (!payload) return
		setShowTemplates(false)
		try {
			const record = await app.forms.insert(payload)
			void recordAuditEvent(app.audit_events, {
				formId: String(record.id),
				actorId: userId,
				eventType: key === 'blank' ? 'form_created' : 'template_used',
				summary: key === 'blank' ? 'Created blank form' : 'Created form from template',
				metadata: { templateKey: key },
			})
			navigate(`build/${record.id}`)
		} catch (err) {
			console.error('Failed to create form:', err)
		}
	}

	const handleDuplicate = async (form: Record<string, unknown>) => {
		const record = await duplicateForm(buildDuplicateFormPayload(form as FormRecord, userId))
		void recordAuditEvent(app.audit_events, {
			formId: String(record.id),
			actorId: userId,
			eventType: 'form_duplicated',
			summary: 'Duplicated form',
			metadata: { sourceFormId: String(form.id) },
		})
	}

	const handleDeleteForm = async (form: Record<string, unknown>) => {
		await deleteForm(String(form.id))
		void recordAuditEvent(app.audit_events, {
			formId: String(form.id),
			actorId: userId,
			eventType: 'form_deleted',
			summary: 'Deleted form',
		})
	}

	const handleCopyLink = async (form: Record<string, unknown>) => {
		const identifier = publicFormIdentifier(form as FormRecord)
		const link = `${window.location.origin}/f/${identifier}`
		if (await copyToClipboard(link)) {
			setCopiedId(String(form.id))
			setTimeout(() => setCopiedId(null), 2000)
		}
	}

	const handleExportForm = (form: Record<string, unknown>) => {
		const data = buildFormExportPayload(form as FormRecord)
		downloadJsonFile(data, formExportFilename(form.title))
	}

	const handleBackupWorkspace = () => {
		const now = new Date()
		const data = buildWorkspaceBackupPayload(allForms, allResponses, now)
		downloadJsonFile(data, workspaceBackupFilename(now))
	}

	const handleRestoreWorkspaceFile = async (file: File | null) => {
		if (!file) return
		setRestoreStatus({ tone: 'muted', message: 'Reading backup...' })
		try {
			const text = await file.text()
			const plan = parseWorkspaceRestorePlan(JSON.parse(text) as unknown)
			if (plan.forms.length === 0) {
				setRestoreStatus({ tone: 'error', message: 'This backup does not contain any forms.' })
				return
			}

			const formIdMap = new Map<string, string>()
			for (const form of plan.forms) {
				const restored = await createForm(buildRestoredFormPayload(form, userId))
				formIdMap.set(form.id, String(restored.id))
				void recordAuditEvent(app.audit_events, {
					formId: String(restored.id),
					actorId: userId,
					eventType: 'form_restored',
					summary: 'Restored form from workspace backup',
					metadata: {
						sourceFormId: form.id,
						sourceSlug: form.originalSlug,
						sourceStatus: form.originalStatus,
						backupExportedAt: plan.exportedAt,
					},
				})
			}

			for (const response of plan.responses) {
				const restoredFormId = formIdMap.get(response.formId)
				if (!restoredFormId) continue
				await createResponse(buildRestoredResponsePayload(response, restoredFormId))
			}

			setRestoreStatus({
				tone: 'success',
				message: `Restored ${plan.forms.length} form${plan.forms.length === 1 ? '' : 's'} and ${plan.responses.length} response${plan.responses.length === 1 ? '' : 's'} as draft copies.`,
			})
		} catch (error) {
			setRestoreStatus({
				tone: 'error',
				message: error instanceof Error ? error.message : 'Could not restore this backup.',
			})
		} finally {
			if (restoreInputRef.current) restoreInputRef.current.value = ''
		}
	}

	const formGroups = useMemo(() => groupDashboardForms(allForms), [allForms])
	const { activeForms, archivedForms, published, drafts } = formGroups

	const lastSeenKey = 'koraforms-last-seen'
	const userFormIds = useMemo(() => allForms.map((form) => String(form.id)), [allForms])
	const lastSeen = useMemo(
		() => readJsonFromStorage<Record<string, number>>(lastSeenKey, {}),
		[allForms.length, allResponses.length],
	)
	const responseStats = useMemo(() => {
		return buildDashboardResponseStats(allForms, allResponses, lastSeen)
	}, [allForms, allResponses, lastSeen])
	const refreshPublicOfflineDiagnostics = useCallback(() => {
		getPublicOfflineDiagnostics()
			.then(setPublicOfflineDiagnostics)
			.catch(() => setPublicOfflineDiagnostics(null))
	}, [])
	const publicOfflineForms = useMemo(() => {
		const byId = new Map<string, PublicOfflineFormDiagnostics>()
		for (const item of publicOfflineDiagnostics?.forms || []) {
			if (item.formId) byId.set(String(item.formId), item)
		}
		return byId
	}, [publicOfflineDiagnostics])
	const workspaceHealth = useMemo(
		() => buildWorkspaceHealthSnapshot(allForms, allResponses, lastSeen, publicOfflineDiagnostics),
		[allForms, allResponses, lastSeen, publicOfflineDiagnostics],
	)

	// Update last seen timestamps when viewing dashboard
	useEffect(() => {
		if (userFormIds.length === 0) return
		const lastSeen = readJsonFromStorage<Record<string, number>>(lastSeenKey, {})
		const next = buildLastSeenMap(userFormIds, lastSeen, Date.now())
		writeJsonToStorage(lastSeenKey, next)
	}, [allResponses.length, userFormIds])

	useEffect(() => {
		refreshPublicOfflineDiagnostics()
		const interval = window.setInterval(refreshPublicOfflineDiagnostics, 15_000)
		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible') refreshPublicOfflineDiagnostics()
		}
		window.addEventListener('online', refreshPublicOfflineDiagnostics)
		document.addEventListener('visibilitychange', onVisibilityChange)
		return () => {
			window.clearInterval(interval)
			window.removeEventListener('online', refreshPublicOfflineDiagnostics)
			document.removeEventListener('visibilitychange', onVisibilityChange)
		}
	}, [refreshPublicOfflineDiagnostics])

	const displayForms = useMemo(
		() => filterDashboardForms(formGroups, filter, searchQuery),
		[filter, formGroups, searchQuery],
	)

	return (
		<div className="mx-auto w-full max-w-[1220px] min-w-0 overflow-x-hidden">
			{/* Header */}
			<div className="flex items-start justify-between mb-6">
				<div>
					<h1 className="text-[40px] leading-none font-bold text-slate-950 dark:text-gray-100 tracking-[-0.02em]">
						Forms
					</h1>
					<p className="text-[16px] text-slate-500 dark:text-gray-400 mt-3">
						Create, collect and stay productive—even offline.
					</p>
				</div>
				<button
					onClick={() => setShowTemplates(true)}
					className="inline-flex items-center gap-2.5 kf-primary px-6 py-3.5 text-[15px] font-semibold"
				>
					<Plus className="h-4.5 w-4.5" />
					New form
				</button>
			</div>

			<WorkspaceHealthPanel
					health={workspaceHealth}
					syncStatus={syncStatus.status}
					onBackup={handleBackupWorkspace}
					onRestore={() => restoreInputRef.current?.click()}
				/>
				<input
					ref={restoreInputRef}
					type="file"
					accept=".json,application/json"
					className="hidden"
					onChange={(event) => {
						handleRestoreWorkspaceFile(event.target.files?.[0] || null).catch(() => {})
					}}
				/>
				{restoreStatus && (
					<div className={`mb-5 rounded-2xl border px-4 py-3 text-[13px] font-medium ${
						restoreStatus.tone === 'success'
							? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300'
							: restoreStatus.tone === 'error'
								? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300'
								: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-gray-300'
					}`}>
						{restoreStatus.message}
					</div>
				)}

			{/* Stat Cards */}
			{allForms.length > 0 && (
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
					{/* Total Forms */}
					<div className="kf-panel px-5 py-4 flex items-center gap-4">
						<div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
							<FileText className="h-5 w-5 text-brand-600 dark:text-brand-400" />
						</div>
						<div>
							<p className="text-[13px] font-medium text-slate-500 dark:text-gray-500">Total forms</p>
							<p className="text-[25px] leading-none font-bold text-slate-950 dark:text-gray-100 tracking-tight mt-1">{allForms.length}</p>
							<p className="text-[12px] text-slate-500 dark:text-gray-500 mt-1.5">All forms in your workspace</p>
						</div>
					</div>

					{/* Published */}
					<div className="kf-panel px-5 py-4 flex items-center gap-4">
						<div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
							<Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
						</div>
						<div>
							<p className="text-[13px] font-medium text-slate-500 dark:text-gray-500">Published</p>
							<p className="text-[25px] leading-none font-bold text-slate-950 dark:text-gray-100 tracking-tight mt-1">{published.length}</p>
							<p className="text-[12px] text-slate-500 dark:text-gray-500 mt-1.5">Live and collecting responses</p>
						</div>
					</div>

					{/* Responses */}
					<div className="kf-panel px-5 py-4 flex items-center gap-4">
						<div className="w-10 h-10 rounded-full bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
							<BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
						</div>
						<div>
							<p className="text-[13px] font-medium text-slate-500 dark:text-gray-500">Responses</p>
							<p className="text-[25px] leading-none font-bold text-slate-950 dark:text-gray-100 tracking-tight mt-1">{responseStats.totalResponses}</p>
							<p className="text-[12px] text-slate-500 dark:text-gray-500 mt-1.5">Total across all forms</p>
						</div>
					</div>
				</div>
			)}

			{/* Filter / Search Bar */}
			{allForms.length > 0 && (
				<div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 mb-5">
					<div className="flex items-center gap-3 w-full sm:w-auto">
						{/* Filter pills */}
						<div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
							{(['all', 'published', 'draft', 'archived'] as const).map((f) => (
								<button
									key={f}
									onClick={() => setFilter(f)}
									className={`px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
										filter === f
											? 'bg-brand-50 text-brand-600 shadow-sm dark:bg-brand-900/30 dark:text-brand-300'
											: 'text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-gray-300'
									}`}
								>
									{f === 'all' ? 'All' : f === 'published' ? 'Published' : f === 'draft' ? 'Drafts' : `Archived${archivedForms.length > 0 ? ` (${archivedForms.length})` : ''}`}
								</button>
							))}
						</div>
					</div>

					<div className="flex items-center gap-3 w-full xl:w-auto">
						{/* Search input */}
						<div className="relative flex-1 sm:flex-initial">
							<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 dark:text-gray-500" />
							<input
								type="text"
								placeholder="Search forms..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full xl:w-[360px] pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-[14px] text-slate-950 dark:text-gray-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all duration-200"
							/>
						</div>

						{/* Sort dropdown */}
						<div className="relative">
							<button className="inline-flex items-center gap-2 kf-control px-4 py-3 text-[13px] font-semibold whitespace-nowrap min-w-[142px] justify-center">
								<Clock className="h-4 w-4" />
								Last edited
								<ChevronDown className="h-3 w-3 opacity-50" />
							</button>
						</div>

						{/* Templates button */}
						<button
							onClick={() => navigate('/dashboard/templates')}
							className="inline-flex items-center gap-2 kf-control px-4 py-3 text-[13px] font-semibold text-brand-600 whitespace-nowrap"
						>
							<LayoutTemplate className="h-4 w-4" />
							Templates
						</button>
					</div>
				</div>
			)}

			{/* Template picker */}
			{showTemplates && (
				<TemplatePicker
					onSelect={handleCreateFromTemplate}
					onClose={() => setShowTemplates(false)}
					onBrowseAll={() => { setShowTemplates(false); navigate('/dashboard/templates') }}
				/>
			)}

			{/* Form grid */}
			{displayForms.length > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
					{/* Create card */}
					<button
						onClick={() => setShowTemplates(true)}
						className="group rounded-2xl border border-dashed border-brand-200 bg-white/35 dark:bg-gray-900/30 flex flex-col items-center justify-center gap-2.5 min-h-[214px] transition-colors duration-200 hover:border-brand-400 dark:hover:border-brand-700 hover:bg-brand-50/35 dark:hover:bg-brand-950/10"
					>
						<div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-gray-800 flex items-center justify-center transition-colors duration-200 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30">
							<Plus className="h-6 w-6 text-brand-600 dark:text-brand-400" />
						</div>
						<div className="text-center px-4">
							<p className="text-[15px] font-semibold text-slate-950 dark:text-gray-100 transition-colors duration-200">Create new form</p>
							<p className="text-[13px] text-slate-500 dark:text-gray-500 mt-1.5 leading-relaxed">Start from scratch or choose a template.</p>
						</div>
					</button>

					{displayForms.map((form) => (
						<FormCard
							key={form.id}
							form={form}
							navigate={navigate}
							onDelete={() => void handleDeleteForm(form)}
							onDuplicate={() => void handleDuplicate(form)}
							onCopyLink={() => handleCopyLink(form)}
							onShare={() => setShareForm(form)}
							onExport={() => handleExportForm(form)}
							onArchive={() => handleArchive(form)}
							onUnarchive={() => handleUnarchive(form)}
							isFormArchived={isArchivedForm(form)}
							isCopied={copiedId === form.id}
							responseCount={responseStats.responseCountMap.get(String(form.id)) || 0}
							newResponseCount={responseStats.newResponseCountMap.get(String(form.id)) || 0}
							offlineDiagnostics={publicOfflineForms.get(String(form.id)) || null}
						/>
					))}
				</div>
			) : allForms.length > 0 ? (
				<div className="text-center py-20 animate-fade-in">
					<p className="text-sm text-gray-400 dark:text-gray-500">
						{searchQuery.trim()
							? `No forms matching "${searchQuery}".`
							: `No ${filter === 'published' ? 'published' : filter === 'draft' ? 'draft' : filter === 'archived' ? 'archived' : ''} forms.`
						}
					</p>
				</div>
			) : null}

			{/* Empty state */}
			{allForms.length === 0 && <EmptyState onCreateClick={() => setShowTemplates(true)} onBrowseTemplates={() => navigate('/dashboard/templates')} />}

			{/* Share modal */}
			{shareForm && (
				<ShareModal
					slug={String(shareForm.slug || shareForm.id)}
					title={String(shareForm.title || 'Untitled Form')}
					onClose={() => setShareForm(null)}
				/>
			)}
		</div>
	)
}

function WorkspaceHealthPanel({
	health,
	syncStatus,
	onBackup,
	onRestore,
}: {
	health: ReturnType<typeof buildWorkspaceHealthSnapshot>
	syncStatus: string
	onBackup: () => void
	onRestore: () => void
}) {
	const syncCopy = getDashboardSyncCopy(syncStatus)
	const healthIcon =
		health.tone === 'review' ? <AlertCircle className="h-4.5 w-4.5" />
		: health.tone === 'active' ? <Activity className="h-4.5 w-4.5" />
		: <ShieldCheck className="h-4.5 w-4.5" />
	const healthToneClass =
		health.tone === 'review'
			? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
			: health.tone === 'active'
				? 'bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'
				: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
	const recoveryCopy = getOfflineRecoveryCopy(health)

	return (
		<section
			className="mb-5 rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
			aria-label="Workspace health"
			aria-live="polite"
		>
			<div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr_1fr_1fr_auto] lg:items-center">
				<div className="flex min-w-0 items-center gap-3.5">
					<div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${healthToneClass}`}>
						{healthIcon}
					</div>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<p className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">
								{health.title}
							</p>
							{health.newResponses > 0 && (
								<span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
									{health.newResponses} new
								</span>
							)}
						</div>
						<p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-gray-400">
							{health.description}
						</p>
					</div>
				</div>

				<div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-950/45">
					<HealthMetric value={health.publishedForms} label="Published" />
					<HealthMetric value={health.draftForms} label="Drafts" />
					<HealthMetric value={health.totalResponses} label="Responses" />
				</div>

				<div className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-950/45">
					<div className="min-w-0">
						<p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
							Field recovery
						</p>
						<p className={`mt-1 truncate text-[13px] font-semibold ${recoveryCopy.titleClass}`}>
							{recoveryCopy.title}
						</p>
						<p className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-gray-500">
							{recoveryCopy.description}
						</p>
					</div>
					<span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${recoveryCopy.iconClass}`}>
						<WifiOff className="h-4 w-4" />
					</span>
				</div>

				<div className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-950/45">
					<div className="min-w-0">
						<p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
							Local sync
						</p>
						<p className="mt-1 truncate text-[13px] font-semibold text-slate-700 dark:text-gray-200">
							{syncCopy.title}
						</p>
						<p className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-gray-500">
							{syncCopy.description}
						</p>
					</div>
					<span className={`h-2.5 w-2.5 shrink-0 rounded-full ${syncCopy.dotClass}`} />
				</div>

				<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
					<button
						type="button"
						onClick={onBackup}
						disabled={health.publishedForms + health.draftForms === 0}
						className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-600 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-gray-100 dark:disabled:hover:bg-slate-900 dark:disabled:hover:border-slate-800"
					>
						<Download className="h-4 w-4" />
						Backup
					</button>
					<button
						type="button"
						onClick={onRestore}
						className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-600 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-gray-100"
					>
						<Upload className="h-4 w-4" />
						Restore
					</button>
				</div>
			</div>
		</section>
	)
}

function getOfflineRecoveryCopy(health: ReturnType<typeof buildWorkspaceHealthSnapshot>) {
	const waiting = health.offlinePendingSubmissions
	const review = health.offlineFailedSubmissions + health.offlineRejectedSubmissions + health.offlineBlockingStoreIssues
	const drafts = health.offlineSavedProgress
	const localFiles = health.offlineLocalBlobCount
	if (review > 0) {
		return {
			title: 'Needs review',
			description: `${review} issue${review === 1 ? '' : 's'} preserved locally.`,
			iconClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
			titleClass: 'text-amber-700 dark:text-amber-300',
		}
	}
	if (waiting > 0) {
		return {
			title: 'Waiting to sync',
			description: `${waiting} response${waiting === 1 ? '' : 's'} saved on this device.`,
			iconClass: 'bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300',
			titleClass: 'text-brand-700 dark:text-brand-300',
		}
	}
	if (drafts > 0 || localFiles > 0) {
		const draftCopy = drafts > 0 ? `${drafts} draft${drafts === 1 ? '' : 's'}` : ''
		const fileCopy = localFiles > 0 ? `${localFiles} file${localFiles === 1 ? '' : 's'}` : ''
		return {
			title: 'Saved locally',
			description: [draftCopy, fileCopy].filter(Boolean).join(' and '),
			iconClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
			titleClass: 'text-slate-700 dark:text-slate-200',
		}
	}
	return {
		title: 'Clear',
		description: 'No respondent work is waiting.',
		iconClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
		titleClass: 'text-slate-700 dark:text-slate-200',
	}
}

function HealthMetric({ value, label }: { value: number; label: string }) {
	return (
		<div className="min-w-0 rounded-lg bg-white px-3 py-2 text-center dark:bg-slate-900">
			<p className="text-[18px] font-bold leading-none tracking-tight text-slate-950 dark:text-gray-100">
				{value}
			</p>
			<p className="mt-1 truncate text-[11px] font-medium text-slate-500 dark:text-gray-500">
				{label}
			</p>
		</div>
	)
}

function getDashboardSyncCopy(status: string) {
	if (status === 'syncing') {
		return {
			title: 'Syncing changes',
			description: 'Keeping this device and server aligned.',
			dotClass: 'bg-amber-400',
		}
	}
	if (status === 'offline') {
		return {
			title: 'Working offline',
			description: 'Changes remain on this device until reconnect.',
			dotClass: 'bg-slate-400',
		}
	}
	if (status === 'error' || status === 'schema-mismatch') {
		return {
			title: 'Sync needs attention',
			description: 'Local work is preserved while sync recovers.',
			dotClass: 'bg-red-400',
		}
	}
	return {
		title: 'Saved locally',
		description: 'Changes sync automatically when online.',
		dotClass: 'bg-emerald-400',
	}
}

function FormCard({
	form,
	navigate,
	onDelete,
	onDuplicate,
	onCopyLink,
	onShare,
	onExport,
	onArchive,
	onUnarchive,
	isFormArchived,
	isCopied,
	responseCount,
	newResponseCount,
	offlineDiagnostics,
}: {
	form: Record<string, unknown>
	navigate: (path: string) => void
	onDelete: () => void
	onDuplicate: () => void
	onCopyLink: () => void
	onShare: () => void
	onExport: () => void
	onArchive: () => void
	onUnarchive: () => void
	isFormArchived: boolean
	isCopied: boolean
	responseCount: number
	newResponseCount: number
	offlineDiagnostics: PublicOfflineFormDiagnostics | null
}) {
	const [menuOpen, setMenuOpen] = useState(false)
	const [menuAbove, setMenuAbove] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const isPublished = String(form.status) === 'published'
	const themeId = String(form.theme || 'blue')
	const gradient = getCardGradient(themeId)

	let fieldCount = 0
	try {
		fieldCount = parseFormFields(form.fields).length
	} catch {
		// ignore
	}

	const timeAgo = formatTimeAgo(Number(form.createdAt) || Date.now())
	const offlinePending = offlineDiagnostics
		? offlineDiagnostics.submitted_locally + offlineDiagnostics.syncing + offlineDiagnostics.failed
		: 0
	const offlineNeedsReview = offlineDiagnostics
		? offlineDiagnostics.failed + offlineDiagnostics.rejected
		: 0
	const offlineDrafts = offlineDiagnostics?.progressCount || 0

	useEffect(() => {
		if (!menuOpen) return
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [menuOpen])

	return (
		<div className="group relative kf-panel overflow-hidden transition-shadow duration-200 hover:shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
			{/* Colorful gradient header */}
			<div className="relative h-14 overflow-hidden" style={{ background: gradient }}>
				{/* Decorative geometric shapes */}
				<div className="absolute inset-0 opacity-20">
					<div className="absolute -top-8 -right-6 w-20 h-20 rounded-full border-[2px] border-white/35" />
					<div className="absolute -bottom-4 left-5 w-14 h-14 rounded-xl border border-white/25 rotate-12" />
				</div>

				{/* Three-dot menu in header */}
				<div className="absolute top-3 right-3 z-10" ref={menuRef}>
					<button
						ref={triggerRef}
						onClick={(e) => {
							e.stopPropagation()
							if (!menuOpen) {
								const rect = e.currentTarget.getBoundingClientRect()
								setMenuAbove(window.innerHeight - rect.bottom < 280)
							}
							setMenuOpen(!menuOpen)
						}}
						className="p-1.5 rounded-lg bg-white/90 text-slate-950 hover:bg-white backdrop-blur-sm transition-colors duration-200 shadow-sm"
					>
						<MoreHorizontal className="h-3.5 w-3.5" />
					</button>
					{menuOpen && (
						<div className={`absolute right-0 w-48 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl py-1 z-20 animate-scale-in ${menuAbove ? 'bottom-9' : 'top-9'}`}>
							<MenuButton icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={() => { navigate(`build/${form.id}`); setMenuOpen(false) }} />
							{isPublished && (
								<MenuButton icon={<BarChart3 className="h-3.5 w-3.5" />} label="Responses" onClick={() => { navigate(`responses/${form.id}`); setMenuOpen(false) }} />
							)}
							{isPublished && (
								<MenuButton icon={<ExternalLink className="h-3.5 w-3.5" />} label="Open form" onClick={() => { navigate(`fill/${form.id}`); setMenuOpen(false) }} />
							)}
							{isPublished && (
								<MenuButton
									icon={isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
									label={isCopied ? 'Copied!' : 'Copy link'}
									onClick={() => { onCopyLink(); setMenuOpen(false) }}
								/>
							)}
							{isPublished && (
								<MenuButton icon={<Share2 className="h-3.5 w-3.5" />} label="Share" onClick={() => { onShare(); setMenuOpen(false) }} />
							)}
							<MenuButton icon={<CopyPlus className="h-3.5 w-3.5" />} label="Duplicate" onClick={() => { onDuplicate(); setMenuOpen(false) }} />
							<MenuButton icon={<Download className="h-3.5 w-3.5" />} label="Export JSON" onClick={() => { onExport(); setMenuOpen(false) }} />
							{isFormArchived ? (
								<MenuButton icon={<ArchiveRestore className="h-3.5 w-3.5" />} label="Unarchive" onClick={() => { onUnarchive(); setMenuOpen(false) }} />
							) : (
								<MenuButton icon={<Archive className="h-3.5 w-3.5" />} label="Archive" onClick={() => { onArchive(); setMenuOpen(false) }} />
							)}
							<div className="my-1 mx-3 border-t border-gray-100 dark:border-gray-700/50" />
							<MenuButton icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" danger onClick={() => { onDelete(); setMenuOpen(false) }} />
						</div>
					)}
				</div>
			</div>

			{/* Content area */}
			<div className="relative px-4 pb-3.5 pt-3.5">
				{/* Status badge - overlapping the gradient/content junction */}
				<div className="absolute -top-3 left-4">
					{isPublished ? (
						<span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 shadow-sm">
							Published
						</span>
					) : (
						<span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 shadow-sm border border-gray-200/50 dark:border-gray-600/50">
							Draft
						</span>
					)}
				</div>

				{/* Title & description */}
				<button
					onClick={() => navigate(`build/${form.id}`)}
					className="block w-full text-left mt-3 group/title"
				>
					<h3 className="font-semibold text-[15px] text-slate-950 dark:text-gray-100 truncate transition-colors duration-200 group-hover/title:text-brand-600 dark:group-hover/title:text-brand-400">
						{String(form.title) || 'Untitled Form'}
					</h3>
					{String(form.description) && (
						<p className="text-[13px] text-slate-500 dark:text-gray-500 truncate leading-relaxed mt-1">
							{String(form.description)}
						</p>
					)}
				</button>

				{/* Stats row */}
				<div className="flex items-center gap-2.5 text-[12px] text-slate-500 dark:text-gray-500 mt-3 mb-3">
					<span>{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>
					<span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-gray-600" />
					<span>{timeAgo}</span>
					{isPublished && responseCount > 0 && (
						<>
							<span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-gray-600" />
							<span className="text-brand-600 dark:text-brand-400 font-semibold">
								{responseCount} response{responseCount !== 1 ? 's' : ''}
								{newResponseCount > 0 && (
									<span className="ml-1.5 inline-flex items-center rounded-full bg-brand-500 text-white text-[9px] font-bold px-1.5 py-0.5 leading-none">
										+{newResponseCount} new
									</span>
								)}
							</span>
						</>
					)}
				</div>

				{(offlinePending > 0 || offlineNeedsReview > 0 || offlineDrafts > 0) && (
					<div className="mb-3 flex flex-wrap items-center gap-2">
						{offlineNeedsReview > 0 ? (
							<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
								<AlertCircle className="h-3.5 w-3.5" />
								{offlineNeedsReview} offline issue{offlineNeedsReview === 1 ? '' : 's'}
							</span>
						) : offlinePending > 0 ? (
							<span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
								<WifiOff className="h-3.5 w-3.5" />
								{offlinePending} waiting to sync
							</span>
						) : null}
						{offlineDrafts > 0 && (
							<span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
								<FileText className="h-3.5 w-3.5" />
								{offlineDrafts} saved draft{offlineDrafts === 1 ? '' : 's'}
							</span>
						)}
					</div>
				)}

				{/* Action buttons */}
				<div className="flex items-center gap-2.5 pt-0.5">
					<button
						onClick={() => navigate(`build/${form.id}`)}
						className="flex-1 inline-flex items-center justify-center gap-2 kf-control py-2 text-[13px] font-semibold"
					>
						<Pencil className="h-3.5 w-3.5" />
						Edit
					</button>
					<button
						onClick={() => isPublished ? navigate(`responses/${form.id}`) : navigate(`build/${form.id}`)}
						className="flex-1 inline-flex items-center justify-center gap-2 kf-control py-2 text-[13px] font-semibold"
					>
						<BarChart3 className="h-3.5 w-3.5" />
						Responses
					</button>
				</div>
			</div>
		</div>
	)
}

function MenuButton({
	icon,
	label,
	onClick,
	danger,
}: {
	icon: React.ReactNode
	label: string
	onClick: () => void
	danger?: boolean
}) {
	return (
		<button
			onClick={onClick}
			className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] transition-all duration-150 ${
				danger
					? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
					: 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
			}`}
		>
			{icon}
			{label}
		</button>
	)
}

function EmptyState({ onCreateClick, onBrowseTemplates }: { onCreateClick: () => void; onBrowseTemplates: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center py-20 sm:py-28 animate-fade-in">
			<div className="relative mb-8">
				<div className="w-20 h-20 rounded-[22px] bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/60 flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-700/50">
					<img src="/logo-icon.png" alt="" className="w-10 h-10 rounded-xl opacity-40" />
				</div>
			</div>

			<h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">
				Create your first form
			</h2>
			<p className="text-gray-400 dark:text-gray-500 text-center max-w-sm mb-8 text-sm leading-relaxed">
				Build beautiful forms that work anywhere, even offline.
				Start from a template or create one from scratch.
			</p>

			<div className="flex items-center gap-3">
				<button
					onClick={onCreateClick}
					className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-brand-500 hover:shadow-md active:scale-[0.97]"
				>
					<Plus className="h-4 w-4" />
					New Form
				</button>
				<button
					onClick={onBrowseTemplates}
					className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.97]"
				>
					<LayoutTemplate className="h-4 w-4" />
					Templates
				</button>
			</div>

			{/* Feature hints */}
			<div className="flex items-center gap-8 mt-14 text-center">
				{[
					{ icon: <Zap className="h-4 w-4" />, label: 'Works offline' },
					{ icon: <Sparkles className="h-4 w-4" />, label: '21+ templates' },
					{ icon: <TrendingUp className="h-4 w-4" />, label: 'Built-in analytics' },
				].map((feat) => (
					<div key={feat.label} className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
						<span className="text-gray-300 dark:text-gray-600">{feat.icon}</span>
						{feat.label}
					</div>
				))}
			</div>
		</div>
	)
}

function TemplatePicker({
	onSelect,
	onClose,
	onBrowseAll,
}: {
	onSelect: (key: string) => void
	onClose: () => void
	onBrowseAll: () => void
}) {
	const [search, setSearch] = useState('')
	const query = search.toLowerCase().trim()

	const CATEGORY_ICONS: Record<string, string> = {
		'Church & Religious': '⛪',
		'Events & Registration': '🎫',
		'Feedback & Surveys': '📊',
		'Business & HR': '💼',
		'Education': '🎓',
		'Data Collection': '📋',
	}

	const seen = new Set<string>()
	const filteredCategories = TEMPLATE_CATEGORIES
		.map((cat) => {
			const keys = cat.keys.filter((key) => {
				if (seen.has(key)) return false
				seen.add(key)
				const tmpl = FORM_TEMPLATES[key]
				if (!tmpl) return false
				if (!query) return true
				return (
					tmpl.title.toLowerCase().includes(query) ||
					tmpl.description.toLowerCase().includes(query) ||
					cat.label.toLowerCase().includes(query)
				)
			})
			return { ...cat, keys }
		})
		.filter((cat) => cat.keys.length > 0)

	return (
		<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose}>
			<div
				className="w-full max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 animate-slide-up max-h-[80vh] flex flex-col shadow-2xl border border-gray-200/50 dark:border-gray-700/50"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="shrink-0 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800/60">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Form</h3>
						<button
							onClick={onClose}
							className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150 text-lg"
						>
							&times;
						</button>
					</div>

					<div className="flex gap-3">
						<button
							onClick={() => onSelect('blank')}
							className="shrink-0 flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 transition-all duration-200 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
						>
							<Plus className="h-4 w-4" />
							Blank
						</button>
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 dark:text-gray-600" />
							<input
								type="text"
								placeholder="Search templates..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								autoFocus
								className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all duration-200 border-0"
							/>
						</div>
					</div>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-6 py-4">
					{filteredCategories.length === 0 ? (
						<div className="text-center py-12">
							<p className="text-sm text-gray-400 dark:text-gray-500">
								No templates match &ldquo;{search}&rdquo;
							</p>
						</div>
					) : (
						filteredCategories.map((cat) => (
							<div key={cat.label} className="mb-5 last:mb-0">
								<h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
									<span>{CATEGORY_ICONS[cat.label] || '📄'}</span>
									{cat.label}
								</h4>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
									{cat.keys.map((key) => {
										const tmpl = FORM_TEMPLATES[key]
										if (!tmpl) return null
										return (
											<button
												key={key}
												onClick={() => onSelect(key)}
												className="text-left rounded-xl px-4 py-3 transition-all duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/60 group"
											>
												<div className="flex items-center justify-between gap-2">
													<div className="min-w-0">
														<p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
															{tmpl.title}
														</p>
														<p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
															{tmpl.fields.length} fields
														</p>
													</div>
													<ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-200 dark:text-gray-700 group-hover:text-brand-500 transition-colors duration-150" />
												</div>
											</button>
										)
									})}
								</div>
							</div>
						))
					)}
				</div>

				{/* Footer */}
				<div className="shrink-0 px-6 py-3 border-t border-gray-100 dark:border-gray-800/60">
					<button
						onClick={onBrowseAll}
						className="w-full text-center text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium py-1 transition-colors duration-150"
					>
						Browse all templates &rarr;
					</button>
				</div>
			</div>
		</div>
	)
}

function formatTimeAgo(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000)
	if (seconds < 60) return 'just now'
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.floor(hours / 24)
	if (days < 7) return `${days}d ago`
	if (days < 30) return `${Math.floor(days / 7)}w ago`
	return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
