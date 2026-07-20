import { useQuery, useMutation } from '@korajs/react'
import { app } from '../kora'
import { setPageMeta } from '../utils/meta'
import {
	Plus,
	FileText,
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
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { FORM_TEMPLATES, TEMPLATE_CATEGORIES } from '../templates'
import { ShareModal } from '../components/shared/ShareModal'
import { Share2, Search } from 'lucide-react'
import { getThemeById } from '../themes'
import { copyToClipboard } from '../utils/clipboard'

interface Props {
	navigate: (path: string) => void
	userId: string
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
	const { mutate: deleteForm } = useMutation((id: string) => app.forms.delete(id))
	const { mutate: createForm } = useMutation(
		(data: { title: string; description: string; fields: string; status: string; ownerId: string }) =>
			app.forms.insert(data),
	)
	const { mutate: duplicateForm } = useMutation(
		(data: { title: string; description: string; fields: string; status: string; ownerId: string; theme: string }) =>
			app.forms.insert(data),
	)

	const [showTemplates, setShowTemplates] = useState(false)
	const [copiedId, setCopiedId] = useState<string | null>(null)
	const [shareForm, setShareForm] = useState<Record<string, unknown> | null>(null)
	const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')

	const handleCreateFromTemplate = (key: string) => {
		const template = FORM_TEMPLATES[key]
		if (!template) return
		createForm({
			title: template.title || 'Untitled Form',
			description: template.description,
			fields: JSON.stringify(template.fields),
			status: 'draft',
			ownerId: userId,
		})
		setShowTemplates(false)
	}

	const handleDuplicate = (form: Record<string, unknown>) => {
		duplicateForm({
			title: `Copy of ${String(form.title || 'Untitled Form')}`,
			description: String(form.description || ''),
			fields: String(form.fields || '[]'),
			status: 'draft',
			ownerId: userId,
			theme: String(form.theme || 'blue'),
		})
	}

	const handleCopyLink = (form: Record<string, unknown>) => {
		const identifier = form.slug ? String(form.slug) : String(form.id)
		const link = `${window.location.origin}/f/${identifier}`
		copyToClipboard(link)
		setCopiedId(String(form.id))
		setTimeout(() => setCopiedId(null), 2000)
	}

	const published = allForms.filter((f) => String(f.status) === 'published')
	const drafts = allForms.filter((f) => String(f.status) !== 'published')

	// Derive response counts from actual responses data (not the stored responseCount field,
	// which can't be updated by anonymous respondents due to sync scoping)
	const responseCountMap = new Map<string, number>()
	for (const r of allResponses) {
		const fid = String(r.formId)
		responseCountMap.set(fid, (responseCountMap.get(fid) || 0) + 1)
	}
	const totalResponses = allResponses.length

	const filteredForms =
		filter === 'published' ? published
		: filter === 'draft' ? drafts
		: allForms

	return (
		<div className="max-w-5xl mx-auto">
			{/* Welcome hero with gradient accent */}
			<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-600 to-brand-700 p-6 sm:p-8 mb-8 shadow-lg shadow-brand-600/10">
				{/* Decorative elements */}
				<div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
				<div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
				<div className="absolute top-8 right-24 w-2 h-2 bg-white/20 rounded-full" />
				<div className="absolute top-16 right-16 w-1.5 h-1.5 bg-white/15 rounded-full" />

				<div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
					<div>
						<div className="flex items-center gap-2 mb-2">
							<Sparkles className="h-4 w-4 text-brand-200" />
							<span className="text-xs font-medium text-brand-200 tracking-wide uppercase">Dashboard</span>
						</div>
						<h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1.5">
							Your Forms
						</h1>
						<p className="text-brand-200 text-sm sm:text-base max-w-md">
							Build, publish, and collect responses — everything works offline.
						</p>
					</div>
					<button
						onClick={() => setShowTemplates(true)}
						className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition-smooth hover:bg-brand-50 active:scale-[0.98] shrink-0"
					>
						<Plus className="h-4 w-4" />
						New Form
					</button>
				</div>
			</div>

			{/* Stats row */}
			{allForms.length > 0 && (
				<div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
					<StatCard
						label="Total Forms"
						value={allForms.length}
						icon={<FileText className="h-4 w-4" />}
						color="brand"
					/>
					<StatCard
						label="Published"
						value={published.length}
						icon={<Globe className="h-4 w-4" />}
						color="emerald"
						detail={allForms.length > 0 ? `${Math.round((published.length / allForms.length) * 100)}%` : undefined}
					/>
					<StatCard
						label="Responses"
						value={totalResponses}
						icon={<TrendingUp className="h-4 w-4" />}
						color="violet"
						detail={published.length > 0 ? `~${Math.round(totalResponses / published.length)}/form` : undefined}
					/>
				</div>
			)}

			{/* Quick actions strip */}
			{allForms.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 mb-6">
					{/* Filters */}
					<div className="flex items-center bg-gray-100 dark:bg-gray-800/80 rounded-lg p-0.5">
						{(['all', 'published', 'draft'] as const).map((f) => (
							<button
								key={f}
								onClick={() => setFilter(f)}
								className={`px-3 py-1.5 rounded-md text-xs font-medium transition-smooth ${
									filter === f
										? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
										: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
								}`}
							>
								{f === 'all' ? `All (${allForms.length})` : f === 'published' ? `Live (${published.length})` : `Drafts (${drafts.length})`}
							</button>
						))}
					</div>

					<div className="flex-1" />

					<button
						onClick={() => navigate('templates')}
						className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-smooth"
					>
						<LayoutTemplate className="h-3.5 w-3.5" />
						Browse templates
					</button>
				</div>
			)}

			{/* Template picker */}
			{showTemplates && (
				<TemplatePicker
					onSelect={handleCreateFromTemplate}
					onClose={() => setShowTemplates(false)}
					onBrowseAll={() => { setShowTemplates(false); navigate('templates') }}
				/>
			)}

			{/* Form grid */}
			{filteredForms.length > 0 ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{/* New form card */}
					<button
						onClick={() => setShowTemplates(true)}
						className="group rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-6 flex flex-col items-center justify-center gap-3 min-h-[200px] transition-smooth hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/30 dark:hover:bg-brand-900/5"
					>
						<div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-smooth group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 group-hover:scale-110">
							<Plus className="h-5 w-5 text-gray-400 transition-smooth group-hover:text-brand-600 dark:group-hover:text-brand-400" />
						</div>
						<div className="text-center">
							<p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-smooth">Create new form</p>
							<p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">From template or blank</p>
						</div>
					</button>

					{filteredForms.map((form) => (
						<FormCard
							key={form.id}
							form={form}
							navigate={navigate}
							onDelete={() => deleteForm(form.id)}
							onDuplicate={() => handleDuplicate(form)}
							onCopyLink={() => handleCopyLink(form)}
							onShare={() => setShareForm(form)}
							isCopied={copiedId === form.id}
							responseCount={responseCountMap.get(String(form.id)) || 0}
						/>
					))}
				</div>
			) : allForms.length > 0 ? (
				<div className="text-center py-16 animate-fade-in">
					<p className="text-sm text-gray-500 dark:text-gray-400">
						No {filter === 'published' ? 'published' : 'draft'} forms yet.
					</p>
				</div>
			) : null}

			{/* Premium empty state */}
			{allForms.length === 0 && <EmptyState onCreateClick={() => setShowTemplates(true)} onBrowseTemplates={() => navigate('templates')} />}

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

function StatCard({
	label,
	value,
	icon,
	color,
	detail,
}: {
	label: string
	value: number
	icon: React.ReactNode
	color: 'brand' | 'emerald' | 'violet'
	detail?: string
}) {
	const colorClasses = {
		brand: {
			icon: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
			value: 'text-gray-900 dark:text-gray-100',
		},
		emerald: {
			icon: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
			value: 'text-gray-900 dark:text-gray-100',
		},
		violet: {
			icon: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
			value: 'text-gray-900 dark:text-gray-100',
		},
	}

	const c = colorClasses[color]

	return (
		<div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-4 sm:p-5 transition-smooth hover:shadow-sm">
			<div className="flex items-center justify-between mb-3">
				<div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.icon}`}>
					{icon}
				</div>
				{detail && (
					<span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-full px-2 py-0.5">
						{detail}
					</span>
				)}
			</div>
			<p className={`text-2xl sm:text-3xl font-bold ${c.value} tracking-tight`}>
				{value}
			</p>
			<p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
		</div>
	)
}

function FormCard({
	form,
	navigate,
	onDelete,
	onDuplicate,
	onCopyLink,
	onShare,
	isCopied,
	responseCount,
}: {
	form: Record<string, unknown>
	navigate: (path: string) => void
	onDelete: () => void
	onDuplicate: () => void
	onCopyLink: () => void
	onShare: () => void
	isCopied: boolean
	responseCount: number
}) {
	const [menuOpen, setMenuOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)
	const isPublished = String(form.status) === 'published'
	const themeColor = getThemeById(String(form.theme || 'blue')).preview

	let fieldCount = 0
	try {
		fieldCount = JSON.parse(String(form.fields || '[]')).length
	} catch {
		// ignore
	}

	const timeAgo = formatTimeAgo(Number(form.createdAt) || Date.now())

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
		<div
			className="group relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark transition-all duration-200 hover:shadow-md hover:shadow-gray-200/50 dark:hover:shadow-none hover:border-gray-300 dark:hover:border-gray-700 hover:-translate-y-0.5 overflow-hidden"
		>
			{/* Theme color accent bar */}
			<div className="h-1 w-full" style={{ backgroundColor: themeColor }} />

			<div className="p-5">
				{/* Header: status + menu */}
				<div className="flex items-center justify-between mb-3.5">
					<div className="flex items-center gap-2">
						{isPublished ? (
							<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-full px-2.5 py-0.5 uppercase tracking-wide">
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
								Live
							</span>
						) : (
							<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full px-2.5 py-0.5 uppercase tracking-wide">
								<span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
								Draft
							</span>
						)}
					</div>
					<div className="relative" ref={menuRef}>
						<button
							onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
							className="p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth opacity-0 group-hover:opacity-100"
						>
							<MoreHorizontal className="h-4 w-4" />
						</button>
						{menuOpen && (
							<div className="absolute right-0 top-9 w-48 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl shadow-gray-200/30 dark:shadow-none py-1.5 z-10 animate-scale-in">
								<MenuButton
									icon={<Pencil className="h-3.5 w-3.5" />}
									label="Edit form"
									onClick={() => { navigate(`build/${form.id}`); setMenuOpen(false) }}
								/>
								{isPublished && (
									<MenuButton
										icon={<BarChart3 className="h-3.5 w-3.5" />}
										label="View responses"
										onClick={() => { navigate(`responses/${form.id}`); setMenuOpen(false) }}
									/>
								)}
								{isPublished && (
									<MenuButton
										icon={<ExternalLink className="h-3.5 w-3.5" />}
										label="Open form"
										onClick={() => { navigate(`fill/${form.id}`); setMenuOpen(false) }}
									/>
								)}
								{isPublished && (
									<MenuButton
										icon={isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
										label={isCopied ? 'Copied!' : 'Copy link'}
										onClick={() => { onCopyLink(); setMenuOpen(false) }}
									/>
								)}
								{isPublished && (
									<MenuButton
										icon={<Share2 className="h-3.5 w-3.5" />}
										label="Share & embed"
										onClick={() => { onShare(); setMenuOpen(false) }}
									/>
								)}
								<MenuButton
									icon={<CopyPlus className="h-3.5 w-3.5" />}
									label="Duplicate"
									onClick={() => { onDuplicate(); setMenuOpen(false) }}
								/>
								<div className="my-1 mx-3 border-t border-gray-100 dark:border-gray-700" />
								<MenuButton
									icon={<Trash2 className="h-3.5 w-3.5" />}
									label="Delete"
									danger
									onClick={() => { onDelete(); setMenuOpen(false) }}
								/>
							</div>
						)}
					</div>
				</div>

				{/* Title + description */}
				<button
					onClick={() => navigate(`build/${form.id}`)}
					className="block w-full text-left"
				>
					<h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-smooth">
						{String(form.title) || 'Untitled Form'}
					</h3>
					{String(form.description) && (
						<p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-3 leading-relaxed">
							{String(form.description)}
						</p>
					)}
				</button>

				{/* Meta info */}
				<div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500 mb-4">
					<span className="flex items-center gap-1">
						<FileText className="h-3 w-3" />
						{fieldCount} field{fieldCount !== 1 ? 's' : ''}
					</span>
					<span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
					<span className="flex items-center gap-1">
						<Clock className="h-3 w-3" />
						{timeAgo}
					</span>
					{isPublished && responseCount > 0 && (
						<>
							<span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
							<span className="flex items-center gap-1 text-brand-500 dark:text-brand-400 font-medium">
								<BarChart3 className="h-3 w-3" />
								{responseCount} response{responseCount !== 1 ? 's' : ''}
							</span>
						</>
					)}
				</div>

				{/* Action buttons */}
				<div className="flex items-center gap-2">
					<button
						onClick={() => navigate(`build/${form.id}`)}
						className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 transition-smooth hover:bg-gray-100 dark:hover:bg-gray-700"
					>
						<Pencil className="h-3 w-3" />
						Edit
					</button>
					{isPublished ? (
						<>
							<button
								onClick={() => navigate(`responses/${form.id}`)}
								className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 transition-smooth hover:bg-gray-100 dark:hover:bg-gray-700"
							>
								<Eye className="h-3 w-3" />
								Responses
							</button>
							<button
								onClick={() => onShare()}
								className="inline-flex items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20 p-2 text-brand-600 dark:text-brand-400 transition-smooth hover:bg-brand-100 dark:hover:bg-brand-900/30"
								title="Share"
							>
								<Share2 className="h-3.5 w-3.5" />
							</button>
						</>
					) : (
						<button
							onClick={() => navigate(`build/${form.id}`)}
							className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 px-3 py-2 text-xs font-medium text-brand-600 dark:text-brand-400 transition-smooth hover:bg-brand-100 dark:hover:bg-brand-900/30"
						>
							<Send className="h-3 w-3" />
							Publish
						</button>
					)}
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
			className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-smooth ${
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
		<div className="flex flex-col items-center justify-center py-16 sm:py-24 animate-fade-in">
			{/* Illustration */}
			<div className="relative mb-8">
				<div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-900/30 dark:to-brand-900/10 flex items-center justify-center shadow-lg shadow-brand-100/50 dark:shadow-none">
					<FileText className="h-10 w-10 text-brand-500" />
				</div>
				<div className="absolute -top-1 -right-1 w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center shadow-md">
					<Zap className="h-3.5 w-3.5 text-white" />
				</div>
			</div>

			<h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">
				Create your first form
			</h2>
			<p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-8 text-sm leading-relaxed">
				Build beautiful forms that work anywhere — even without internet.
				Responses save locally and sync automatically when you're back online.
			</p>

			<div className="flex flex-col sm:flex-row items-center gap-3">
				<button
					onClick={onCreateClick}
					className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition-smooth hover:bg-brand-500 hover:shadow-lg hover:shadow-brand-600/30 active:scale-[0.98]"
				>
					<Plus className="h-4 w-4" />
					New Form
				</button>
				<button
					onClick={onBrowseTemplates}
					className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 transition-smooth hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.98]"
				>
					<LayoutTemplate className="h-4 w-4" />
					Browse Templates
				</button>
			</div>

			{/* Feature hints */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14 max-w-xl w-full">
				{[
					{ icon: <Zap className="h-4 w-4" />, label: 'Works offline', desc: 'No internet needed' },
					{ icon: <Sparkles className="h-4 w-4" />, label: '17+ templates', desc: 'Ready to customize' },
					{ icon: <TrendingUp className="h-4 w-4" />, label: 'Analytics built-in', desc: 'Charts & insights' },
				].map((feat) => (
					<div key={feat.label} className="text-center p-3">
						<div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-2 text-gray-500 dark:text-gray-400">
							{feat.icon}
						</div>
						<p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{feat.label}</p>
						<p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{feat.desc}</p>
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
		<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
			<div className="w-full max-w-3xl rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-slide-up max-h-[85vh] flex flex-col shadow-2xl">
				{/* Sticky header */}
				<div className="shrink-0 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2.5">
							<div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
								<LayoutTemplate className="h-4 w-4 text-brand-500" />
							</div>
							<h3 className="text-lg font-semibold">Create a form</h3>
						</div>
						<button
							onClick={onClose}
							className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth"
						>
							&times;
						</button>
					</div>

					{/* Blank form CTA + Search row */}
					<div className="flex gap-3">
						<button
							onClick={() => onSelect('blank')}
							className="shrink-0 flex items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-smooth"
						>
							<Plus className="h-4 w-4" />
							Blank form
						</button>
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
							<input
								type="text"
								placeholder="Search templates..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								autoFocus
								className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-smooth"
							/>
						</div>
					</div>
				</div>

				{/* Scrollable body */}
				<div className="flex-1 overflow-y-auto px-6 py-4">
					{filteredCategories.length === 0 ? (
						<div className="text-center py-12">
							<Search className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
							<p className="text-sm text-gray-500 dark:text-gray-400">
								No templates match &ldquo;{search}&rdquo;
							</p>
						</div>
					) : (
						filteredCategories.map((cat) => (
							<div key={cat.label} className="mb-5 last:mb-0">
								<h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
									<span>{CATEGORY_ICONS[cat.label] || '📄'}</span>
									{cat.label}
								</h4>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
									{cat.keys.map((key) => {
										const tmpl = FORM_TEMPLATES[key]
										if (!tmpl) return null
										return (
											<button
												key={key}
												onClick={() => onSelect(key)}
												className="text-left rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 transition-smooth hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 group"
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
													<ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-brand-500 transition-smooth" />
												</div>
											</button>
										)
									})}
								</div>
							</div>
						))
					)}
				</div>

				{/* Sticky footer */}
				<div className="shrink-0 px-6 py-3 border-t border-gray-100 dark:border-gray-800">
					<button
						onClick={onBrowseAll}
						className="w-full text-center text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium py-1 transition-smooth"
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
