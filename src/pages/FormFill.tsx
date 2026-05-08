import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useCollection } from '@korajs/react'
import { ArrowLeft, ArrowRight, Check, Send, Star, X } from 'lucide-react'
import type { FormField } from '../types'
import { getThemeCSSVars } from '../themes'
import { PoweredByBadge } from '../components/shared/PoweredByBadge'

interface Props {
	formId: string
	navigate: (path: string) => void
}

export function FormFill({ formId, navigate }: Props) {
	const forms = useCollection('forms')
	const responses = useCollection('responses')
	const allForms = useQuery(forms.where({}).orderBy('createdAt', 'desc'))
	// Support lookup by ID or slug
	const localForm = allForms.find((f) => f.id === formId) ||
		allForms.find((f) => String(f.slug) === formId && String(f.status) === 'published')

	// If form not found locally, fetch from the public API (for unauthenticated visitors)
	const [remoteForm, setRemoteForm] = useState<Record<string, unknown> | null>(null)
	const [remoteFetched, setRemoteFetched] = useState(false)

	useEffect(() => {
		if (localForm || remoteFetched) return
		const controller = new AbortController()
		fetch(`/api/public/forms/${encodeURIComponent(formId)}`, { signal: controller.signal })
			.then((res) => {
				if (res.ok) return res.json()
				return null
			})
			.then((data) => {
				if (data && !data.error) setRemoteForm(data)
			})
			.catch(() => {
				// Fetch failed (offline, network error) — stay with local data
			})
			.finally(() => setRemoteFetched(true))
		return () => controller.abort()
	}, [formId, localForm, remoteFetched])

	const form = localForm || remoteForm

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

	const themeVars = getThemeCSSVars(String(form?.theme || 'indigo'))

	// Section breaks and statements are display-only — not counted as questions
	const isDisplayOnly = (type: string) => type === 'section' || type === 'statement'
	const totalQuestions = fields.filter((f) => !isDisplayOnly(f.type)).length
	const questionNumber =
		currentIndex >= 0
			? fields.slice(0, currentIndex + 1).filter((f) => !isDisplayOnly(f.type)).length
			: 0

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

		// Section and statement are display-only, always valid
		if (field.type === 'section' || field.type === 'statement') return true

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
		if (field.type === 'url' && value && !/^https?:\/\/.+\..+/.test(value)) {
			setErrors({ ...errors, [field.id]: 'Please enter a valid URL (e.g. https://example.com)' })
			return false
		}
		if ((field.type === 'select' || field.type === 'radio') && field.required && !value) {
			setErrors({ ...errors, [field.id]: 'Please select an option' })
			return false
		}
		if (field.type === 'checkbox' && field.required && !value) {
			setErrors({ ...errors, [field.id]: 'Please select at least one option' })
			return false
		}
		if (field.type === 'signature' && field.required && !value) {
			setErrors({ ...errors, [field.id]: 'Please draw your signature' })
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
			// Submit — use form.id (not the slug from the URL) as the real record ID
			const realFormId = String(form?.id || formId)
			createResponse({
				formId: realFormId,
				data: JSON.stringify(values),
				submittedBy: '',
			})
			const currentCount = Number(form?.responseCount) || 0
			updateForm(realFormId, { responseCount: currentCount + 1 })
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
		// Still loading from API — show a brief loading state
		if (!remoteFetched) {
			return (
				<div className="flex items-center justify-center min-h-screen">
					<div className="text-center animate-fade-in">
						<div className="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
						<p className="text-gray-400 text-sm">Loading form...</p>
					</div>
				</div>
			)
		}
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
			<div className="flex items-center justify-center min-h-screen px-4" style={themeVars as React.CSSProperties}>
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
					</div>
					<div className="mt-10">
						<PoweredByBadge slug={String(form?.slug || formId)} variant="prominent" />
					</div>
				</div>
			</div>
		)
	}

	// Welcome screen
	if (currentIndex === -1) {
		return (
			<div className="flex flex-col min-h-screen" style={themeVars as React.CSSProperties}>
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
							{totalQuestions} question{totalQuestions !== 1 ? 's' : ''} &middot; Works offline
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

	// Section break - full screen slide with title and description
	if (field.type === 'section') {
		return (
			<div className="flex flex-col min-h-screen" style={themeVars as React.CSSProperties}>
				{/* Progress bar */}
				<div className="fixed top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-800 z-50">
					<div
						className="h-full bg-brand-500 transition-all duration-500 ease-out"
						style={{ width: `${progress}%` }}
					/>
				</div>

				<div className="p-4 flex items-center justify-between">
					<button
						onClick={() => navigate('dashboard')}
						className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
					>
						<X className="h-4 w-4" />
						Exit
					</button>
				</div>

				<div className="flex-1 flex items-center justify-center px-4">
					<div className={`text-center max-w-lg ${direction === 'forward' ? 'animate-slide-up' : 'animate-fade-in'}`}>
						<h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">
							{field.label || 'Section'}
						</h2>
						{field.placeholder && (
							<p className="text-lg text-gray-500 dark:text-gray-400 mb-10 leading-relaxed">
								{field.placeholder}
							</p>
						)}
						<div className="flex items-center justify-center gap-3">
							{currentIndex > 0 && (
								<button
									onClick={goBack}
									className="inline-flex items-center gap-1.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 px-5 py-3.5 text-base font-medium text-gray-500 dark:text-gray-400 transition-smooth hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200 active:scale-[0.98]"
								>
									<ArrowLeft className="h-4 w-4" />
									Back
								</button>
							)}
							<button
								onClick={goNext}
								className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-brand-600/25 transition-smooth hover:bg-brand-500 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98]"
							>
								Continue
								<ArrowRight className="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>

				<div className="p-4 flex justify-center items-center">
					<span className="text-[10px] text-gray-300 dark:text-gray-700">
						Powered by KoraForms
					</span>
				</div>
			</div>
		)
	}

	// Statement - info block display
	if (field.type === 'statement') {
		return (
			<div className="flex flex-col min-h-screen" style={themeVars as React.CSSProperties}>
				{/* Progress bar */}
				<div className="fixed top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-800 z-50">
					<div
						className="h-full bg-brand-500 transition-all duration-500 ease-out"
						style={{ width: `${progress}%` }}
					/>
				</div>

				<div className="p-4 flex items-center justify-between">
					<button
						onClick={() => navigate('dashboard')}
						className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
					>
						<X className="h-4 w-4" />
						Exit
					</button>
				</div>

				<div className="flex-1 flex items-center justify-center px-4 sm:px-8">
					<div className={`w-full max-w-lg ${direction === 'forward' ? 'animate-slide-up' : 'animate-fade-in'}`}>
						<div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6 sm:p-8">
							<h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3 leading-snug">
								{field.label || 'Information'}
							</h2>
							{field.placeholder && (
								<p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed">
									{field.placeholder}
								</p>
							)}
						</div>
						<div className="mt-8 flex items-center gap-3">
							{currentIndex > 0 && (
								<button
									onClick={goBack}
									className="inline-flex items-center gap-1.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 transition-smooth hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200 active:scale-[0.98]"
								>
									<ArrowLeft className="h-3.5 w-3.5" />
									Back
								</button>
							)}
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
										Continue
										<ArrowRight className="h-3.5 w-3.5" />
									</>
								)}
							</button>
						</div>
					</div>
				</div>

				<div className="p-4 flex justify-center items-center">
					<span className="text-[10px] text-gray-300 dark:text-gray-700">
						Powered by KoraForms
					</span>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col min-h-screen" style={themeVars as React.CSSProperties}>
			{/* Progress bar */}
			<div className="fixed top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-800 z-50">
				<div
					className="h-full bg-brand-500 transition-all duration-500 ease-out"
					style={{ width: `${progress}%` }}
				/>
			</div>

			{/* Top bar — exit + counter */}
			<div className="flex items-center justify-between p-4">
				<button
					onClick={() => navigate('dashboard')}
					className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
				>
					<X className="h-4 w-4" />
					Exit
				</button>
				<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
					{questionNumber} of {totalQuestions}
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
							{questionNumber} →
						</span>
						<h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-snug">
							{field.label || `Question ${questionNumber}`}
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

					{/* Next / Submit + Back buttons */}
					<div className="mt-8 flex items-center gap-3">
						{currentIndex > 0 && (
							<button
								onClick={goBack}
								className="inline-flex items-center gap-1.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 transition-smooth hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200 active:scale-[0.98]"
							>
								<ArrowLeft className="h-3.5 w-3.5" />
								Back
							</button>
						)}
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

			{/* Bottom bar */}
			<div className="p-4 flex justify-center items-center">
				<PoweredByBadge slug={String(form?.slug || formId)} />
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

		case 'rating': {
			const currentRating = parseInt(value) || 0
			return (
				<div className="flex gap-2">
					{[1, 2, 3, 4, 5].map((star) => (
						<button
							key={star}
							onClick={() => onChange(String(star))}
							className="p-1 transition-smooth hover:scale-110 active:scale-95"
							aria-label={`${star} star${star !== 1 ? 's' : ''}`}
						>
							<Star
								className={`h-11 w-11 sm:h-12 sm:w-12 transition-smooth ${
									star <= currentRating
										? 'text-amber-400 fill-amber-400'
										: 'text-gray-300 dark:text-gray-600'
								}`}
							/>
						</button>
					))}
				</div>
			)
		}

		case 'scale': {
			const labels = (field.options || '').split(',').map((l) => l.trim())
			const lowLabel = labels[0] || ''
			const highLabel = labels[1] || ''
			return (
				<div>
					<div className="flex flex-wrap gap-2">
						{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
							<button
								key={num}
								onClick={() => onChange(String(num))}
								className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 text-sm font-semibold transition-smooth ${
									value === String(num)
										? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
										: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
								}`}
							>
								{num}
							</button>
						))}
					</div>
					{(lowLabel || highLabel) && (
						<div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-gray-500">
							<span>{lowLabel}</span>
							<span>{highLabel}</span>
						</div>
					)}
				</div>
			)
		}

		case 'yesno':
			return (
				<div className="flex gap-3">
					<button
						onClick={() => onChange('yes')}
						className={`flex-1 rounded-xl border-2 px-6 py-4 text-lg font-semibold transition-smooth ${
							value === 'yes'
								? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
								: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
						}`}
					>
						Yes
					</button>
					<button
						onClick={() => onChange('no')}
						className={`flex-1 rounded-xl border-2 px-6 py-4 text-lg font-semibold transition-smooth ${
							value === 'no'
								? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
								: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
						}`}
					>
						No
					</button>
				</div>
			)

		case 'time':
			return (
				<input
					ref={inputRef as React.RefObject<HTMLInputElement>}
					type="time"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className={baseClass}
				/>
			)

		case 'url':
			return (
				<input
					ref={inputRef as React.RefObject<HTMLInputElement>}
					type="url"
					inputMode="url"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="https://example.com"
					className={baseClass}
				/>
			)

		case 'signature':
			return <SignatureInput value={value} onChange={onChange} />

		// section and statement are handled at the screen level, not as inputs
		case 'section':
		case 'statement':
			return null

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

function SignatureInput({
	value,
	onChange,
}: {
	value: string
	onChange: (value: string) => void
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const isDrawingRef = useRef(false)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		// Set canvas dimensions
		const rect = canvas.getBoundingClientRect()
		canvas.width = rect.width * 2
		canvas.height = rect.height * 2
		ctx.scale(2, 2)
		ctx.lineCap = 'round'
		ctx.lineJoin = 'round'
		ctx.lineWidth = 2
		ctx.strokeStyle = document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#1f2937'

		// Restore existing signature if value exists
		if (value) {
			const img = new Image()
			img.onload = () => {
				ctx.drawImage(img, 0, 0, rect.width, rect.height)
			}
			img.src = value
		}
	}, []) // Only run once on mount

	const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
		const canvas = canvasRef.current
		if (!canvas) return { x: 0, y: 0 }
		const rect = canvas.getBoundingClientRect()
		if ('touches' in e) {
			return {
				x: e.touches[0]!.clientX - rect.left,
				y: e.touches[0]!.clientY - rect.top,
			}
		}
		return {
			x: (e as React.MouseEvent).clientX - rect.left,
			y: (e as React.MouseEvent).clientY - rect.top,
		}
	}

	const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
		e.preventDefault()
		isDrawingRef.current = true
		const canvas = canvasRef.current
		const ctx = canvas?.getContext('2d')
		if (!ctx) return
		const pos = getPosition(e)
		ctx.beginPath()
		ctx.moveTo(pos.x, pos.y)
	}

	const draw = (e: React.MouseEvent | React.TouchEvent) => {
		e.preventDefault()
		if (!isDrawingRef.current) return
		const canvas = canvasRef.current
		const ctx = canvas?.getContext('2d')
		if (!ctx) return
		const pos = getPosition(e)
		ctx.lineTo(pos.x, pos.y)
		ctx.stroke()
	}

	const stopDrawing = () => {
		if (!isDrawingRef.current) return
		isDrawingRef.current = false
		const canvas = canvasRef.current
		if (!canvas) return
		onChange(canvas.toDataURL('image/png'))
	}

	const clearSignature = () => {
		const canvas = canvasRef.current
		const ctx = canvas?.getContext('2d')
		if (!ctx || !canvas) return
		const rect = canvas.getBoundingClientRect()
		ctx.clearRect(0, 0, rect.width, rect.height)
		onChange('')
	}

	return (
		<div>
			<div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
				<canvas
					ref={canvasRef}
					className="w-full h-40 sm:h-48 cursor-crosshair touch-none"
					onMouseDown={startDrawing}
					onMouseMove={draw}
					onMouseUp={stopDrawing}
					onMouseLeave={stopDrawing}
					onTouchStart={startDrawing}
					onTouchMove={draw}
					onTouchEnd={stopDrawing}
				/>
			</div>
			<div className="flex items-center justify-between mt-2">
				<p className="text-xs text-gray-400 dark:text-gray-500">
					Draw your signature above
				</p>
				{value && (
					<button
						onClick={clearSignature}
						className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-smooth"
					>
						<X className="h-3 w-3" />
						Clear
					</button>
				)}
			</div>
		</div>
	)
}
