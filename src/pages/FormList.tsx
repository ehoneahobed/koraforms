import { useQuery, useMutation, useCollection } from '@korajs/react'
import {
	Plus,
	FileText,
	MoreHorizontal,
	Trash2,
	Eye,
	Pencil,
	Copy,
	ClipboardList,
	LayoutTemplate,
	ArrowRight,
	BarChart3,
	Send,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { FORM_TEMPLATES } from '../templates'

interface Props {
	navigate: (path: string) => void
}

export function FormList({ navigate }: Props) {
	const forms = useCollection('forms')
	const allForms = useQuery(forms.where({}).orderBy('createdAt', 'desc'))
	const { mutate: deleteForm } = useMutation((id: string) => forms.delete(id))
	const { mutate: createForm } = useMutation(
		(data: { title: string; description: string; fields: string; status: string }) =>
			forms.insert(data),
	)

	const [showTemplates, setShowTemplates] = useState(false)

	const handleCreateFromTemplate = (key: string) => {
		const template = FORM_TEMPLATES[key]
		if (!template) return
		createForm({
			title: template.title || 'Untitled Form',
			description: template.description,
			fields: JSON.stringify(template.fields),
			status: 'draft',
		})
		setShowTemplates(false)
	}

	const published = allForms.filter((f) => String(f.status) === 'published')
	const drafts = allForms.filter((f) => String(f.status) !== 'published')

	return (
		<div>
			{/* Hero section */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Forms</h1>
					<p className="text-gray-500 dark:text-gray-400 mt-1 text-sm sm:text-base">
						Build forms that work offline. Collect data anywhere.
					</p>
				</div>
				<button
					onClick={() => setShowTemplates(true)}
					className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-brand-600/25 transition-smooth hover:bg-brand-500 hover:shadow-md hover:shadow-brand-600/30 active:scale-[0.98]"
				>
					<Plus className="h-4 w-4" />
					New Form
				</button>
			</div>

			{/* Quick stats */}
			{allForms.length > 0 && (
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
					<StatCard
						label="Total Forms"
						value={allForms.length}
						icon={<FileText className="h-4 w-4" />}
					/>
					<StatCard
						label="Published"
						value={published.length}
						icon={<Send className="h-4 w-4" />}
						accent
					/>
					<StatCard
						label="Total Responses"
						value={allForms.reduce((sum, f) => sum + (Number(f.responseCount) || 0), 0)}
						icon={<BarChart3 className="h-4 w-4" />}
						className="col-span-2 sm:col-span-1"
					/>
				</div>
			)}

			{/* Template picker */}
			{showTemplates && (
				<TemplatePicker
					onSelect={handleCreateFromTemplate}
					onClose={() => setShowTemplates(false)}
				/>
			)}

			{/* Published forms */}
			{published.length > 0 && (
				<section className="mb-8">
					<h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
						Published
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{published.map((form) => (
							<FormCard
								key={form.id}
								form={form}
								navigate={navigate}
								onDelete={() => deleteForm(form.id)}
							/>
						))}
					</div>
				</section>
			)}

			{/* Drafts */}
			{drafts.length > 0 && (
				<section className="mb-8">
					<h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
						Drafts
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{drafts.map((form) => (
							<FormCard
								key={form.id}
								form={form}
								navigate={navigate}
								onDelete={() => deleteForm(form.id)}
							/>
						))}
					</div>
				</section>
			)}

			{/* Empty state */}
			{allForms.length === 0 && <EmptyState onCreateClick={() => setShowTemplates(true)} />}
		</div>
	)
}

function StatCard({
	label,
	value,
	icon,
	accent,
	className = '',
}: {
	label: string
	value: number
	icon: React.ReactNode
	accent?: boolean
	className?: string
}) {
	return (
		<div
			className={`rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-4 ${className}`}
		>
			<div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 mb-1">
				{icon}
				<span className="text-xs font-medium">{label}</span>
			</div>
			<p
				className={`text-2xl font-bold ${accent ? 'text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100'}`}
			>
				{value}
			</p>
		</div>
	)
}

function FormCard({
	form,
	navigate,
	onDelete,
}: {
	form: Record<string, unknown>
	navigate: (path: string) => void
	onDelete: () => void
}) {
	const [menuOpen, setMenuOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)
	const isPublished = String(form.status) === 'published'
	const responseCount = Number(form.responseCount) || 0

	let fieldCount = 0
	try {
		fieldCount = JSON.parse(String(form.fields || '[]')).length
	} catch {
		// ignore
	}

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
		<div className="group relative rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-4 transition-smooth hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm">
			{/* Status dot */}
			<div className="flex items-start justify-between mb-3">
				<div className="flex items-center gap-2">
					<div
						className={`w-2 h-2 rounded-full ${isPublished ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-gray-600'}`}
					/>
					<span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
						{isPublished ? 'Live' : 'Draft'}
					</span>
				</div>
				<div className="relative" ref={menuRef}>
					<button
						onClick={() => setMenuOpen(!menuOpen)}
						className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth opacity-0 group-hover:opacity-100"
					>
						<MoreHorizontal className="h-4 w-4" />
					</button>
					{menuOpen && (
						<div className="absolute right-0 top-8 w-44 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1 z-10 animate-scale-in">
							<MenuButton
								icon={<Pencil className="h-3.5 w-3.5" />}
								label="Edit"
								onClick={() => {
									navigate(`build/${form.id}`)
									setMenuOpen(false)
								}}
							/>
							{isPublished && (
								<MenuButton
									icon={<Eye className="h-3.5 w-3.5" />}
									label="View responses"
									onClick={() => {
										navigate(`responses/${form.id}`)
										setMenuOpen(false)
									}}
								/>
							)}
							{isPublished && (
								<MenuButton
									icon={<Copy className="h-3.5 w-3.5" />}
									label="Copy fill link"
									onClick={() => {
										navigator.clipboard.writeText(
											`${window.location.origin}${window.location.pathname}#fill/${form.id}`,
										)
										setMenuOpen(false)
									}}
								/>
							)}
							<div className="my-1 border-t border-gray-100 dark:border-gray-700" />
							<MenuButton
								icon={<Trash2 className="h-3.5 w-3.5" />}
								label="Delete"
								danger
								onClick={() => {
									onDelete()
									setMenuOpen(false)
								}}
							/>
						</div>
					)}
				</div>
			</div>

			{/* Title */}
			<h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate">
				{String(form.title) || 'Untitled Form'}
			</h3>
			<p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-4">
				{fieldCount} field{fieldCount !== 1 ? 's' : ''}
				{String(form.description) ? ` — ${String(form.description)}` : ''}
			</p>

			{/* Actions */}
			<div className="flex items-center justify-between">
				{isPublished ? (
					<div className="flex items-center gap-2 text-xs text-gray-400">
						<ClipboardList className="h-3.5 w-3.5" />
						<span>
							{responseCount} response{responseCount !== 1 ? 's' : ''}
						</span>
					</div>
				) : (
					<div />
				)}

				<div className="flex items-center gap-2">
					{isPublished && (
						<button
							onClick={() => navigate(`fill/${form.id}`)}
							className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 transition-smooth hover:bg-brand-100 dark:hover:bg-brand-900/30"
						>
							Fill
							<ArrowRight className="h-3 w-3" />
						</button>
					)}
					<button
						onClick={() => navigate(`build/${form.id}`)}
						className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 transition-smooth hover:bg-gray-200 dark:hover:bg-gray-700"
					>
						Edit
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
			className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-smooth ${
				danger
					? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
					: 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
			}`}
		>
			{icon}
			{label}
		</button>
	)
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center py-20 animate-fade-in">
			<div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-6">
				<FileText className="h-8 w-8 text-brand-500" />
			</div>
			<h2 className="text-xl font-semibold mb-2">Create your first form</h2>
			<p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-8 text-sm leading-relaxed">
				Build forms that work anywhere — even without internet. Start from a template
				or create a blank form. All data is saved locally and syncs when you're back
				online.
			</p>
			<button
				onClick={onCreateClick}
				className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow-sm shadow-brand-600/25 transition-smooth hover:bg-brand-500 active:scale-[0.98]"
			>
				<Plus className="h-4 w-4" />
				New Form
			</button>
		</div>
	)
}

function TemplatePicker({
	onSelect,
	onClose,
}: {
	onSelect: (key: string) => void
	onClose: () => void
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
			<div
				className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 animate-slide-up max-h-[80vh] overflow-y-auto"
			>
				<div className="flex items-center justify-between mb-5">
					<div className="flex items-center gap-2.5">
						<div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
							<LayoutTemplate className="h-4 w-4 text-brand-500" />
						</div>
						<h3 className="text-lg font-semibold">Choose a template</h3>
					</div>
					<button
						onClick={onClose}
						className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth"
					>
						&times;
					</button>
				</div>
				<div className="space-y-2">
					{Object.entries(FORM_TEMPLATES).map(([key, template]) => (
						<button
							key={key}
							onClick={() => onSelect(key)}
							className="w-full text-left rounded-xl border border-gray-100 dark:border-gray-800 p-4 transition-smooth hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 group"
						>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium text-gray-900 dark:text-gray-100">
										{key === 'blank' ? 'Blank Form' : template.title}
									</p>
									<p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
										{key === 'blank'
											? 'Start from scratch'
											: `${template.fields.length} fields — ${template.description}`}
									</p>
								</div>
								<ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-brand-500 transition-smooth" />
							</div>
						</button>
					))}
				</div>
			</div>
		</div>
	)
}
