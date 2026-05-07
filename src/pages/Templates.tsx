import { useState } from 'react'
import { FileText, Search, ArrowRight, ChevronLeft, Sparkles, Plus, LayoutTemplate } from 'lucide-react'
import { FORM_TEMPLATES, TEMPLATE_CATEGORIES } from '../templates'

interface TemplatesProps {
	navigate: (path: string) => void
	userId: string
}

const CATEGORY_ICONS: Record<string, string> = {
	'Church & Religious': '⛪',
	'Events & Registration': '🎫',
	'Feedback & Surveys': '📊',
	'Business & HR': '💼',
	'Education': '🎓',
	'Data Collection': '📋',
}

export function Templates({ navigate, userId }: TemplatesProps) {
	const [search, setSearch] = useState('')
	const [activeCategory, setActiveCategory] = useState<string | null>(null)

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
			{/* Hero header */}
			<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-brand-600 to-brand-700 p-6 sm:p-8 mb-8 shadow-lg shadow-brand-600/10">
				<div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
				<div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

				<div className="relative">
					<button
						onClick={() => navigate('dashboard')}
						className="inline-flex items-center gap-1.5 text-sm text-brand-200 hover:text-white mb-5 transition-smooth"
					>
						<ChevronLeft className="h-4 w-4" />
						Back to dashboard
					</button>

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
										navigate={navigate}
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
						onClick={() => navigate('/forms/new/edit')}
						className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-500 transition-smooth shadow-sm shadow-brand-600/25 active:scale-[0.98]"
					>
						<Plus className="h-4 w-4" />
						Create blank form
					</button>
				</div>
			</div>
		</div>
	)
}

function TemplateCard({
	templateKey,
	title,
	description,
	fieldCount,
	navigate,
}: {
	templateKey: string
	title: string
	description: string
	fieldCount: number
	navigate: (path: string) => void
}) {
	return (
		<button
			onClick={() => navigate(`/forms/new/edit?template=${templateKey}`)}
			className="group text-left rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark overflow-hidden transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-lg hover:shadow-gray-100/50 dark:hover:shadow-none hover:-translate-y-0.5"
		>
			{/* Color accent */}
			<div className="h-1 w-full bg-gradient-to-r from-brand-400 to-violet-400 opacity-60 group-hover:opacity-100 transition-smooth" />

			<div className="p-5">
				<div className="flex items-start justify-between mb-3">
					<div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center transition-smooth group-hover:scale-110">
						<FileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
					</div>
					<ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all duration-200" />
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
