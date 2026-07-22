import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
	ArrowRight,
	Check,
	ChevronLeft,
	ChevronRight,
	Eye,
	FileText,
	LayoutTemplate,
	Search,
	Sparkles,
	Star,
	X,
} from 'lucide-react'
import {
	FORM_TEMPLATES,
	TEMPLATE_CATEGORIES,
	getTemplateKeys,
	getTemplateMetadata,
	getTemplateSearchText,
} from '../templates'
import { setPageMeta } from '../utils/meta'
import { readJsonFromStorage, writeJsonToStorage } from '../utils/storage'

interface TemplateLibraryProps {
	navigate: (path: string) => void
}

const CATEGORY_ICONS: Record<string, string> = {
	'Church & Religious': 'Church',
	'Events & Registration': 'Events',
	'Feedback & Surveys': 'Feedback',
	'Business & HR': 'Business',
	'Education': 'Education',
	'Data Collection': 'Data',
}

const TEMPLATES_PER_PAGE = 9

export function TemplateLibrary({ navigate }: TemplateLibraryProps) {
	const [query, setQuery] = useState('')
	const [category, setCategory] = useState<string>('All')
	const [page, setPage] = useState(1)
	const [previewKey, setPreviewKey] = useState<string | null>(null)
	const [favoriteKeys, setFavoriteKeys] = useState<string[]>(() => {
		const parsed = readJsonFromStorage<unknown>('koraforms-template-favorites', [])
		return Array.isArray(parsed) ? parsed.map(String) : []
	})

	useEffect(() => {
		setPageMeta({
			title: 'Templates - KoraForms',
			description: 'Choose a template and start a new form in your workspace.',
		})
	}, [])

	useEffect(() => {
		writeJsonToStorage('koraforms-template-favorites', favoriteKeys)
	}, [favoriteKeys])

	const normalizedQuery = query.trim().toLowerCase()
	const allKeys = useMemo(() => getTemplateKeys(), [])
	const visibleKeys = allKeys.filter((key) => {
		const metadata = getTemplateMetadata(key)
		if (!metadata) return false
		if (category === 'Favorites' && !favoriteKeys.includes(key)) return false
		if (category !== 'All' && category !== 'Favorites' && metadata.category !== category) return false
		if (!normalizedQuery) return true
		return getTemplateSearchText(key).includes(normalizedQuery)
	})
	const totalPages = Math.max(1, Math.ceil(visibleKeys.length / TEMPLATES_PER_PAGE))
	const currentPage = Math.min(page, totalPages)
	const pageStart = (currentPage - 1) * TEMPLATES_PER_PAGE
	const pageEnd = Math.min(pageStart + TEMPLATES_PER_PAGE, visibleKeys.length)
	const paginatedKeys = visibleKeys.slice(pageStart, pageEnd)

	const recommendedKeys = favoriteKeys.length > 0
		? favoriteKeys.filter(key => FORM_TEMPLATES[key]).slice(0, 3)
		: ['rsvp', 'customer-satisfaction', 'contact-form'].filter(key => FORM_TEMPLATES[key])

	const startTemplate = (key: string) => {
		navigate(`/forms/new/edit?template=${key}`)
	}

	const toggleFavorite = (key: string) => {
		setFavoriteKeys((current) =>
			current.includes(key) ? current.filter(item => item !== key) : [key, ...current]
		)
	}

	useEffect(() => {
		setPage(1)
	}, [query, category])

	return (
		<div className="min-w-0 space-y-8">
			<header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<button
						onClick={() => navigate('dashboard')}
						className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-gray-500 dark:hover:text-gray-200"
					>
						<ChevronLeft className="h-4 w-4" />
						Back to forms
					</button>
					<div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-gray-950 dark:text-gray-300 dark:ring-gray-800">
						<Sparkles className="h-3.5 w-3.5" />
						Template library
					</div>
					<h1 className="text-[34px] font-bold leading-tight tracking-tight text-slate-950 dark:text-white">
						Start with structure.
					</h1>
					<p className="mt-2 max-w-xl text-[15px] leading-6 text-slate-500 dark:text-gray-400">
						Choose a proven starting point, then shape it in the builder. Templates are copied into your workspace, so edits never affect the original.
					</p>
				</div>
				<button
					onClick={() => navigate('/forms/new/edit')}
					className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[14px] font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
				>
					<LayoutTemplate className="h-4 w-4" />
					Blank form
				</button>
			</header>

			{recommendedKeys.length > 0 && (
				<section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
					{recommendedKeys.map((key) => {
						const template = FORM_TEMPLATES[key]
						const metadata = getTemplateMetadata(key)
						if (!template || !metadata) return null
						return (
							<button
								key={key}
								onClick={() => startTemplate(key)}
								className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-200/60 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700 dark:hover:shadow-none"
							>
								<div className="mb-5 flex items-center justify-between">
									<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-gray-900 dark:text-gray-400">
										{metadata.category}
									</span>
									<ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
								</div>
								<h2 className="text-[17px] font-semibold text-slate-950 dark:text-white">{template.title}</h2>
								<p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-500 dark:text-gray-400">{template.description}</p>
							</button>
						)
					})}
				</section>
			)}

			<section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="relative min-w-0 flex-1">
						<Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
						<input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search templates by workflow, audience, or field..."
							className="h-12 w-full rounded-xl border border-transparent bg-slate-50 pl-11 pr-4 text-[14px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-200 focus:bg-white focus:ring-2 focus:ring-brand-500/10 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-brand-800 dark:focus:bg-gray-950"
						/>
					</div>
					<div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1 dark:bg-gray-900">
						{['All', 'Favorites', ...TEMPLATE_CATEGORIES.map(item => item.label)].map((item) => (
							<button
								key={item}
								onClick={() => setCategory(item)}
								className={`whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
									category === item
										? 'bg-white text-slate-950 shadow-sm dark:bg-gray-800 dark:text-white'
										: 'text-slate-500 hover:text-slate-900 dark:text-gray-500 dark:hover:text-gray-200'
								}`}
							>
								{item === 'Favorites' ? 'Favorites' : CATEGORY_ICONS[item] || item}
							</button>
						))}
					</div>
				</div>
			</section>

			<section>
				<div className="mb-4 flex items-center justify-between">
					<div>
						<h2 className="text-[17px] font-semibold text-slate-950 dark:text-white">
							{category === 'All' ? 'All templates' : category}
						</h2>
						<p className="text-[13px] text-slate-500 dark:text-gray-500">
							{visibleKeys.length === 0
								? 'No templates available'
								: `${pageStart + 1}-${pageEnd} of ${visibleKeys.length} templates`}
						</p>
					</div>
				</div>

				{visibleKeys.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-950">
						<FileText className="mx-auto h-8 w-8 text-slate-300 dark:text-gray-700" />
						<p className="mt-3 text-[14px] font-semibold text-slate-700 dark:text-gray-300">No templates found</p>
						<p className="mt-1 text-[13px] text-slate-400 dark:text-gray-500">Try another search or category.</p>
					</div>
				) : (
					<>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
							{paginatedKeys.map((key) => (
								<PrivateTemplateCard
									key={key}
									templateKey={key}
									isFavorite={favoriteKeys.includes(key)}
									onFavorite={() => toggleFavorite(key)}
									onUse={() => startTemplate(key)}
									onDetails={() => setPreviewKey(key)}
								/>
							))}
						</div>
						<TemplatePagination
							page={currentPage}
							totalPages={totalPages}
							totalItems={visibleKeys.length}
							start={pageStart + 1}
							end={pageEnd}
							onPageChange={setPage}
						/>
					</>
				)}
			</section>
			{previewKey && (
				<PrivateTemplatePreview
					templateKey={previewKey}
					onClose={() => setPreviewKey(null)}
					onUse={() => startTemplate(previewKey)}
				/>
			)}
		</div>
	)
}

function PrivateTemplateCard({
	templateKey,
	isFavorite,
	onFavorite,
	onUse,
	onDetails,
}: {
	templateKey: string
	isFavorite: boolean
	onFavorite: () => void
	onUse: () => void
	onDetails: () => void
}) {
	const template = FORM_TEMPLATES[templateKey]
	const metadata = getTemplateMetadata(templateKey)
	if (!template || !metadata) return null

	return (
		<article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-200/60 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700 dark:hover:shadow-none">
			<div className="relative border-b border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-gray-900 dark:bg-gray-900/45">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-gray-950 dark:text-gray-400 dark:ring-gray-800">
							{metadata.category}
						</span>
						<div className="mt-4 space-y-2">
							<div className="h-2 w-24 rounded-full bg-slate-200/80 dark:bg-gray-800" />
							<div className="h-2 w-36 rounded-full bg-slate-200/60 dark:bg-gray-800/70" />
							<div className="h-2 w-28 rounded-full bg-slate-200/50 dark:bg-gray-800/50" />
						</div>
					</div>
					<button
						onClick={onFavorite}
						className={`rounded-lg p-2 transition-colors ${
							isFavorite
								? 'bg-amber-50 text-amber-500 dark:bg-amber-900/20'
								: 'text-slate-300 hover:bg-white hover:text-slate-500 dark:text-gray-700 dark:hover:bg-gray-950 dark:hover:text-gray-400'
						}`}
						aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
					>
						<Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
					</button>
				</div>
			</div>
			<div className="p-5">
				<div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 dark:text-gray-500">
					<span>{metadata.inputFieldCount} fields</span>
					<span aria-hidden="true">·</span>
					<span>{metadata.requiredFieldCount} required</span>
					<span aria-hidden="true">·</span>
					<span>{metadata.estimatedMinutes} min</span>
				</div>
				<h3 className="mt-3 text-[17px] font-semibold tracking-tight text-slate-950 dark:text-white">{template.title}</h3>
				<p className="mt-1 min-h-[40px] line-clamp-2 text-[13px] leading-5 text-slate-500 dark:text-gray-400">{template.description}</p>
				<div className="mt-5 flex items-center justify-between gap-3">
					<button
						onClick={onUse}
						className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
					>
						<Check className="h-3.5 w-3.5" />
						Start
					</button>
					<button
						onClick={onDetails}
						className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-200"
					>
						<Eye className="h-3.5 w-3.5" />
						Preview
					</button>
				</div>
			</div>
		</article>
	)
}

function TemplatePagination({
	page,
	totalPages,
	totalItems,
	start,
	end,
	onPageChange,
}: {
	page: number
	totalPages: number
	totalItems: number
	start: number
	end: number
	onPageChange: (page: number) => void
}) {
	if (totalPages <= 1) return null

	const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

	return (
		<div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-[12px] font-medium text-slate-500 dark:text-gray-500">
				Showing {start}-{end} of {totalItems}
			</p>
			<div className="flex items-center gap-1.5">
				<button
					onClick={() => onPageChange(Math.max(1, page - 1))}
					disabled={page === 1}
					className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-900"
					aria-label="Previous page"
				>
					<ChevronLeft className="h-4 w-4" />
				</button>
				{pages.map((item) => (
					<button
						key={item}
						onClick={() => onPageChange(item)}
						className={`h-9 min-w-9 rounded-lg px-3 text-[13px] font-semibold transition-colors ${
							page === item
								? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
								: 'text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-900'
						}`}
					>
						{item}
					</button>
				))}
				<button
					onClick={() => onPageChange(Math.min(totalPages, page + 1))}
					disabled={page === totalPages}
					className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-900"
					aria-label="Next page"
				>
					<ChevronRight className="h-4 w-4" />
				</button>
			</div>
		</div>
	)
}

function PrivateTemplatePreview({
	templateKey,
	onClose,
	onUse,
}: {
	templateKey: string
	onClose: () => void
	onUse: () => void
}) {
	const template = FORM_TEMPLATES[templateKey]
	const metadata = getTemplateMetadata(templateKey)
	if (!template || !metadata) return null

	if (typeof document === 'undefined') return null

	const modal = (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" onClick={onClose} />
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="private-template-preview-title"
				className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-gray-800 dark:bg-gray-950"
			>
				<div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-gray-900">
					<div className="min-w-0">
						<div className="mb-2 flex flex-wrap items-center gap-2">
							<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-gray-900 dark:text-gray-400">{metadata.category}</span>
							<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300">{metadata.estimatedMinutes} min</span>
						</div>
						<h2 id="private-template-preview-title" className="truncate text-[24px] font-bold tracking-[-0.01em] text-slate-950 dark:text-white">{template.title}</h2>
						<p className="mt-1 max-w-2xl text-[14px] leading-6 text-slate-500 dark:text-gray-400">{template.description}</p>
					</div>
					<button
						onClick={onClose}
						className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-gray-900 dark:hover:text-gray-200"
						aria-label="Close preview"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				<div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_300px]">
					<div className="p-6">
						<div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-gray-800 dark:bg-gray-900/35">
							<div className="mb-4 flex items-center justify-between">
								<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">Fields preview</h3>
								<span className="text-[12px] text-slate-400 dark:text-gray-500">{template.fields.length} fields</span>
							</div>
							<div className="space-y-2">
								{template.fields.map((field, index) => (
									<div key={field.id} className="rounded-xl border border-slate-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
										<div className="flex items-start gap-3">
											<span className="mt-0.5 w-6 text-[12px] font-semibold text-slate-400 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<p className="truncate text-[14px] font-semibold text-slate-800 dark:text-gray-100">{field.label || 'Untitled field'}</p>
													{field.required && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-300">Required</span>}
												</div>
												<p className="mt-1 text-[12px] capitalize text-slate-400 dark:text-gray-500">{field.type}</p>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>

					<aside className="border-t border-slate-100 p-6 dark:border-gray-900 lg:border-l lg:border-t-0">
						<div className="space-y-5">
							<div>
								<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Audience</p>
								<p className="mt-1 text-[14px] font-semibold text-slate-800 dark:text-gray-200">{metadata.audience}</p>
							</div>
							<div className="grid grid-cols-2 gap-2">
								<TemplatePreviewStat label="Fields" value={metadata.inputFieldCount} />
								<TemplatePreviewStat label="Required" value={metadata.requiredFieldCount} />
							</div>
							<div>
								<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Best for</p>
								<div className="mt-2 space-y-2">
									{metadata.useCases.slice(0, 3).map(useCase => (
										<p key={useCase} className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] font-medium leading-5 text-slate-600 dark:bg-gray-900 dark:text-gray-300">{useCase}</p>
									))}
								</div>
							</div>
							<button
								onClick={onUse}
								className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
							>
								<Check className="h-4 w-4" />
								Start with this template
							</button>
						</div>
					</aside>
				</div>
			</div>
		</div>
	)

	return createPortal(modal, document.body)
}

function TemplatePreviewStat({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-gray-900">
			<p className="text-[20px] font-bold tabular-nums text-slate-950 dark:text-gray-100">{value}</p>
			<p className="text-[11px] font-medium text-slate-400 dark:text-gray-500">{label}</p>
		</div>
	)
}
