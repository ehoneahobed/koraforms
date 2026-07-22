import { useState, useEffect } from 'react'
import { FileText, Search, ArrowRight, ChevronLeft, Sparkles, Plus, LayoutTemplate, Eye, X, Check, ExternalLink } from 'lucide-react'
import { FORM_TEMPLATES, TEMPLATE_CATEGORIES, getTemplateMetadata, getTemplateSearchText } from '../templates'
import { setPageMeta } from '../utils/meta'

interface TemplatesProps {
	navigate: (path: string) => void
	userId?: string
	isPublic?: boolean
}

const CATEGORY_ICONS: Record<string, string> = {
	'Church & Religious': 'Church',
	'Events & Registration': 'Events',
	'Feedback & Surveys': 'Feedback',
	'Business & HR': 'Business',
	'Education': 'Education',
	'Data Collection': 'Data',
}

export function Templates({ navigate, userId, isPublic }: TemplatesProps) {
	useEffect(() => {
		setPageMeta({
			title: 'Form Templates — Free Templates for Every Use Case | KoraForms',
			description: 'Browse free form templates for churches, events, surveys, education, HR, and more. Customize every template in KoraForms.',
		})
	}, [])

	const [search, setSearch] = useState('')
	const [activeCategory, setActiveCategory] = useState<string | null>(null)
	const [previewTemplate, setPreviewTemplate] = useState<string | null>(null)

	const query = search.toLowerCase().trim()

	// Deduplicate keys across categories
	const seen = new Set<string>()
	const filteredCategories = TEMPLATE_CATEGORIES
		.map((cat) => {
			const keys = cat.keys.filter((key) => {
				if (seen.has(key)) return false
				seen.add(key)
				const tmpl = FORM_TEMPLATES[key]
				if (!tmpl) return false
				if (query) {
					return getTemplateSearchText(key).includes(query)
				}
				if (activeCategory) return cat.label === activeCategory
				return true
			})
			return { ...cat, keys }
		})
		.filter((cat) => cat.keys.length > 0)

	const totalTemplates = filteredCategories.reduce((sum, cat) => sum + cat.keys.length, 0)

	return (
		<div>
			{/* Public nav bar */}
			{isPublic && (
				<nav className="flex items-center justify-between mb-6">
					<button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-smooth">
						<img src="/logo-icon.png" alt="KoraForms" className="w-7 h-7 rounded-lg" />
						<span className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">KoraForms</span>
					</button>
					<div className="flex items-center gap-2">
						{userId ? (
							<button onClick={() => navigate('dashboard')} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-smooth hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
								Dashboard
							</button>
						) : (
							<>
								<button onClick={() => navigate('signin')} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 transition-smooth">
									Sign in
								</button>
								<button onClick={() => navigate('signup')} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-smooth hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
									Get started
								</button>
							</>
						)}
					</div>
				</nav>
			)}

			{/* Hero header */}
			<div className="mb-8 border-b border-slate-200 pb-10 dark:border-gray-800">
				<div>
					{!isPublic && (
						<button
							onClick={() => navigate('dashboard')}
							className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-gray-500 dark:hover:text-gray-200 transition-smooth"
						>
							<ChevronLeft className="h-4 w-4" />
							Back to dashboard
						</button>
					)}

					<div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-gray-950 dark:text-gray-300 dark:ring-gray-800">
						<Sparkles className="h-3.5 w-3.5" />
						{totalTemplates} templates
					</div>
					<h1 className="max-w-3xl text-4xl font-bold tracking-[-0.03em] text-slate-950 dark:text-white sm:text-6xl">
						Start with the right structure.
					</h1>
					<p className="mt-4 max-w-2xl text-[17px] leading-8 text-slate-500 dark:text-gray-400">
						Explore field-tested templates for registration, feedback, operations, education, and community workflows. Each template can become a fully editable KoraForms form.
					</p>

					{/* Search */}
					<div className="mt-8 relative max-w-2xl">
						<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
						<input
							type="text"
							placeholder="Search templates..."
							value={search}
							onChange={(e) => {
								setSearch(e.target.value)
								setActiveCategory(null)
							}}
							className="h-13 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-[15px] text-slate-900 shadow-sm outline-none transition-smooth placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:focus:ring-gray-800/70"
						/>
					</div>
				</div>
			</div>

			{/* Category pills */}
			<div className="flex flex-wrap gap-2 mb-8">
				<button
					onClick={() => { setActiveCategory(null); setSearch('') }}
					className={`px-4 py-2 rounded-xl text-sm font-medium transition-smooth ${
						!activeCategory && !query
							? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950'
							: 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-800'
					}`}
				>
					All
				</button>
				{TEMPLATE_CATEGORIES.map((cat) => (
					<button
						key={cat.label}
						onClick={() => { setActiveCategory(cat.label); setSearch('') }}
						className={`px-4 py-2 rounded-xl text-sm font-medium transition-smooth ${
							activeCategory === cat.label
								? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950'
								: 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-800'
						}`}
					>
						{CATEGORY_ICONS[cat.label] || cat.label}
					</button>
				))}
			</div>

			{/* Template grid */}
			{filteredCategories.length === 0 ? (
				<div className="text-center py-20 animate-fade-in">
					<div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
						<Search className="h-7 w-7 text-gray-300 dark:text-gray-600" />
					</div>
					<p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
						No templates match &ldquo;{search}&rdquo;
					</p>
					<p className="text-xs text-gray-400 dark:text-gray-500">
						Try a different search term or browse all categories
					</p>
				</div>
			) : (
				filteredCategories.map((cat) => (
					<div key={cat.label} className="mb-10">
						<div className="flex items-center gap-2.5 mb-4">
							<h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
								{cat.label}
							</h2>
							<span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">
								{cat.keys.length}
							</span>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{cat.keys.map((key) => {
								const tmpl = FORM_TEMPLATES[key]
								if (!tmpl) return null
								return (
									<TemplateCard
										key={key}
										templateKey={key}
										title={tmpl.title}
										description={tmpl.description}
										fieldCount={tmpl.fields.length}
										category={cat.label}
										onPreview={setPreviewTemplate}
									/>
								)
							})}
						</div>
					</div>
				))
			)}

			{/* Blank form CTA */}
			<div className="mt-8 mb-4 relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 sm:p-10 text-center">
				<div className="relative">
					<div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
						<LayoutTemplate className="h-6 w-6 text-gray-400 dark:text-gray-500" />
					</div>
					<p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
						Start from scratch
					</p>
					<p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">
						Build a completely custom form with our drag-and-drop editor.
					</p>
					<button
						onClick={() => navigate(userId ? '/forms/new/edit' : '/signup')}
						className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition-smooth hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
					>
						<Plus className="h-4 w-4" />
						{userId ? 'Create blank form' : 'Sign up to create forms'}
					</button>
				</div>
			</div>

			{previewTemplate && (
				<TemplatePreviewModal
					templateKey={previewTemplate}
					onClose={() => setPreviewTemplate(null)}
					onUse={(key) => navigate(userId ? `/forms/new/edit?template=${key}` : `/signup?template=${key}`)}
					onViewDetails={(key) => {
						setPreviewTemplate(null)
						navigate(`/templates/${key}`)
					}}
					isAuthenticated={!!userId}
				/>
			)}
		</div>
	)
}

function TemplateCard({
	templateKey,
	title,
	description,
	fieldCount,
	category,
	onPreview,
}: {
	templateKey: string
	title: string
	description: string
	fieldCount: number
	category: string
	onPreview: (templateKey: string) => void
}) {
	const metadata = getTemplateMetadata(templateKey)
	return (
		<button
			onClick={() => onPreview(templateKey)}
			className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-200/60 dark:border-gray-800 dark:bg-surface-elevated-dark dark:hover:border-gray-700 dark:hover:shadow-none"
		>
			<div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 dark:border-gray-900 dark:bg-gray-900/45">
				<div className="flex items-start justify-between gap-4">
					<span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-gray-950 dark:text-gray-400 dark:ring-gray-800">
						{category}
					</span>
					<Eye className="h-4 w-4 text-gray-300 transition-all duration-200 group-hover:text-slate-500 dark:text-gray-700 dark:group-hover:text-gray-400" />
				</div>
				<div className="mt-5 space-y-2">
					<div className="h-2 w-24 rounded-full bg-slate-200/80 dark:bg-gray-800" />
					<div className="h-2 w-36 rounded-full bg-slate-200/60 dark:bg-gray-800/70" />
				</div>
			</div>
			<div className="p-5">
				<h3 className="line-clamp-1 text-[15px] font-semibold text-gray-900 transition-smooth group-hover:text-slate-700 dark:text-white dark:group-hover:text-gray-200">
					{title}
				</h3>
				<p className="mb-4 mt-1 min-h-[38px] line-clamp-2 text-[13px] leading-5 text-gray-500 dark:text-gray-400">
					{description}
				</p>
				<div className="flex items-center justify-between gap-3">
					<span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-full px-2 py-0.5">
						{fieldCount} field{fieldCount !== 1 ? 's' : ''}
					</span>
					{metadata && (
						<span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-full px-2 py-0.5">
							{metadata.estimatedMinutes} min
						</span>
					)}
				</div>
			</div>
		</button>
	)
}

const FIELD_TYPE_DISPLAY: Record<string, { label: string; color: string }> = {
	text: { label: 'Short Text', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
	textarea: { label: 'Long Text', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
	email: { label: 'Email', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
	phone: { label: 'Phone', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
	number: { label: 'Number', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
	date: { label: 'Date', color: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
	select: { label: 'Dropdown', color: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' },
	radio: { label: 'Multiple Choice', color: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' },
	checkbox: { label: 'Checkboxes', color: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' },
	rating: { label: 'Rating', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
	scale: { label: 'Scale', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
	yesno: { label: 'Yes/No', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
	signature: { label: 'Signature', color: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
	file: { label: 'File Upload', color: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
	ranking: { label: 'Ranking', color: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
	matrix: { label: 'Matrix', color: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
}

function TemplatePreviewModal({
	templateKey,
	onClose,
	onUse,
	onViewDetails,
	isAuthenticated,
}: {
	templateKey: string
	onClose: () => void
	onUse: (key: string) => void
	onViewDetails: (key: string) => void
	isAuthenticated?: boolean
}) {
	const template = FORM_TEMPLATES[templateKey]

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [onClose])

	if (!template) return null

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
			onClick={onClose}
		>
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

			{/* Modal card */}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="template-preview-title"
				className="relative w-full max-w-xl bg-white dark:bg-surface-elevated-dark rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Color accent */}
				{/* Header */}
				<div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
					<div className="flex items-start justify-between">
						<div className="flex-1 min-w-0 pr-4">
							<h2 id="template-preview-title" className="text-lg font-bold text-gray-900 dark:text-white tracking-tight mb-1">
								{template.title}
							</h2>
							<p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
								{template.description}
							</p>
						</div>
						<button
							onClick={onClose}
							className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth"
							aria-label="Close preview"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>

				{/* Field list */}
				<div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
					<div className="flex items-center justify-between mb-3">
						<span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
							Fields
						</span>
						<span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-full px-2 py-0.5">
							{template.fields.length} field{template.fields.length !== 1 ? 's' : ''}
						</span>
					</div>

					<div className="space-y-2">
						{template.fields.map((field) => {
							const display = FIELD_TYPE_DISPLAY[field.type] || {
								label: field.type,
								color: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
							}
							return (
								<div
									key={field.id}
									className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 transition-smooth"
								>
									<span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 flex-shrink-0 ${display.color}`}>
										{display.label}
									</span>
									<span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
										{field.label}
									</span>
									{field.required && (
										<span className="text-red-500 text-sm font-bold flex-shrink-0" title="Required">*</span>
									)}
								</div>
							)
						})}
					</div>
				</div>

				{/* Footer */}
				<div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
					<button
						onClick={() => onViewDetails(templateKey)}
						className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-smooth hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200"
					>
						<ExternalLink className="h-3.5 w-3.5" />
						View full details
					</button>
					<div className="flex items-center gap-3">
						<button
							onClick={onClose}
							className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-smooth"
						>
							Close
						</button>
						<button
							onClick={() => onUse(templateKey)}
							className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition-smooth hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
						>
							<Check className="h-4 w-4" />
							{isAuthenticated ? 'Use this template' : 'Sign up to use'}
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
