import {
	Activity,
	AlertCircle,
	AlertTriangle,
	ArrowRight,
	Bell,
	Download,
	ShieldCheck,
	TrendingUp,
	Upload,
	WifiOff,
} from 'lucide-react'
import type { OwnerInboxItem } from '../../features/forms/dashboard'
import type { buildWorkspaceHealthSnapshot } from '../../features/forms/dashboard'

type WorkspaceHealth = ReturnType<typeof buildWorkspaceHealthSnapshot>

export function OwnerInboxPanel({
	items,
	onOpen,
}: {
	items: OwnerInboxItem[]
	onOpen: (item: OwnerInboxItem) => void
}) {
	if (items.length === 0) {
		return (
			<section className="mb-5 rounded-2xl border border-slate-200 bg-white/70 px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/65" aria-label="Owner notifications">
				<div className="flex items-center justify-between gap-4">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
							<Bell className="h-4.5 w-4.5" />
						</div>
						<div className="min-w-0">
							<p className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">Nothing needs attention</p>
							<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">New responses, failed deliveries, and important form events will appear here.</p>
						</div>
					</div>
					<span className="hidden rounded-full bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-500 dark:bg-slate-950/60 dark:text-gray-400 sm:inline-flex">
						Inbox clear
					</span>
				</div>
			</section>
		)
	}

	const priorityCount = items.filter(item => item.tone === 'warning' || item.tone === 'new').length

	return (
		<section className="mb-5 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70" aria-label="Owner notifications">
			<div className="mb-3 flex items-center justify-between gap-4">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
						<Bell className="h-4.5 w-4.5" />
					</div>
					<div className="min-w-0">
						<p className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">Owner inbox</p>
						<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Response activity and delivery issues that need a quick look.</p>
					</div>
				</div>
				<span className="rounded-full bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
					{priorityCount} priority
				</span>
			</div>
			<div className="grid gap-2 lg:grid-cols-5">
				{items.map(item => (
					<button
						key={item.id}
						type="button"
						onClick={() => onOpen(item)}
						className="group rounded-xl border border-slate-200 bg-white p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950/35 dark:hover:border-slate-700"
					>
						<div className="flex items-start gap-2.5">
							<span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ownerInboxToneClass(item.tone)}`}>
								{item.tone === 'warning' ? <AlertTriangle className="h-3.5 w-3.5" /> : item.tone === 'new' ? <TrendingUp className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
							</span>
							<div className="min-w-0">
								<p className="line-clamp-1 text-[13px] font-semibold text-slate-900 dark:text-gray-100">{item.title}</p>
								<p className="mt-0.5 line-clamp-1 text-[12px] font-medium text-slate-500 dark:text-gray-400">{item.formTitle}</p>
							</div>
						</div>
						<p className="mt-3 line-clamp-2 min-h-[32px] text-[12px] leading-relaxed text-slate-500 dark:text-gray-500">{item.description}</p>
						<div className="mt-3 flex items-center justify-between gap-2">
							<span className="text-[11px] font-medium text-slate-400 dark:text-gray-600">{formatInboxTime(item.createdAt)}</span>
							<ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
						</div>
					</button>
				))}
			</div>
		</section>
	)
}

export function WorkspaceHealthPanel({
	health,
	syncStatus,
	onBackup,
	onRestore,
}: {
	health: WorkspaceHealth
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

function ownerInboxToneClass(tone: OwnerInboxItem['tone']) {
	if (tone === 'warning') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
	if (tone === 'new') return 'bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'
	if (tone === 'pending') return 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300'
	return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
}

function formatInboxTime(timestamp: number) {
	if (!timestamp) return 'Just now'
	const deltaMs = Date.now() - timestamp
	if (deltaMs < 60_000) return 'Just now'
	const minutes = Math.floor(deltaMs / 60_000)
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.floor(hours / 24)
	if (days < 7) return `${days}d ago`
	return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getOfflineRecoveryCopy(health: WorkspaceHealth) {
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
