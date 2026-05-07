import { useState } from 'react'
import { useQuery, useMutation, useCollection } from '@korajs/react'
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react'
import type { FormField } from '../types'

interface Props {
	formId: string
	navigate: (path: string) => void
}

export function FormFill({ formId, navigate }: Props) {
	const forms = useCollection('forms')
	const responses = useCollection('responses')
	const allForms = useQuery(forms.where({}).orderBy('createdAt', 'desc'))
	const form = allForms.find((f) => f.id === formId)

	const { mutate: createResponse } = useMutation(
		(data: { formId: string; data: string; submittedBy: string }) => responses.insert(data),
	)
	const { mutate: updateForm } = useMutation((id: string, data: Record<string, unknown>) =>
		forms.update(id, data),
	)

	const [values, setValues] = useState<Record<string, string>>({})
	const [submitted, setSubmitted] = useState(false)
	const [errors, setErrors] = useState<Record<string, string>>({})

	if (!form) {
		return (
			<div className="text-center py-16 text-gray-500">
				Form not found.{' '}
				<button onClick={() => navigate('')} className="text-indigo-400 hover:underline">
					Go back
				</button>
			</div>
		)
	}

	let fields: FormField[] = []
	try {
		fields = JSON.parse(String(form.fields || '[]'))
	} catch {
		// ignore
	}

	const validate = (): boolean => {
		const newErrors: Record<string, string> = {}
		for (const field of fields) {
			if (field.required && !values[field.id]?.trim()) {
				newErrors[field.id] = 'This field is required'
			}
			if (field.type === 'email' && values[field.id]) {
				if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[field.id]!)) {
					newErrors[field.id] = 'Enter a valid email address'
				}
			}
			if (field.type === 'number' && values[field.id]) {
				if (isNaN(Number(values[field.id]))) {
					newErrors[field.id] = 'Enter a valid number'
				}
			}
		}
		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (!validate()) return

		createResponse({
			formId,
			data: JSON.stringify(values),
			submittedBy: '',
		})

		// Increment response count
		const currentCount = Number(form.responseCount) || 0
		updateForm(formId, { responseCount: currentCount + 1 })

		setSubmitted(true)
	}

	const setValue = (fieldId: string, value: string) => {
		setValues({ ...values, [fieldId]: value })
		if (errors[fieldId]) {
			setErrors({ ...errors, [fieldId]: '' })
		}
	}

	if (submitted) {
		return (
			<div className="text-center py-16">
				<CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
				<h2 className="text-2xl font-bold mb-2">Response Submitted</h2>
				<p className="text-gray-500 mb-6">
					Your response has been saved{' '}
					{navigator.onLine ? 'and will sync shortly.' : 'offline. It will sync when you reconnect.'}
				</p>
				<div className="flex items-center justify-center gap-3">
					<button
						onClick={() => {
							setValues({})
							setSubmitted(false)
						}}
						className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-500"
					>
						Submit Another
					</button>
					<button
						onClick={() => navigate('')}
						className="rounded-lg bg-gray-800 px-4 py-2 font-medium text-gray-300 transition hover:bg-gray-700"
					>
						Back to Forms
					</button>
				</div>
			</div>
		)
	}

	return (
		<div>
			<button
				onClick={() => navigate('')}
				className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition mb-6"
			>
				<ArrowLeft className="h-4 w-4" />
				Back
			</button>

			<div className="rounded-xl border border-gray-800 bg-gray-900 p-6 mb-6">
				<h2 className="text-2xl font-bold">{String(form.title)}</h2>
				{form.description && (
					<p className="text-gray-400 mt-1">{String(form.description)}</p>
				)}
			</div>

			<form onSubmit={handleSubmit} className="space-y-4">
				{fields.map((field) => (
					<div
						key={field.id}
						className="rounded-xl border border-gray-800 bg-gray-900 p-4"
					>
						<label className="block text-sm font-medium mb-2">
							{field.label || 'Untitled Field'}
							{field.required && <span className="text-red-400 ml-1">*</span>}
						</label>
						<FieldInput
							field={field}
							value={values[field.id] || ''}
							onChange={(v) => setValue(field.id, v)}
						/>
						{errors[field.id] && (
							<p className="text-sm text-red-400 mt-1">{errors[field.id]}</p>
						)}
					</div>
				))}

				{fields.length === 0 && (
					<p className="text-center text-gray-600 py-8">
						This form has no fields yet.
					</p>
				)}

				{fields.length > 0 && (
					<button
						type="submit"
						className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white transition hover:bg-indigo-500"
					>
						<Send className="h-4 w-4" />
						Submit Response
					</button>
				)}
			</form>
		</div>
	)
}

function FieldInput({
	field,
	value,
	onChange,
}: {
	field: FormField
	value: string
	onChange: (value: string) => void
}) {
	const baseClass =
		'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-indigo-500'

	switch (field.type) {
		case 'textarea':
			return (
				<textarea
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={field.placeholder}
					rows={3}
					className={baseClass + ' resize-y'}
				/>
			)

		case 'select': {
			const options = (field.options || '').split(',').map((o) => o.trim()).filter(Boolean)
			return (
				<select value={value} onChange={(e) => onChange(e.target.value)} className={baseClass}>
					<option value="">Select...</option>
					{options.map((opt) => (
						<option key={opt} value={opt}>
							{opt}
						</option>
					))}
				</select>
			)
		}

		case 'radio': {
			const options = (field.options || '').split(',').map((o) => o.trim()).filter(Boolean)
			return (
				<div className="flex flex-wrap gap-3">
					{options.map((opt) => (
						<label key={opt} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
							<input
								type="radio"
								name={field.id}
								value={opt}
								checked={value === opt}
								onChange={() => onChange(opt)}
							/>
							{opt}
						</label>
					))}
				</div>
			)
		}

		case 'checkbox': {
			const options = (field.options || '').split(',').map((o) => o.trim()).filter(Boolean)
			const selected = value ? value.split(',') : []
			return (
				<div className="flex flex-wrap gap-3">
					{options.map((opt) => (
						<label key={opt} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
							<input
								type="checkbox"
								checked={selected.includes(opt)}
								onChange={(e) => {
									const next = e.target.checked
										? [...selected, opt]
										: selected.filter((s) => s !== opt)
									onChange(next.join(','))
								}}
							/>
							{opt}
						</label>
					))}
				</div>
			)
		}

		case 'number':
			return (
				<input
					type="number"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={field.placeholder}
					className={baseClass}
				/>
			)

		case 'date':
			return (
				<input
					type="date"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className={baseClass}
				/>
			)

		case 'email':
			return (
				<input
					type="email"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={field.placeholder || 'email@example.com'}
					className={baseClass}
				/>
			)

		case 'phone':
			return (
				<input
					type="tel"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={field.placeholder || '+233 XX XXX XXXX'}
					className={baseClass}
				/>
			)

		default:
			return (
				<input
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={field.placeholder}
					className={baseClass}
				/>
			)
	}
}
