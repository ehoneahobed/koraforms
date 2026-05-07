import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useCollection } from '@korajs/react'
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
} from 'lucide-react'
import { FIELD_TYPES, type FormField, type FieldType } from '../types'

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
}

interface Props {
	formId?: string
	navigate: (path: string) => void
}

export function FormBuilder({ formId, navigate }: Props) {
	const forms = useCollection('forms')
	const allForms = useQuery(forms.where({}).orderBy('createdAt', 'desc'))
	const form = allForms.find((f) => f.id === formId)

	const { mutate: updateForm } = useMutation(
		(id: string, data: Record<string, unknown>) => forms.update(id, data),
	)

	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [fields, setFields] = useState<FormField[]>([])
	const [loaded, setLoaded] = useState(false)
	const [saved, setSaved] = useState(false)
	const [activeField, setActiveField] = useState<string | null>(null)

	useEffect(() => {
		if (form && !loaded) {
			setTitle(String(form.title || ''))
			setDescription(String(form.description || ''))
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
		})
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}, [formId, title, description, fields, updateForm])

	// Auto-save on changes (debounced)
	useEffect(() => {
		if (!loaded) return
		const timer = setTimeout(save, 1500)
		return () => clearTimeout(timer)
	}, [title, description, fields, loaded, save])

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
		updateForm(formId, {
			title: title || 'Untitled Form',
			description,
			fields: JSON.stringify(fields),
			status: 'published',
		})
		navigate('dashboard')
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

	const moveField = (from: number, to: number) => {
		if (to < 0 || to >= fields.length) return
		const next = [...fields]
		const [item] = next.splice(from, 1)
		next.splice(to, 0, item!)
		setFields(next)
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
							onClick={() => navigate(`fill/${formId}`)}
							className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 transition-smooth hover:bg-gray-200 dark:hover:bg-gray-700"
						>
							<Eye className="h-3.5 w-3.5" />
							Preview
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

			{/* Fields */}
			<div className="space-y-2">
				{fields.map((field, index) => (
					<FieldEditor
						key={field.id}
						field={field}
						index={index}
						total={fields.length}
						isActive={activeField === field.id}
						onFocus={() => setActiveField(field.id)}
						onUpdate={(updates) => updateField(index, updates)}
						onRemove={() => removeField(index)}
						onMove={(dir) => moveField(index, index + dir)}
						onAddAfter={() => addField(index)}
					/>
				))}
			</div>

			{/* Add field */}
			<button
				onClick={() => addField()}
				className="mt-3 w-full rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 py-4 text-gray-400 dark:text-gray-500 transition-smooth hover:border-brand-300 dark:hover:border-brand-700 hover:text-brand-500 flex items-center justify-center gap-2 text-sm font-medium active:scale-[0.99]"
			>
				<Plus className="h-4 w-4" />
				Add field
			</button>

			{fields.length === 0 && (
				<p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-6">
					Click "Add field" to start building your form.
					<br />
					<span className="text-xs text-gray-300 dark:text-gray-600">
						Fields auto-save as you edit.
					</span>
				</p>
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
	onFocus,
	onUpdate,
	onRemove,
	onMove,
	onAddAfter,
}: {
	field: FormField
	index: number
	total: number
	isActive: boolean
	onFocus: () => void
	onUpdate: (updates: Partial<FormField>) => void
	onRemove: () => void
	onMove: (direction: number) => void
	onAddAfter: () => void
}) {
	const needsOptions = ['select', 'radio', 'checkbox'].includes(field.type)

	return (
		<div
			onClick={onFocus}
			className={`rounded-2xl border bg-white dark:bg-surface-elevated-dark p-4 sm:p-5 transition-smooth cursor-pointer ${
				isActive
					? 'border-brand-300 dark:border-brand-700 shadow-sm shadow-brand-100 dark:shadow-none'
					: 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
			}`}
		>
			<div className="flex items-start gap-3">
				{/* Reorder / drag handle */}
				<div className="flex flex-col items-center gap-0.5 pt-1.5 opacity-40 hover:opacity-100 transition-smooth">
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

					{/* Bottom controls */}
					{isActive && (
						<div className="flex items-center justify-between pt-1 animate-fade-in">
							<div className="flex items-center gap-4">
								<label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
									<input
										type="checkbox"
										checked={field.required}
										onChange={(e) => onUpdate({ required: e.target.checked })}
										className="rounded border-gray-300"
									/>
									Required
								</label>
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
