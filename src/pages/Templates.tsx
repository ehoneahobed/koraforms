import { useState, useEffect } from 'react'
import { FileText, Search, ArrowRight, ChevronLeft, Sparkles, Plus, LayoutTemplate, Eye, X, Check, ExternalLink } from 'lucide-react'
import { FORM_TEMPLATES, TEMPLATE_CATEGORIES } from '../templates'
import { setPageMeta } from '../utils/meta'

interface TemplatesProps {
	navigate: (path: string) => void
	userId?: string
	isPublic?: boolean
}

const CATEGORY_ICONS: Record<string, string> = {
	'Church & Religious': '⛪',
	'Events & Registration': '🎫',
	'Feedback & Surveys': '📊',
	'Business & HR': '💼',
	'Education': '🎓',
	'Data Collection': '📋',
}

export function Templates({ navigate, userId, isPublic }: TemplatesProps) {
	useEffect(() => {
		setPageMeta({
			title: 'Form Templates — Free Templates for Every Use Case | KoraForms',
			description: 'Browse 21+ free form templates for churches, events, surveys, education, and more. Works offline.',
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
					return (
						tmpl.title.toLowerCase().includes(query) ||
						tmpl.description.toLowerCase().includes(query) ||
						cat.label.toLowerCase().includes(query)
					)
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
							<button onClick={() => navigate('dashboard')} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 transition-smooth shadow-sm shadow-brand-600/25">
								Dashboard
							</button>
						) : (
							<>
								<button onClick={() => navigate('signin')} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 transition-smooth">
									Sign in
								</button>
								<button onClick={() => navigate('signup')} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 transition-smooth shadow-sm shadow-brand-600/25">
									Get started
								</button>
							</>
						)}
					</div>
				</nav>
			)}

			{/* Hero header */}
			<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-brand-600 to-brand-700 p-6 sm:p-8 mb-8 shadow-lg shadow-brand-600/10">
				<div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
				<div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

				<div className="relative">
					{!isPublic && (
						<button
							onClick={() => navigate('dashboard')}
							className="inline-flex items-center gap-1.5 text-sm text-brand-200 hover:text-white mb-5 transition-smooth"
						>
							<ChevronLeft className="h-4 w-4" />
							Back to dashboard
						</button>
					)}

					<div className="flex items-center gap-2 mb-2">
						<Sparkles className="h-4 w-4 text-brand-200" />
						<span className="text-xs font-semibold text-brand-200 tracking-wide uppercase">{totalTemplates} Templates</span>
					</div>
					<h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
						Form Templates
					</h1>
					<p className="text-brand-200 max-w-lg text-sm sm:text-base">
						Start with a pre-built template and customize it to your needs. All templates work offline.
					</p>

					{/* Search */}
					<div className="mt-5 relative max-w-md">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-300" />
						<input
							type="text"
							placeholder="Search templates..."
							value={search}
							onChange={(e) => {
								setSearch(e.target.value)
								setActiveCategory(null)
							}}
							className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/20 bg-white/10 text-sm text-white placeholder-brand-300 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 transition-smooth backdrop-blur-sm"
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
							? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
							: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
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
								? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
								: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
						}`}
					>
						{CATEGORY_ICONS[cat.label] || '📄'} {cat.label}
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
							<span className="text-xl">{CATEGORY_ICONS[cat.label] || '📄'}</span>
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
						onClick={() => navigate(userId ? '/forms/new/edit' : 'signup')}
						className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-500 transition-smooth shadow-sm shadow-brand-600/25 active:scale-[0.98]"
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
					onUse={(key) => navigate(userId ? `/forms/new/edit?template=${key}` : 'signup')}
					onViewDetails={(key) => navigate(`/templates/${key}`)}
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
	onPreview,
}: {
	templateKey: string
	title: string
	description: string
	fieldCount: number
	onPreview: (templateKey: string) => void
}) {
	return (
		<button
			onClick={() => onPreview(templateKey)}
			className="group text-left rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark overflow-hidden transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-lg hover:shadow-gray-100/50 dark:hover:shadow-none hover:-translate-y-0.5"
		>
			{/* Color accent */}
			<div className="h-1 w-full bg-gradient-to-r from-brand-400 to-violet-400 opacity-60 group-hover:opacity-100 transition-smooth" />

			<div className="p-5">
				<div className="flex items-start justify-between mb-3">
					<div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center transition-smooth group-hover:scale-110">
						<FileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
					</div>
					<Eye className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-brand-500 transition-all duration-200" />
				</div>
				<h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-smooth">
					{title}
				</h3>
				<p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 leading-relaxed">
					{description}
				</p>
				<span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-full px-2 py-0.5">
					{fieldCount} field{fieldCount !== 1 ? 's' : ''}
				</span>
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
				className="relative w-full max-w-xl bg-white dark:bg-surface-elevated-dark rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Color accent */}
				<div className="h-1.5 w-full bg-gradient-to-r from-brand-400 to-violet-400" />

				{/* Header */}
				<div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
					<div className="flex items-start justify-between">
						<div className="flex-1 min-w-0 pr-4">
							<h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight mb-1">
								{template.title}
							</h2>
							<p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
								{template.description}
							</p>
						</div>
						<button
							onClick={onClose}
							className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth"
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
						className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300 transition-smooth"
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
							className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-500 transition-smooth shadow-sm shadow-brand-600/25 active:scale-[0.98]"
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
