import { useQuery, useMutation } from '@korajs/react'
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
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { FORM_TEMPLATES, TEMPLATE_CATEGORIES } from '../templates'
import type { FormField } from '../types'
import { ShareModal } from '../components/shared/ShareModal'
import { Share2, Search } from 'lucide-react'
import { getThemeById } from '../themes'
import { copyToClipboard } from '../utils/clipboard'

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
	const { mutate: deleteForm } = useMutation((id: string) => app.forms.delete(id))
	const { mutate: createForm } = useMutation(
		(data: { title: string; description: string; fields: string; status: string; ownerId: string }) =>
			app.forms.insert(data),
	)
	const { mutate: duplicateForm } = useMutation(
		(data: { title: string; description: string; fields: string; status: string; ownerId: string; theme: string; settings: string }) =>
			app.forms.insert(data),
	)

	const { mutate: updateForm } = useMutation(
		(data: { id: string; settings: string }) =>
			app.forms.update(data.id, { settings: data.settings }),
	)

	const [showTemplates, setShowTemplates] = useState(false)
	const [copiedId, setCopiedId] = useState<string | null>(null)
	const [shareForm, setShareForm] = useState<Record<string, unknown> | null>(null)
	const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all')
	const [searchQuery, setSearchQuery] = useState('')

	const handleArchive = (form: Record<string, unknown>) => {
		const settings = JSON.parse(String(form.settings || '{}'))
		settings.archived = true
		updateForm({ id: String(form.id), settings: JSON.stringify(settings) })
	}

	const handleUnarchive = (form: Record<string, unknown>) => {
		const settings = JSON.parse(String(form.settings || '{}'))
		delete settings.archived
		updateForm({ id: String(form.id), settings: JSON.stringify(settings) })
	}

	const isArchived = (form: Record<string, unknown>) => {
		try {
			return JSON.parse(String(form.settings || '{}')).archived === true
		} catch { return false }
	}

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
			settings: String(form.settings || '{}'),
		})
	}

	const handleCopyLink = (form: Record<string, unknown>) => {
		const identifier = form.slug ? String(form.slug) : String(form.id)
		const link = `${window.location.origin}/f/${identifier}`
		copyToClipboard(link)
		setCopiedId(String(form.id))
		setTimeout(() => setCopiedId(null), 2000)
	}

	const handleExportForm = (form: Record<string, unknown>) => {
		let formFields: FormField[] = []
		let formSettings = {}
		try { formFields = JSON.parse(String(form.fields || '[]')) } catch {}
		try { formSettings = JSON.parse(String(form.settings || '{}')) } catch {}

		const data = {
			koraforms: true,
			version: 1,
			title: String(form.title || 'Untitled Form'),
			description: String(form.description || ''),
			fields: formFields,
			theme: String(form.theme || 'blue'),
			settings: formSettings,
		}
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${String(form.title || 'form').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.koraform.json`
		a.click()
		URL.revokeObjectURL(url)
	}

	const activeForms = allForms.filter(f => !isArchived(f))
	const archivedForms = allForms.filter(f => isArchived(f))
	const published = activeForms.filter((f) => String(f.status) === 'published')
	const drafts = activeForms.filter((f) => String(f.status) !== 'published')

	// Only count responses for the current user's forms
	const userFormIds = new Set(allForms.map((f) => String(f.id)))
	const responseCountMap = new Map<string, number>()
	const newResponseCountMap = new Map<string, number>()
	let totalResponses = 0

	// Track "last seen" per form for new response badges
	const lastSeenKey = 'koraforms-last-seen'
	const lastSeen: Record<string, number> = (() => {
		try { return JSON.parse(localStorage.getItem(lastSeenKey) || '{}') } catch { return {} }
	})()

	for (const r of allResponses) {
		const fid = String(r.formId)
		if (!userFormIds.has(fid)) continue
		responseCountMap.set(fid, (responseCountMap.get(fid) || 0) + 1)
		totalResponses++
		// Count responses newer than last seen
		const ts = Number(r.submittedAt || 0)
		if (ts > (lastSeen[fid] || 0)) {
			newResponseCountMap.set(fid, (newResponseCountMap.get(fid) || 0) + 1)
		}
	}

	// Update last seen timestamps when viewing dashboard
	useEffect(() => {
		const next: Record<string, number> = { ...lastSeen }
		for (const fid of userFormIds) {
			next[fid] = Date.now()
		}
		localStorage.setItem(lastSeenKey, JSON.stringify(next))
	}, [allResponses.length]) // eslint-disable-line react-hooks/exhaustive-deps

	const filteredForms =
		filter === 'published' ? published
		: filter === 'draft' ? drafts
		: filter === 'archived' ? archivedForms
		: activeForms

	// Apply search filter
	const displayForms = searchQuery.trim()
		? filteredForms.filter(f => {
			const q = searchQuery.toLowerCase()
			return String(f.title || '').toLowerCase().includes(q) ||
				String(f.description || '').toLowerCase().includes(q)
		})
		: filteredForms

	return (
		<div className="max-w-6xl mx-auto px-1">
			{/* Header */}
			<div className="flex items-start justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
						Forms
					</h1>
					<p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
						Create, collect and stay productive—even offline.
					</p>
				</div>
				<button
					onClick={() => setShowTemplates(true)}
					className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-brand-500 hover:shadow-md active:scale-[0.97]"
				>
					<Plus className="h-4 w-4" />
					New Form
				</button>
			</div>

			{/* Sync Status Banner */}
			<div className="mb-6 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-5 py-3.5 flex items-center gap-3">
				<span className="relative flex h-2.5 w-2.5 shrink-0">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
					<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
				</span>
				<div className="min-w-0">
					<p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
						Everything is saved on this device
					</p>
					<p className="text-xs text-emerald-600/70 dark:text-emerald-400/50 mt-0.5">
						Changes sync automatically when you're online.
					</p>
				</div>
			</div>

			{/* Section divider */}
			<div className="border-t border-gray-100 dark:border-gray-800/50 mb-6" />

			{/* Stat Cards */}
			{allForms.length > 0 && (
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
					{/* Total Forms */}
					<div className="rounded-2xl bg-white dark:bg-surface-elevated-dark border border-gray-100 dark:border-gray-800/50 shadow-sm p-5 flex items-center gap-4 transition-all duration-200 hover:shadow-md">
						<div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
							<FileText className="h-5 w-5 text-brand-500 dark:text-brand-400" />
						</div>
						<div>
							<p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total forms</p>
							<p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mt-0.5">{allForms.length}</p>
						</div>
					</div>

					{/* Published */}
					<div className="rounded-2xl bg-white dark:bg-surface-elevated-dark border border-gray-100 dark:border-gray-800/50 shadow-sm p-5 flex items-center gap-4 transition-all duration-200 hover:shadow-md">
						<div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
							<Globe className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
						</div>
						<div>
							<p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Published</p>
							<p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mt-0.5">{published.length}</p>
							{published.length > 0 && (
								<p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">{published.length} live and collecting responses</p>
							)}
						</div>
					</div>

					{/* Responses */}
					<div className="rounded-2xl bg-white dark:bg-surface-elevated-dark border border-gray-100 dark:border-gray-800/50 shadow-sm p-5 flex items-center gap-4 transition-all duration-200 hover:shadow-md">
						<div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
							<BarChart3 className="h-5 w-5 text-brand-500 dark:text-brand-400" />
						</div>
						<div>
							<p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Responses</p>
							<p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mt-0.5">{totalResponses}</p>
						</div>
					</div>
				</div>
			)}

			{/* Section divider */}
			{allForms.length > 0 && <div className="border-t border-gray-100 dark:border-gray-800/50 mb-6" />}

			{/* Filter / Search Bar */}
			{allForms.length > 0 && (
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
					<div className="flex items-center gap-3 w-full sm:w-auto">
						{/* Filter pills */}
						<div className="flex items-center bg-gray-100/80 dark:bg-gray-800/60 rounded-xl p-1">
							{(['all', 'published', 'draft', 'archived'] as const).map((f) => (
								<button
									key={f}
									onClick={() => setFilter(f)}
									className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
										filter === f
											? 'bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900 shadow-sm'
											: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
									}`}
								>
									{f === 'all' ? 'All' : f === 'published' ? 'Published' : f === 'draft' ? 'Drafts' : `Archived${archivedForms.length > 0 ? ` (${archivedForms.length})` : ''}`}
								</button>
							))}
						</div>
					</div>

					<div className="flex items-center gap-2 w-full sm:w-auto">
						{/* Search input */}
						<div className="relative flex-1 sm:flex-initial">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
							<input
								type="text"
								placeholder="Search forms..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full sm:w-52 pl-9 pr-4 py-2 rounded-xl bg-gray-100/80 dark:bg-gray-800/60 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 border-0 transition-all duration-200"
							/>
						</div>

						{/* Sort dropdown */}
						<div className="relative">
							<button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100/80 dark:bg-gray-800/60 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200/80 dark:hover:bg-gray-700/60 transition-all duration-200">
								<Clock className="h-3.5 w-3.5" />
								Last edited
								<ChevronDown className="h-3 w-3 opacity-50" />
							</button>
						</div>

						{/* Templates button */}
						<button
							onClick={() => navigate('templates')}
							className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100/80 dark:bg-gray-800/60 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200/80 dark:hover:bg-gray-700/60 transition-all duration-200"
						>
							<LayoutTemplate className="h-3.5 w-3.5" />
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
					onBrowseAll={() => { setShowTemplates(false); navigate('templates') }}
				/>
			)}

			{/* Form grid */}
			{displayForms.length > 0 ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
					{/* Create card */}
					<button
						onClick={() => setShowTemplates(true)}
						className="group rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700/60 bg-white/50 dark:bg-gray-900/30 flex flex-col items-center justify-center gap-3 min-h-[320px] transition-all duration-200 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/30 dark:hover:bg-brand-950/10"
					>
						<div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 group-hover:shadow-md">
							<Plus className="h-6 w-6 text-gray-400 transition-colors duration-200 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
						</div>
						<div className="text-center px-4">
							<p className="text-sm font-semibold text-gray-600 dark:text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors duration-200">Create new form</p>
							<p className="text-xs text-gray-400 dark:text-gray-500 mt-1 leading-relaxed">Start from scratch or choose a template.</p>
						</div>
					</button>

					{displayForms.map((form) => (
						<FormCard
							key={form.id}
							form={form}
							navigate={navigate}
							onDelete={() => deleteForm(form.id)}
							onDuplicate={() => handleDuplicate(form)}
							onCopyLink={() => handleCopyLink(form)}
							onShare={() => setShareForm(form)}
							onExport={() => handleExportForm(form)}
							onArchive={() => handleArchive(form)}
							onUnarchive={() => handleUnarchive(form)}
							isFormArchived={isArchived(form)}
							isCopied={copiedId === form.id}
							responseCount={responseCountMap.get(String(form.id)) || 0}
							newResponseCount={newResponseCountMap.get(String(form.id)) || 0}
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
		<div className="group relative rounded-2xl bg-white dark:bg-surface-elevated-dark border border-gray-100 dark:border-gray-800/60 shadow-sm transition-all duration-200 hover:shadow-lg hover:border-gray-200 dark:hover:border-gray-700 overflow-hidden">
			{/* Colorful gradient header */}
			<div
				className="relative h-[100px] overflow-hidden"
				style={{ background: gradient }}
			>
				{/* Decorative geometric shapes */}
				<div className="absolute inset-0 opacity-20">
					<div className="absolute -top-6 -right-6 w-24 h-24 rounded-full border-[3px] border-white/40" />
					<div className="absolute bottom-2 left-4 w-16 h-16 rounded-xl border-[2px] border-white/30 rotate-12" />
					<div className="absolute top-3 left-1/2 w-8 h-8 rounded-full bg-white/20" />
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
						className="p-1.5 rounded-lg bg-black/20 text-white/80 hover:bg-black/30 hover:text-white backdrop-blur-sm transition-all duration-200 opacity-0 group-hover:opacity-100"
					>
						<MoreHorizontal className="h-4 w-4" />
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
			<div className="relative px-5 pb-5 pt-4">
				{/* Status badge - overlapping the gradient/content junction */}
				<div className="absolute -top-3 left-5">
					{isPublished ? (
						<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500 text-white shadow-sm">
							<span className="w-1.5 h-1.5 rounded-full bg-white/80" />
							Published
						</span>
					) : (
						<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shadow-sm border border-gray-200/50 dark:border-gray-600/50">
							<span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
							Draft
						</span>
					)}
				</div>

				{/* Title & description */}
				<button
					onClick={() => navigate(`build/${form.id}`)}
					className="block w-full text-left mt-3 group/title"
				>
					<h3 className="font-semibold text-[15px] text-gray-900 dark:text-gray-100 truncate transition-colors duration-200 group-hover/title:text-brand-600 dark:group-hover/title:text-brand-400">
						{String(form.title) || 'Untitled Form'}
					</h3>
					{String(form.description) && (
						<p className="text-sm text-gray-400 dark:text-gray-500 truncate leading-relaxed mt-0.5">
							{String(form.description)}
						</p>
					)}
				</button>

				{/* Stats row */}
				<div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500 mt-3 mb-4">
					<span>{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>
					<span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
					<span>{timeAgo}</span>
					{isPublished && responseCount > 0 && (
						<>
							<span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
							<span className="text-brand-500 dark:text-brand-400 font-medium">
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

				{/* Action buttons */}
				<div className="flex items-center border-t border-gray-100 dark:border-gray-800/60 pt-3 -mx-5 px-5">
					<button
						onClick={() => navigate(`build/${form.id}`)}
						className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 transition-all duration-200 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
					>
						<Pencil className="h-3.5 w-3.5" />
						Edit
					</button>
					<div className="w-px h-5 bg-gray-100 dark:bg-gray-800/60" />
					<button
						onClick={() => isPublished ? navigate(`responses/${form.id}`) : navigate(`build/${form.id}`)}
						className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 transition-all duration-200 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
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
					{ icon: <Sparkles className="h-4 w-4" />, label: '17+ templates' },
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
