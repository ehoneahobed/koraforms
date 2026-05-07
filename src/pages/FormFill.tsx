import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useCollection } from '@korajs/react'
import { ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Send } from 'lucide-react'
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
		(data: { formId: string; data: string; submittedBy: string }) =>
			responses.insert(data),
	)
	const { mutate: updateForm } = useMutation(
		(id: string, data: Record<string, unknown>) => forms.update(id, data),
	)

	const [currentIndex, setCurrentIndex] = useState(-1) // -1 = welcome screen
	const [values, setValues] = useState<Record<string, string>>({})
	const [errors, setErrors] = useState<Record<string, string>>({})
	const [submitted, setSubmitted] = useState(false)
	const [direction, setDirection] = useState<'forward' | 'back'>('forward')
	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

	let fields: FormField[] = []
	try {
		fields = JSON.parse(String(form?.fields || '[]'))
	} catch {
		// ignore
	}

	const progress = fields.length > 0 ? Math.max(0, (currentIndex / fields.length) * 100) : 0

	// Focus input when question changes
	useEffect(() => {
		if (currentIndex >= 0) {
			setTimeout(() => inputRef.current?.focus(), 350)
		}
	}, [currentIndex])

	const validateCurrent = useCallback((): boolean => {
		if (currentIndex < 0 || currentIndex >= fields.length) return true
		const field = fields[currentIndex]!
		const value = values[field.id] || ''

		if (field.required && !value.trim()) {
			setErrors({ ...errors, [field.id]: 'This field is required' })
			return false
		}
		if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
			setErrors({ ...errors, [field.id]: 'Please enter a valid email address' })
			return false
		}
		if (field.type === 'number' && value) {
			if (!/^-?\d*\.?\d+$/.test(value)) {
				setErrors({ ...errors, [field.id]: 'Please enter a valid number' })
				return false
			}
		}
		if (field.type === 'phone' && value) {
			// Must have at least 7 digits
			const digitsOnly = value.replace(/\D/g, '')
			if (digitsOnly.length < 7) {
				setErrors({ ...errors, [field.id]: 'Please enter a valid phone number (at least 7 digits)' })
				return false
			}
		}
		if ((field.type === 'select' || field.type === 'radio') && field.required && !value) {
			setErrors({ ...errors, [field.id]: 'Please select an option' })
			return false
		}
		if (field.type === 'checkbox' && field.required && !value) {
			setErrors({ ...errors, [field.id]: 'Please select at least one option' })
			return false
		}

		setErrors({ ...errors, [field.id]: '' })
		return true
	}, [currentIndex, fields, values, errors])

	const goNext = useCallback(() => {
		if (currentIndex === -1) {
			setDirection('forward')
			setCurrentIndex(0)
			return
		}
		if (!validateCurrent()) return

		if (currentIndex < fields.length - 1) {
			setDirection('forward')
			setCurrentIndex(currentIndex + 1)
		} else {
			// Submit
			createResponse({
				formId,
				data: JSON.stringify(values),
				submittedBy: '',
			})
			const currentCount = Number(form?.responseCount) || 0
			updateForm(formId, { responseCount: currentCount + 1 })
			setSubmitted(true)
		}
	}, [currentIndex, fields.length, formId, values, form, validateCurrent, createResponse, updateForm])

	const goBack = () => {
		if (currentIndex > 0) {
			setDirection('back')
			setCurrentIndex(currentIndex - 1)
		} else if (currentIndex === 0) {
			setDirection('back')
			setCurrentIndex(-1)
		}
	}

	const setValue = (fieldId: string, value: string) => {
		setValues({ ...values, [fieldId]: value })
		if (errors[fieldId]) {
			setErrors({ ...errors, [fieldId]: '' })
		}
	}

	// Keyboard navigation
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				const tag = (e.target as HTMLElement)?.tagName
				if (tag === 'TEXTAREA') return // Allow newlines in textarea
				e.preventDefault()
				goNext()
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [goNext])

	if (!form) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center animate-fade-in">
					<p className="text-gray-500 text-lg mb-2">Form not found</p>
					<button
						onClick={() => navigate('dashboard')}
						className="text-brand-500 hover:underline text-sm"
					>
						Go back
					</button>
				</div>
			</div>
		)
	}

	// Submitted screen
	if (submitted) {
		return (
			<div className="flex items-center justify-center min-h-screen px-4">
				<div className="text-center animate-scale-in max-w-md">
					<div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-6">
						<Check className="h-8 w-8 text-emerald-500" strokeWidth={2.5} />
					</div>
					<h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
						Thank you!
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
						Your response has been saved
						{navigator.onLine
							? ' and synced.'
							: ' offline. It will sync automatically when you reconnect.'}
					</p>
					<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
						<button
							onClick={() => {
								setValues({})
								setSubmitted(false)
								setCurrentIndex(-1)
							}}
							className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-medium text-white transition-smooth hover:bg-brand-500 active:scale-[0.98]"
						>
							Submit another response
						</button>
						<button
							onClick={() => navigate('dashboard')}
							className="inline-flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-6 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 transition-smooth hover:bg-gray-200 dark:hover:bg-gray-700"
						>
							Back to forms
						</button>
					</div>
				</div>
			</div>
		)
	}

	// Welcome screen
	if (currentIndex === -1) {
		return (
			<div className="flex flex-col min-h-screen">
				{/* Progress bar */}
				<div className="fixed top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-800 z-50">
					<div
						className="h-full bg-brand-500 transition-all duration-500 ease-out"
						style={{ width: '0%' }}
					/>
				</div>

				{/* Back button */}
				<div className="p-4">
					<button
						onClick={() => navigate('dashboard')}
						className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
					>
						<ArrowLeft className="h-4 w-4" />
						Exit
					</button>
				</div>

				{/* Welcome content */}
				<div className="flex-1 flex items-center justify-center px-4">
					<div className="text-center max-w-lg animate-slide-up">
						<h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">
							{String(form.title)}
						</h1>
						{String(form.description || '') && (
							<p className="text-lg text-gray-500 dark:text-gray-400 mb-10 leading-relaxed">
								{String(form.description)}
							</p>
						)}
						<button
							onClick={goNext}
							className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-brand-600/25 transition-smooth hover:bg-brand-500 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98]"
						>
							Start
							<ArrowRight className="h-4 w-4" />
						</button>
						<p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
							{fields.length} question{fields.length !== 1 ? 's' : ''} &middot; Works offline
						</p>
					</div>
				</div>
			</div>
		)
	}

	// Question screen
	const field = fields[currentIndex]!
	const isLast = currentIndex === fields.length - 1
	const error = errors[field.id]

	return (
		<div className="flex flex-col min-h-screen">
			{/* Progress bar */}
			<div className="fixed top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-800 z-50">
				<div
					className="h-full bg-brand-500 transition-all duration-500 ease-out"
					style={{ width: `${progress}%` }}
				/>
			</div>

			{/* Top navigation */}
			<div className="flex items-center justify-between p-4">
				<button
					onClick={() => navigate('dashboard')}
					className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
				>
					<ArrowLeft className="h-4 w-4" />
					Exit
				</button>
				<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
					{currentIndex + 1} of {fields.length}
				</span>
			</div>

			{/* Question content */}
			<div className="flex-1 flex items-center justify-center px-4 sm:px-8">
				<div
					key={field.id}
					className={`w-full max-w-lg ${direction === 'forward' ? 'animate-slide-up' : 'animate-fade-in'}`}
				>
					{/* Question number + label */}
					<div className="mb-6">
						<span className="text-sm font-medium text-brand-500 mb-2 block">
							{currentIndex + 1} →
						</span>
						<h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-snug">
							{field.label || `Question ${currentIndex + 1}`}
							{field.required && (
								<span className="text-red-400 ml-1">*</span>
							)}
						</h2>
					</div>

					{/* Input */}
					<div className={error ? 'animate-shake' : ''}>
						<QuestionInput
							field={field}
							value={values[field.id] || ''}
							onChange={(v) => setValue(field.id, v)}
							inputRef={inputRef}
						/>
					</div>

					{/* Error */}
					{error && (
						<p className="mt-3 text-sm text-red-500 animate-fade-in">{error}</p>
					)}

					{/* Next / Submit button */}
					<div className="mt-8 flex items-center gap-3">
						<button
							onClick={goNext}
							className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white shadow-sm transition-smooth active:scale-[0.98] ${
								isLast
									? 'bg-emerald-600 shadow-emerald-600/25 hover:bg-emerald-500'
									: 'bg-brand-600 shadow-brand-600/25 hover:bg-brand-500'
							}`}
						>
							{isLast ? (
								<>
									Submit
									<Send className="h-3.5 w-3.5" />
								</>
							) : (
								<>
									OK
									<Check className="h-3.5 w-3.5" />
								</>
							)}
						</button>
						<span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
							press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono text-[10px]">Enter</kbd>
						</span>
					</div>
				</div>
			</div>

			{/* Bottom navigation */}
			<div className="p-4 flex justify-between items-center">
				<div className="flex gap-1">
					<button
						onClick={goBack}
						disabled={currentIndex <= 0}
						className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth disabled:opacity-30 disabled:cursor-not-allowed"
						aria-label="Previous question"
					>
						<ArrowUp className="h-4 w-4" />
					</button>
					<button
						onClick={goNext}
						className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth"
						aria-label="Next question"
					>
						<ChevronDown className="h-4 w-4" />
					</button>
				</div>
				<span className="text-[10px] text-gray-300 dark:text-gray-700">
					Powered by KoraForms
				</span>
			</div>
		</div>
	)
}

function QuestionInput({
	field,
	value,
	onChange,
	inputRef,
}: {
	field: FormField
	value: string
	onChange: (value: string) => void
	inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>
}) {
	const baseClass =
		'w-full border-0 border-b-2 border-gray-200 dark:border-gray-700 bg-transparent px-0 py-3 text-lg sm:text-xl outline-none focus:border-brand-500 dark:focus:border-brand-400 transition-smooth text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600'

	switch (field.type) {
		case 'textarea':
			return (
				<textarea
					ref={inputRef as React.RefObject<HTMLTextAreaElement>}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="Type your answer here..."
					rows={3}
					className={baseClass + ' resize-none'}
				/>
			)

		case 'select': {
			const options = (field.options || '').split(',').map((o) => o.trim()).filter(Boolean)
			return (
				<div className="space-y-2">
					{options.map((opt, i) => (
						<button
							key={opt}
							onClick={() => onChange(opt)}
							className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-smooth ${
								value === opt
									? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
									: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
							}`}
						>
							<span className="w-6 h-6 rounded-md border-2 border-current flex items-center justify-center text-xs font-medium shrink-0">
								{String.fromCharCode(65 + i)}
							</span>
							{opt}
							{value === opt && <Check className="h-4 w-4 ml-auto" />}
						</button>
					))}
				</div>
			)
		}

		case 'radio': {
			const options = (field.options || '').split(',').map((o) => o.trim()).filter(Boolean)
			return (
				<div className="space-y-2">
					{options.map((opt, i) => (
						<button
							key={opt}
							onClick={() => onChange(opt)}
							className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-smooth ${
								value === opt
									? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
									: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
							}`}
						>
							<span className="w-6 h-6 rounded-md border-2 border-current flex items-center justify-center text-xs font-medium shrink-0">
								{String.fromCharCode(65 + i)}
							</span>
							{opt}
							{value === opt && <Check className="h-4 w-4 ml-auto" />}
						</button>
					))}
				</div>
			)
		}

		case 'checkbox': {
			const options = (field.options || '').split(',').map((o) => o.trim()).filter(Boolean)
			const selected = value ? value.split(',') : []
			return (
				<div className="space-y-2">
					{options.map((opt, i) => {
						const isSelected = selected.includes(opt)
						return (
							<button
								key={opt}
								onClick={() => {
									const next = isSelected
										? selected.filter((s) => s !== opt)
										: [...selected, opt]
									onChange(next.join(','))
								}}
								className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-smooth ${
									isSelected
										? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
										: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
								}`}
							>
								<span className="w-6 h-6 rounded-md border-2 border-current flex items-center justify-center text-xs font-medium shrink-0">
									{isSelected ? <Check className="h-3.5 w-3.5" /> : String.fromCharCode(65 + i)}
								</span>
								{opt}
							</button>
						)
					})}
					<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
						Select all that apply
					</p>
				</div>
			)
		}

		case 'number':
			return (
				<input
					ref={inputRef as React.RefObject<HTMLInputElement>}
					type="text"
					inputMode="decimal"
					value={value}
					onChange={(e) => {
						// Only allow digits, decimal point, minus sign
						const v = e.target.value
						if (v === '' || v === '-' || /^-?\d*\.?\d*$/.test(v)) {
							onChange(v)
						}
					}}
					placeholder="Type a number..."
					className={baseClass}
				/>
			)

		case 'date':
			return (
				<input
					ref={inputRef as React.RefObject<HTMLInputElement>}
					type="date"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className={baseClass}
				/>
			)

		case 'email':
			return (
				<input
					ref={inputRef as React.RefObject<HTMLInputElement>}
					type="email"
					inputMode="email"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="name@example.com"
					className={baseClass}
				/>
			)

		case 'phone':
			return (
				<input
					ref={inputRef as React.RefObject<HTMLInputElement>}
					type="tel"
					inputMode="tel"
					value={value}
					onChange={(e) => {
						// Only allow digits, +, -, spaces, parentheses
						const v = e.target.value
						if (v === '' || /^[+\d\s()-]*$/.test(v)) {
							onChange(v)
						}
					}}
					placeholder="+233 XX XXX XXXX"
					className={baseClass}
				/>
			)

		default:
			return (
				<input
					ref={inputRef as React.RefObject<HTMLInputElement>}
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="Type your answer here..."
					className={baseClass}
				/>
			)
	}
}
