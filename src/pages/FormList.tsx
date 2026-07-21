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

	return (
		<div className="max-w-5xl mx-auto">
			{/* Header */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
						Forms
					</h1>
					{allForms.length > 0 && (
						<p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
							{allForms.length} form{allForms.length !== 1 ? 's' : ''} &middot; {totalResponses} response{totalResponses !== 1 ? 's' : ''}
						</p>
					)}
				</div>
				<button
					onClick={() => setShowTemplates(true)}
					className="inline-flex items-center gap-2 rounded-full bg-brand-600 pl-4 pr-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-brand-500 hover:shadow-md active:scale-[0.97]"
				>
					<Plus className="h-4 w-4" />
					New Form
				</button>
			</div>

			{/* Stats */}
			{allForms.length > 0 && (
				<div className="rounded-2xl bg-white dark:bg-surface-elevated-dark border border-gray-100 dark:border-gray-800/60 shadow-sm mb-8">
					<div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800/60">
						<StatCell label="Total" value={allForms.length} />
						<StatCell label="Published" value={published.length} accent />
						<StatCell label="Responses" value={totalResponses} />
					</div>
				</div>
			)}

			{/* Filters */}
			{allForms.length > 0 && (
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center bg-gray-100/80 dark:bg-gray-800/60 rounded-full p-0.5">
						{(['all', 'published', 'draft', 'archived'] as const).map((f) => (
							<button
								key={f}
								onClick={() => setFilter(f)}
								className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
									filter === f
										? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
										: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
								}`}
							>
								{f === 'all' ? 'All' : f === 'published' ? 'Live' : f === 'draft' ? 'Drafts' : `Archived${archivedForms.length > 0 ? ` (${archivedForms.length})` : ''}`}
							</button>
						))}
					</div>
					<button
						onClick={() => navigate('templates')}
						className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-all duration-200"
					>
						<LayoutTemplate className="h-3.5 w-3.5" />
						Templates
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
					{/* Create card */}
					<button
						onClick={() => setShowTemplates(true)}
						className="group rounded-2xl bg-gray-50/80 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800/40 p-6 flex flex-col items-center justify-center gap-3 min-h-[220px] transition-all duration-200 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 hover:border-brand-200 dark:hover:border-brand-800/40"
					>
						<div className="w-11 h-11 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm transition-all duration-200 group-hover:scale-110 group-hover:shadow-md group-hover:bg-brand-50 dark:group-hover:bg-brand-900/30">
							<Plus className="h-5 w-5 text-gray-400 transition-colors duration-200 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
						</div>
						<div className="text-center">
							<p className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors duration-200">Create new form</p>
							<p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">From template or scratch</p>
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
						No {filter === 'published' ? 'published' : 'draft'} forms.
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

function StatCell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
	return (
		<div className="px-5 py-4 sm:px-6 sm:py-5 text-center">
			<p className={`text-2xl sm:text-3xl font-bold tracking-tight ${accent ? 'text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100'}`}>
				{value}
			</p>
			<p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5 uppercase tracking-wider">{label}</p>
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
		<div className="group relative rounded-2xl bg-white dark:bg-surface-elevated-dark border border-gray-100 dark:border-gray-800/60 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 overflow-hidden">
			{/* Theme accent — subtle left edge */}
			<div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-200" style={{ backgroundColor: themeColor }} />

			<div className="p-5 pl-5">
				{/* Status + menu row */}
				<div className="flex items-center justify-between mb-3">
					{isPublished ? (
						<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
							<span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
							Live
						</span>
					) : (
						<span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
							<span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
							Draft
						</span>
					)}
					<div className="relative" ref={menuRef}>
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
							className="p-1.5 -mr-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 opacity-0 group-hover:opacity-100"
						>
							<MoreHorizontal className="h-4 w-4" />
						</button>
						{menuOpen && (
							<div className={`absolute right-0 w-48 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl py-1 z-10 animate-scale-in ${menuAbove ? 'bottom-9' : 'top-9'}`}>
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

				{/* Title */}
				<button
					onClick={() => navigate(`build/${form.id}`)}
					className="block w-full text-left group/title"
				>
					<h3 className="font-semibold text-[15px] text-gray-900 dark:text-gray-100 mb-1 truncate transition-colors duration-200 group-hover/title:text-brand-600 dark:group-hover/title:text-brand-400">
						{String(form.title) || 'Untitled Form'}
					</h3>
					{String(form.description) && (
						<p className="text-sm text-gray-400 dark:text-gray-500 truncate leading-relaxed">
							{String(form.description)}
						</p>
					)}
				</button>

				{/* Meta */}
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

				{/* Actions */}
				<div className="flex items-center gap-2">
					<button
						onClick={() => navigate(`build/${form.id}`)}
						className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
					>
						<Pencil className="h-3 w-3" />
						Edit
					</button>
					{isPublished ? (
						<>
							<button
								onClick={() => navigate(`responses/${form.id}`)}
								className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
							>
								<Eye className="h-3 w-3" />
								Responses
							</button>
							<button
								onClick={() => onShare()}
								className="inline-flex items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20 p-2 text-brand-600 dark:text-brand-400 transition-all duration-200 hover:bg-brand-100 dark:hover:bg-brand-900/30"
								title="Share"
							>
								<Share2 className="h-3.5 w-3.5" />
							</button>
						</>
					) : (
						<button
							onClick={() => navigate(`build/${form.id}`)}
							className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 px-3 py-2 text-xs font-medium text-brand-600 dark:text-brand-400 transition-all duration-200 hover:bg-brand-100 dark:hover:bg-brand-900/30"
						>
							<Send className="h-3 w-3" />
							Continue editing
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
					className="inline-flex items-center gap-2 rounded-full bg-brand-600 pl-5 pr-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-brand-500 hover:shadow-md active:scale-[0.97]"
				>
					<Plus className="h-4 w-4" />
					New Form
				</button>
				<button
					onClick={onBrowseTemplates}
					className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-5 pr-6 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.97]"
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
