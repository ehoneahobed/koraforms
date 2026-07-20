import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@korajs/react'
import { app } from '../kora'
import {
	ArrowLeft,
	GripVertical,
	Plus,
	Check,
	Send,
	Trash2,
	ChevronUp,
	ChevronDown,
	Type,
	Hash,
	Mail,
	Phone,
	Calendar,
	AlignLeft,
	List,
	CircleDot,
	CheckSquare,
	Eye,
	Star,
	ToggleLeft,
	Clock,
	Link,
	SeparatorHorizontal,
	MessageSquare,
	PenTool,
} from 'lucide-react'
import { FIELD_TYPES, type FormField, type FieldType } from '../types'
import { THEME_PRESETS, getThemeById } from '../themes'
import { generateSlug } from '../utils/slug'
import { useSlashCommand } from '../hooks/useSlashCommand'
import { SlashCommandMenu } from '../components/editor/SlashCommandMenu'
import { ShareModal } from '../components/shared/ShareModal'
import { FormSettings } from '../components/editor/FormSettings'
import { Share2 } from 'lucide-react'

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
	text: <Type className="h-3.5 w-3.5" />,
	number: <Hash className="h-3.5 w-3.5" />,
	email: <Mail className="h-3.5 w-3.5" />,
	phone: <Phone className="h-3.5 w-3.5" />,
	date: <Calendar className="h-3.5 w-3.5" />,
	textarea: <AlignLeft className="h-3.5 w-3.5" />,
	select: <List className="h-3.5 w-3.5" />,
	radio: <CircleDot className="h-3.5 w-3.5" />,
	checkbox: <CheckSquare className="h-3.5 w-3.5" />,
	rating: <Star className="h-3.5 w-3.5" />,
	scale: <Hash className="h-3.5 w-3.5" />,
	yesno: <ToggleLeft className="h-3.5 w-3.5" />,
	time: <Clock className="h-3.5 w-3.5" />,
	url: <Link className="h-3.5 w-3.5" />,
	section: <SeparatorHorizontal className="h-3.5 w-3.5" />,
	statement: <MessageSquare className="h-3.5 w-3.5" />,
	signature: <PenTool className="h-3.5 w-3.5" />,
}

interface Props {
	formId?: string
	navigate: (path: string) => void
	userId: string
}

export function FormBuilder({ formId, navigate, userId }: Props) {
	const allForms = useQuery(app.forms.where({}).orderBy('createdAt', 'desc'))
	const form = allForms.find((f) => f.id === formId)

	const { mutate: updateForm } = useMutation(
		(id: string, data: Record<string, unknown>) => app.forms.update(id, data),
	)

	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [fields, setFields] = useState<FormField[]>([])
	const [theme, setTheme] = useState('indigo')
	const [loaded, setLoaded] = useState(false)
	const [saved, setSaved] = useState(false)
	const [activeField, setActiveField] = useState<string | null>(null)
	const [showThemePicker, setShowThemePicker] = useState(false)
	const [showSettings, setShowSettings] = useState(false)
	const [showShareModal, setShowShareModal] = useState(false)

	// Slash command: add a field of a specific type
	const addFieldOfType = useCallback((type: FieldType, afterIndex: number | null) => {
		const newField: FormField = {
			id: `field_${Date.now()}`,
			type,
			label: '',
			required: false,
			...((['select', 'radio', 'checkbox'].includes(type)) ? { options: 'Option 1, Option 2, Option 3' } : {}),
		}
		if (afterIndex !== null && afterIndex >= 0) {
			const next = [...fields]
			next.splice(afterIndex + 1, 0, newField)
			setFields(next)
		} else {
			setFields([...fields, newField])
		}
		setActiveField(newField.id)
		slashCommand.close()
	}, [fields])

	const slashCommand = useSlashCommand(addFieldOfType)

	// Drag-and-drop state
	const [dragIndex, setDragIndex] = useState<number | null>(null)
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

	const moveField = useCallback((from: number, to: number) => {
		setFields(prev => {
			if (to < 0 || to >= prev.length) return prev
			const next = [...prev]
			const [item] = next.splice(from, 1)
			next.splice(to, 0, item!)
			return next
		})
	}, [])

	const handleDragStart = useCallback((index: number) => {
		setDragIndex(index)
	}, [])

	const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
		e.preventDefault()
		setDragOverIndex(index)
	}, [])

	const handleDrop = useCallback((index: number) => {
		if (dragIndex !== null && dragIndex !== index) {
			moveField(dragIndex, index)
		}
		setDragIndex(null)
		setDragOverIndex(null)
	}, [dragIndex, moveField])

	const handleDragEnd = useCallback(() => {
		setDragIndex(null)
		setDragOverIndex(null)
	}, [])

	useEffect(() => {
		if (form && !loaded) {
			setTitle(String(form.title || ''))
			setDescription(String(form.description || ''))
			setTheme(String(form.theme || 'indigo'))
			try {
				setFields(JSON.parse(String(form.fields || '[]')))
			} catch {
				setFields([])
			}
			setLoaded(true)
		}
	}, [form, loaded])

	// Auto-save with debounce
	const save = useCallback(() => {
		if (!formId) return
		updateForm(formId, {
			title: title || 'Untitled Form',
			description,
			fields: JSON.stringify(fields),
			theme,
			ownerId: userId,
		})
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}, [formId, title, description, fields, theme, userId, updateForm])

	// Auto-save on changes (debounced)
	useEffect(() => {
		if (!loaded) return
		const timer = setTimeout(save, 1500)
		return () => clearTimeout(timer)
	}, [title, description, fields, theme, loaded, save])

	if (!formId || (!form && loaded)) {
		return (
			<div className="text-center py-20 text-gray-500 animate-fade-in">
				<p className="text-lg mb-2">Form not found</p>
				<button onClick={() => navigate('dashboard')} className="text-brand-500 hover:underline text-sm">
					Go back to forms
				</button>
			</div>
		)
	}

	if (!loaded) {
		return (
			<div className="space-y-4 animate-fade-in">
				<div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
				<div className="h-24 bg-gray-100 dark:bg-gray-800/50 rounded-xl animate-pulse" />
				<div className="h-20 bg-gray-100 dark:bg-gray-800/50 rounded-xl animate-pulse" />
			</div>
		)
	}

	const publish = () => {
		const formTitle = title || 'Untitled Form'
		const existingSlug = form ? String(form.slug || '') : ''
		const slug = existingSlug || generateSlug(formTitle)
		updateForm(formId, {
			title: formTitle,
			description,
			fields: JSON.stringify(fields),
			theme,
			status: 'published',
			ownerId: userId,
			slug,
		})
		// Show share modal after first publish, otherwise just go to dashboard
		if (!existingSlug) {
			setShowShareModal(true)
		} else {
			navigate('dashboard')
		}
	}

	const addField = (afterIndex?: number) => {
		const newField: FormField = {
			id: `field_${Date.now()}`,
			type: 'text',
			label: '',
			required: false,
		}
		if (afterIndex !== undefined) {
			const next = [...fields]
			next.splice(afterIndex + 1, 0, newField)
			setFields(next)
		} else {
			setFields([...fields, newField])
		}
		setActiveField(newField.id)
	}

	const updateField = (index: number, updates: Partial<FormField>) => {
		const next = [...fields]
		next[index] = { ...next[index]!, ...updates }
		setFields(next)
	}

	const removeField = (index: number) => {
		setFields(fields.filter((_, i) => i !== index))
		setActiveField(null)
	}

	const isPublished = form ? String(form.status) === 'published' : false

	return (
		<div className="max-w-2xl mx-auto">
			{/* Top bar */}
			<div className="flex items-center justify-between mb-6">
				<button
					onClick={() => navigate('dashboard')}
					className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
				>
					<ArrowLeft className="h-4 w-4" />
					Back
				</button>
				<div className="flex items-center gap-2">
					{saved && (
						<span className="flex items-center gap-1 text-xs text-emerald-500 animate-fade-in">
							<Check className="h-3 w-3" />
							Saved
						</span>
					)}
					{isPublished && (
						<button
							onClick={() => setShowShareModal(true)}
							className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 px-2.5 py-2 sm:px-3 text-sm text-gray-600 dark:text-gray-300 transition-smooth hover:bg-gray-200 dark:hover:bg-gray-700"
							title="Share"
						>
							<Share2 className="h-3.5 w-3.5" />
							<span className="hidden sm:inline">Share</span>
						</button>
					)}
					{isPublished && (
						<button
							onClick={() => navigate(`fill/${formId}`)}
							className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 px-2.5 py-2 sm:px-3 text-sm text-gray-600 dark:text-gray-300 transition-smooth hover:bg-gray-200 dark:hover:bg-gray-700"
							title="Preview"
						>
							<Eye className="h-3.5 w-3.5" />
							<span className="hidden sm:inline">Preview</span>
						</button>
					)}
					<button
						onClick={publish}
						className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/25 transition-smooth hover:bg-brand-500 active:scale-[0.98]"
					>
						<Send className="h-3.5 w-3.5" />
						{isPublished ? 'Update' : 'Publish'}
					</button>
				</div>
			</div>

			{/* Form header */}
			<div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-6 sm:p-8 mb-4">
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="Untitled Form"
					className="w-full bg-transparent text-2xl sm:text-3xl font-bold outline-none placeholder-gray-300 dark:placeholder-gray-600 text-gray-900 dark:text-gray-100 mb-2"
				/>
				<input
					type="text"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Add a description..."
					className="w-full bg-transparent text-gray-500 dark:text-gray-400 outline-none placeholder-gray-300 dark:placeholder-gray-700 text-sm sm:text-base"
				/>
			</div>

			{/* Theme picker */}
			<div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark mb-4 overflow-hidden">
				<button
					onClick={() => setShowThemePicker(!showThemePicker)}
					className="w-full flex items-center justify-between px-6 py-3.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-smooth"
				>
					<div className="flex items-center gap-3">
						<div
							className="w-5 h-5 rounded-full shadow-inner ring-1 ring-black/10"
							style={{ backgroundColor: getThemeById(theme).preview }}
						/>
						<span className="font-medium">Theme</span>
						<span className="text-gray-400 dark:text-gray-500">{getThemeById(theme).name}</span>
					</div>
					<ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showThemePicker ? 'rotate-180' : ''}`} />
				</button>
				{showThemePicker && (
					<div className="px-6 pb-4 pt-1 animate-fade-in">
						<div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
							{THEME_PRESETS.map((preset) => (
								<button
									key={preset.id}
									onClick={() => setTheme(preset.id)}
									className={`group relative flex flex-col items-center gap-1.5 rounded-xl p-2 transition-smooth ${
										theme === preset.id
											? 'bg-gray-100 dark:bg-gray-800'
											: 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
									}`}
									title={preset.name}
								>
									<div
										className={`w-8 h-8 rounded-full shadow-sm transition-smooth group-hover:scale-110 ${
											theme === preset.id ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900' : ''
										}`}
										style={{
											backgroundColor: preset.preview,
											...(theme === preset.id ? { '--tw-ring-color': preset.preview } as React.CSSProperties : {}),
										}}
									/>
									<span className="text-[10px] text-gray-500 dark:text-gray-400 leading-none truncate w-full text-center">
										{preset.name}
									</span>
								</button>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Form settings (slug, status) */}
			{isPublished && (
				<FormSettings
					slug={String(form?.slug || '')}
					status={String(form?.status || 'draft')}
					onSlugChange={(newSlug) => {
						if (formId) updateForm(formId, { slug: newSlug })
					}}
					onStatusChange={(newStatus) => {
						if (formId) updateForm(formId, { status: newStatus })
					}}
					isOpen={showSettings}
					onToggle={() => setShowSettings(!showSettings)}
				/>
			)}

			{/* Fields */}
			<div className="space-y-2">
				{fields.map((field, index) => (
					<FieldEditor
						key={field.id}
						field={field}
						index={index}
						total={fields.length}
						isActive={activeField === field.id}
						isDragging={dragIndex === index}
						isDragOver={dragOverIndex === index && dragIndex !== index}
						onFocus={() => setActiveField(field.id)}
						onUpdate={(updates) => updateField(index, updates)}
						onRemove={() => removeField(index)}
						onMove={(dir) => moveField(index, index + dir)}
						onAddAfter={() => addField(index)}
						onDragStart={() => handleDragStart(index)}
						onDragOver={(e) => handleDragOver(e, index)}
						onDrop={() => handleDrop(index)}
						onDragEnd={handleDragEnd}
					/>
				))}
			</div>

			{/* Add field — click or type / for slash command */}
			<div className="relative mt-3">
				<div className="flex gap-2">
					<button
						onClick={() => addField()}
						className="flex-1 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 py-4 text-gray-400 dark:text-gray-500 transition-smooth hover:border-brand-300 dark:hover:border-brand-700 hover:text-brand-500 flex items-center justify-center gap-2 text-sm font-medium active:scale-[0.99]"
					>
						<Plus className="h-4 w-4" />
						Add field
					</button>
					<button
						onClick={() => slashCommand.open(fields.length - 1)}
						className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 px-4 py-4 text-gray-400 dark:text-gray-500 transition-smooth hover:border-brand-300 dark:hover:border-brand-700 hover:text-brand-500 flex items-center justify-center text-sm font-medium active:scale-[0.99]"
						title="Choose field type (or press /)"
					>
						/
					</button>
				</div>
				<SlashCommandMenu
					isOpen={slashCommand.isOpen}
					query={slashCommand.query}
					filteredTypes={slashCommand.filteredTypes}
					selectedIndex={slashCommand.selectedIndex}
					onQueryChange={slashCommand.updateQuery}
					onSelect={slashCommand.selectCurrent}
					onClose={slashCommand.close}
				/>
			</div>

			{fields.length === 0 && (
				<p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-6">
					Click "Add field" or press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono">/</kbd> to choose a field type.
					<br />
					<span className="text-xs text-gray-300 dark:text-gray-600">
						Fields auto-save as you edit.
					</span>
				</p>
			)}

			{/* Share modal */}
			{showShareModal && (
				<ShareModal
					slug={String(form?.slug || formId)}
					title={title || 'Untitled Form'}
					onClose={() => {
						setShowShareModal(false)
						// If this was the first publish, go to dashboard after closing
						if (isPublished) navigate('dashboard')
					}}
				/>
			)}

			{/* Bottom spacer */}
			<div className="h-20" />
		</div>
	)
}

function FieldEditor({
	field,
	index,
	total,
	isActive,
	isDragging,
	isDragOver,
	onFocus,
	onUpdate,
	onRemove,
	onMove,
	onAddAfter,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd,
}: {
	field: FormField
	index: number
	total: number
	isActive: boolean
	isDragging?: boolean
	isDragOver?: boolean
	onFocus: () => void
	onUpdate: (updates: Partial<FormField>) => void
	onRemove: () => void
	onMove: (direction: number) => void
	onAddAfter: () => void
	onDragStart?: () => void
	onDragOver?: (e: React.DragEvent) => void
	onDrop?: () => void
	onDragEnd?: () => void
}) {
	const needsOptions = ['select', 'radio', 'checkbox'].includes(field.type)
	const needsScaleLabels = field.type === 'scale'
	const isDisplayOnly = field.type === 'section' || field.type === 'statement'
	const isSignature = field.type === 'signature'

	return (
		<div
			onClick={onFocus}
			draggable
			onDragStart={(e) => {
				e.dataTransfer.effectAllowed = 'move'
				onDragStart?.()
			}}
			onDragOver={(e) => onDragOver?.(e)}
			onDrop={() => onDrop?.()}
			onDragEnd={() => onDragEnd?.()}
			className={`rounded-2xl border bg-white dark:bg-surface-elevated-dark p-4 sm:p-5 transition-smooth cursor-pointer ${
				isDragging
					? 'opacity-40 border-brand-300 dark:border-brand-700'
					: isDragOver
						? 'border-brand-400 dark:border-brand-600 shadow-md shadow-brand-100 dark:shadow-none'
						: isActive
							? 'border-brand-300 dark:border-brand-700 shadow-sm shadow-brand-100 dark:shadow-none'
							: 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
			}`}
		>
			<div className="flex items-start gap-3">
				{/* Reorder / drag handle */}
				<div className="flex flex-col items-center gap-0.5 pt-1.5 opacity-40 hover:opacity-100 transition-smooth cursor-grab active:cursor-grabbing">
					<button
						onClick={(e) => {
							e.stopPropagation()
							onMove(-1)
						}}
						disabled={index === 0}
						className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20 disabled:cursor-not-allowed"
					>
						<ChevronUp className="h-3 w-3" />
					</button>
					<GripVertical className="h-4 w-4 text-gray-400" />
					<button
						onClick={(e) => {
							e.stopPropagation()
							onMove(1)
						}}
						disabled={index === total - 1}
						className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20 disabled:cursor-not-allowed"
					>
						<ChevronDown className="h-3 w-3" />
					</button>
				</div>

				{/* Field config */}
				<div className="flex-1 min-w-0 space-y-3">
					{/* Label + Type */}
					<div className="flex gap-2">
						<div className="flex-1 relative">
							<input
								type="text"
								value={field.label}
								onChange={(e) => onUpdate({ label: e.target.value })}
								placeholder={`Question ${index + 1}`}
								className="w-full bg-transparent text-base font-medium outline-none placeholder-gray-300 dark:placeholder-gray-600 text-gray-900 dark:text-gray-100"
							/>
							{!isActive && !field.label && (
								<span className="absolute left-0 top-0 text-base text-gray-300 dark:text-gray-600 pointer-events-none">
									Question {index + 1}
								</span>
							)}
						</div>
					</div>

					{/* Type selector - shown when active */}
					{isActive && (
						<div className="animate-fade-in">
							<div className="flex flex-wrap gap-1.5">
								{FIELD_TYPES.map((ft) => (
									<button
										key={ft.value}
										onClick={(e) => {
											e.stopPropagation()
											onUpdate({ type: ft.value })
										}}
										className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-smooth ${
											field.type === ft.value
												? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
												: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
										}`}
									>
										{FIELD_ICONS[ft.value]}
										{ft.label}
									</button>
								))}
							</div>
						</div>
					)}

					{/* Options input */}
					{needsOptions && isActive && (
						<div className="animate-fade-in">
							<input
								type="text"
								value={field.options || ''}
								onChange={(e) => onUpdate({ options: e.target.value })}
								placeholder="Options (comma-separated: Yes, No, Maybe)"
								className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth"
							/>
						</div>
					)}

					{/* Scale labels input */}
					{needsScaleLabels && isActive && (
						<div className="animate-fade-in">
							<input
								type="text"
								value={field.options || ''}
								onChange={(e) => onUpdate({ options: e.target.value })}
								placeholder="Labels (comma-separated: Not likely, Very likely)"
								className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth"
							/>
						</div>
					)}

					{/* Signature note */}
					{isSignature && isActive && (
						<p className="text-xs text-gray-400 dark:text-gray-500 animate-fade-in">
							Respondent will draw their signature
						</p>
					)}

					{/* Options preview (when not active) */}
					{needsOptions && !isActive && field.options && (
						<div className="flex flex-wrap gap-1.5">
							{field.options
								.split(',')
								.map((o) => o.trim())
								.filter(Boolean)
								.map((opt) => (
									<span
										key={opt}
										className="inline-block rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400"
									>
										{opt}
									</span>
								))}
						</div>
					)}

					{/* Scale labels preview (when not active) */}
					{needsScaleLabels && !isActive && field.options && (
						<div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
							<span>1-10</span>
							<span className="text-gray-300 dark:text-gray-600">|</span>
							<span>{field.options}</span>
						</div>
					)}

					{/* Bottom controls */}
					{isActive && (
						<div className="flex items-center justify-between pt-1 animate-fade-in">
							<div className="flex items-center gap-4">
								{!isDisplayOnly && (
									<label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
										<input
											type="checkbox"
											checked={field.required}
											onChange={(e) => onUpdate({ required: e.target.checked })}
											className="rounded border-gray-300"
										/>
										Required
									</label>
								)}
								{isDisplayOnly && (
									<span className="text-xs text-gray-400 dark:text-gray-500 italic">Display only</span>
								)}
							</div>
							<div className="flex items-center gap-1">
								<button
									onClick={(e) => {
										e.stopPropagation()
										onAddAfter()
									}}
									className="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-smooth"
									title="Add field below"
								>
									<Plus className="h-3.5 w-3.5" />
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation()
										onRemove()
									}}
									className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-smooth"
									title="Delete field"
								>
									<Trash2 className="h-3.5 w-3.5" />
								</button>
							</div>
						</div>
					)}

					{/* Compact info when not active */}
					{!isActive && (
						<div className="flex items-center gap-3 text-xs text-gray-400">
							<span className="inline-flex items-center gap-1">
								{FIELD_ICONS[field.type]}
								{FIELD_TYPES.find((ft) => ft.value === field.type)?.label}
							</span>
							{field.required && (
								<span className="text-amber-500">Required</span>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
