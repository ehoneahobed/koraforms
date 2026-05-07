import { useState, useEffect } from 'react'
import { useQuery, useMutation, useCollection } from '@korajs/react'
import {
	ArrowLeft,
	GripVertical,
	Plus,
	Save,
	Send,
	Trash2,
	ChevronDown,
} from 'lucide-react'
import { FIELD_TYPES, type FormField, type FieldType } from '../types'

interface Props {
	formId?: string
	navigate: (path: string) => void
}

export function FormBuilder({ formId, navigate }: Props) {
	const forms = useCollection('forms')
	const allForms = useQuery(forms.where({}).orderBy('createdAt', 'desc'))
	const form = allForms.find((f) => f.id === formId)

	const { mutate: updateForm } = useMutation((id: string, data: Record<string, unknown>) =>
		forms.update(id, data),
	)

	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [fields, setFields] = useState<FormField[]>([])
	const [loaded, setLoaded] = useState(false)

	// Load form data when available
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

	if (!formId || (!form && loaded)) {
		return (
			<div className="text-center py-16 text-gray-500">
				Form not found.{' '}
				<button onClick={() => navigate('')} className="text-indigo-400 hover:underline">
					Go back
				</button>
			</div>
		)
	}

	if (!loaded) {
		return <div className="text-center py-16 text-gray-500">Loading...</div>
	}

	const save = () => {
		updateForm(formId, {
			title: title || 'Untitled Form',
			description,
			fields: JSON.stringify(fields),
		})
	}

	const publish = () => {
		updateForm(formId, {
			title: title || 'Untitled Form',
			description,
			fields: JSON.stringify(fields),
			status: 'published',
		})
		navigate('')
	}

	const addField = () => {
		const newField: FormField = {
			id: `field_${Date.now()}`,
			type: 'text',
			label: '',
			required: false,
		}
		setFields([...fields, newField])
	}

	const updateField = (index: number, updates: Partial<FormField>) => {
		const next = [...fields]
		next[index] = { ...next[index]!, ...updates }
		setFields(next)
	}

	const removeField = (index: number) => {
		setFields(fields.filter((_, i) => i !== index))
	}

	const moveField = (from: number, to: number) => {
		if (to < 0 || to >= fields.length) return
		const next = [...fields]
		const [item] = next.splice(from, 1)
		next.splice(to, 0, item!)
		setFields(next)
	}

	return (
		<div>
			{/* Top bar */}
			<div className="flex items-center justify-between mb-6">
				<button
					onClick={() => navigate('')}
					className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition"
				>
					<ArrowLeft className="h-4 w-4" />
					Back
				</button>
				<div className="flex items-center gap-2">
					<button
						onClick={save}
						className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700"
					>
						<Save className="h-4 w-4" />
						Save Draft
					</button>
					<button
						onClick={publish}
						className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
					>
						<Send className="h-4 w-4" />
						Publish
					</button>
				</div>
			</div>

			{/* Form title & description */}
			<div className="rounded-xl border border-gray-800 bg-gray-900 p-6 mb-6">
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="Form Title"
					className="w-full bg-transparent text-2xl font-bold outline-none placeholder-gray-600 mb-3"
				/>
				<input
					type="text"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Description (optional)"
					className="w-full bg-transparent text-gray-400 outline-none placeholder-gray-700"
				/>
			</div>

			{/* Fields */}
			<div className="space-y-3">
				{fields.map((field, index) => (
					<FieldEditor
						key={field.id}
						field={field}
						index={index}
						total={fields.length}
						onUpdate={(updates) => updateField(index, updates)}
						onRemove={() => removeField(index)}
						onMove={(dir) => moveField(index, index + dir)}
					/>
				))}
			</div>

			{/* Add field button */}
			<button
				onClick={addField}
				className="mt-4 w-full rounded-xl border border-dashed border-gray-700 py-4 text-gray-500 transition hover:border-indigo-500 hover:text-indigo-400 flex items-center justify-center gap-2"
			>
				<Plus className="h-4 w-4" />
				Add Field
			</button>

			{fields.length === 0 && (
				<p className="text-center text-gray-600 text-sm mt-4">
					Add fields to build your form. Each field becomes a question your respondents will answer.
				</p>
			)}
		</div>
	)
}

function FieldEditor({
	field,
	index,
	total,
	onUpdate,
	onRemove,
	onMove,
}: {
	field: FormField
	index: number
	total: number
	onUpdate: (updates: Partial<FormField>) => void
	onRemove: () => void
	onMove: (direction: number) => void
}) {
	const needsOptions = ['select', 'radio', 'checkbox'].includes(field.type)

	return (
		<div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
			<div className="flex items-start gap-3">
				{/* Drag handle / reorder */}
				<div className="flex flex-col items-center gap-1 pt-2">
					<button
						onClick={() => onMove(-1)}
						disabled={index === 0}
						className="text-gray-600 hover:text-gray-400 disabled:opacity-30"
					>
						<ChevronDown className="h-3 w-3 rotate-180" />
					</button>
					<GripVertical className="h-4 w-4 text-gray-700" />
					<button
						onClick={() => onMove(1)}
						disabled={index === total - 1}
						className="text-gray-600 hover:text-gray-400 disabled:opacity-30"
					>
						<ChevronDown className="h-3 w-3" />
					</button>
				</div>

				{/* Field config */}
				<div className="flex-1 space-y-3">
					<div className="flex gap-3">
						<input
							type="text"
							value={field.label}
							onChange={(e) => onUpdate({ label: e.target.value })}
							placeholder="Field label"
							className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
						/>
						<select
							value={field.type}
							onChange={(e) => onUpdate({ type: e.target.value as FieldType })}
							className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
						>
							{FIELD_TYPES.map((ft) => (
								<option key={ft.value} value={ft.value}>
									{ft.label}
								</option>
							))}
						</select>
					</div>

					{needsOptions && (
						<input
							type="text"
							value={field.options || ''}
							onChange={(e) => onUpdate({ options: e.target.value })}
							placeholder="Options (comma-separated, e.g.: Yes,No,Maybe)"
							className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
						/>
					)}

					<div className="flex items-center gap-4">
						<label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
							<input
								type="checkbox"
								checked={field.required}
								onChange={(e) => onUpdate({ required: e.target.checked })}
								className="rounded"
							/>
							Required
						</label>
						<input
							type="text"
							value={field.placeholder || ''}
							onChange={(e) => onUpdate({ placeholder: e.target.value })}
							placeholder="Placeholder text (optional)"
							className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-gray-400"
						/>
					</div>
				</div>

				{/* Delete */}
				<button
					onClick={onRemove}
					className="shrink-0 text-gray-600 hover:text-red-400 transition pt-2"
				>
					<Trash2 className="h-4 w-4" />
				</button>
			</div>
		</div>
	)
}
