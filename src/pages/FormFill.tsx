import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, ArrowRight, Check, Send, Star, X, RotateCcw, Upload, Trash2 } from 'lucide-react'
import type { FormField, FormSettings } from '../types'
import { isFieldVisible, pipeValues, getFieldText, isRtlLanguage, LANGUAGES } from '../types'
import { evaluateFormula } from '../utils/formula'
import { getThemeCSSVars } from '../themes'
import { PoweredByBadge } from '../components/shared/PoweredByBadge'
import { setPageMeta } from '../utils/meta'
import { InlineLoader } from '../components/shared/BrandLoader'

interface Props {
	formId: string
	navigate: (path: string) => void
}

// localStorage key for progress saving
function progressKey(formId: string) {
	return `koraforms-progress-${formId}`
}

// Simple string hash for duplicate detection
function simpleHash(str: string): number {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i)
		hash = ((hash << 5) - hash) + ch
		hash = hash & hash // Convert to 32-bit integer
	}
	return hash
}

export function FormFill({ formId, navigate }: Props) {
	// Fetch form from the public API (no Kora sync required)
	const [form, setForm] = useState<Record<string, unknown> | null>(null)
	const [remoteFetched, setRemoteFetched] = useState(false)

	useEffect(() => {
		const controller = new AbortController()
		fetch(`/api/public/forms/${encodeURIComponent(formId)}`, { signal: controller.signal })
			.then((res) => {
				if (res.ok) return res.json()
				return null
			})
			.then((data) => {
				if (data && !data.error) setForm(data)
			})
			.catch(() => {
				// Fetch failed (offline, network error)
			})
			.finally(() => setRemoteFetched(true))
		return () => controller.abort()
	}, [formId])

	// Set page meta when form loads (for client-side navigation and tab title)
	useEffect(() => {
		if (form) {
			setPageMeta({
				title: String(form.title || 'Form'),
				description: String(form.description || 'Fill out this form on KoraForms.'),
				url: `https://forms.korajs.dev/f/${formId}`,
			})
		}
	}, [form, formId])

	const submitResponse = useCallback(async (realFormId: string, responseData: string) => {
		// Submit via REST API — no Kora worker needed
		const res = await fetch('/api/public/responses', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ formId: realFormId, data: responseData }),
		})
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: 'Unknown error' }))
			throw new Error(err.error || 'Failed to submit response')
		}
	}, [])

	const [currentIndex, setCurrentIndex] = useState(-1) // -1 = welcome screen
	const [values, setValues] = useState<Record<string, string>>({})
	const [errors, setErrors] = useState<Record<string, string>>({})
	const [submitted, setSubmitted] = useState(false)
	const [direction, setDirection] = useState<'forward' | 'back'>('forward')
	const [showResumePrompt, setShowResumePrompt] = useState(false)
	const [savedProgress, setSavedProgress] = useState<{ values: Record<string, string>; currentIndex: number; savedAt: number } | null>(null)
	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [language, setLanguage] = useState<string | undefined>(undefined)
	const startedAtRef = useRef<number>(0)
	const [passwordUnlocked, setPasswordUnlocked] = useState(false)
	const [passwordInput, setPasswordInput] = useState('')
	const [passwordError, setPasswordError] = useState(false)

	let fields: FormField[] = []
	try {
		fields = JSON.parse(String(form?.fields || '[]'))
	} catch {
		// ignore
	}

	// Parse form settings
	let settings: FormSettings = {}
	try {
		settings = JSON.parse(String(form?.settings || '{}'))
	} catch {
		// ignore
	}

	const themeVars = getThemeCSSVars(String(form?.theme || 'blue'))

	// Compute visible fields based on conditional logic
	const visibleFields = fields.filter(f => isFieldVisible(f, values))

	// Display-only / non-interactive field types
	const isDisplayOnly = (type: string) => type === 'section' || type === 'statement' || type === 'hidden'
	const totalQuestions = visibleFields.filter((f) => !isDisplayOnly(f.type)).length

	// Auto-populate calculated and hidden field values
	useEffect(() => {
		let changed = false
		const next = { ...values }
		for (const field of fields) {
			if (field.type === 'calculated' && field.formula) {
				const result = evaluateFormula(field.formula, values, fields)
				if (result !== (values[field.id] || '')) {
					next[field.id] = result
					changed = true
				}
			}
			if (field.type === 'hidden' && field.defaultValue && !values[field.id]) {
				next[field.id] = field.defaultValue
				changed = true
			}
		}
		if (changed) setValues(next)
	}, [values, fields]) // eslint-disable-line react-hooks/exhaustive-deps
	const questionNumber =
		currentIndex >= 0 && currentIndex < visibleFields.length
			? visibleFields.slice(0, currentIndex + 1).filter((f) => !isDisplayOnly(f.type)).length
			: 0

	const progress = visibleFields.length > 0 ? Math.max(0, (currentIndex / visibleFields.length) * 100) : 0

	// URL pre-fill — seed initial values from query params
	useEffect(() => {
		if (!form || fields.length === 0) return
		const searchParams = new URLSearchParams(window.location.search)
		if (searchParams.size === 0) return
		const prefill: Record<string, string> = {}
		for (const [key, val] of searchParams) {
			if (key === 'embed') continue
			// Try matching by field ID
			if (fields.find(f => f.id === key)) {
				prefill[key] = val
			} else {
				// Try matching by label (case-insensitive, spaces → underscores)
				const match = fields.find(f =>
					f.label.toLowerCase().replace(/\s+/g, '_') === key.toLowerCase()
				)
				if (match) prefill[match.id] = val
			}
		}
		if (Object.keys(prefill).length > 0) {
			setValues(prev => ({ ...prefill, ...prev }))
		}
	}, [form?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	// Progress saving — check for saved progress on mount
	useEffect(() => {
		if (!form) return
		try {
			const raw = localStorage.getItem(progressKey(formId))
			if (raw) {
				const parsed = JSON.parse(raw)
				if (parsed.values && Object.keys(parsed.values).length > 0) {
					setSavedProgress(parsed)
					setShowResumePrompt(true)
				}
			}
		} catch {
			// ignore
		}
	}, [form?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	// Progress saving — auto-save on every answer change (debounced)
	useEffect(() => {
		if (!form || submitted || currentIndex < 0) return
		if (Object.keys(values).length === 0) return
		const timer = setTimeout(() => {
			localStorage.setItem(progressKey(formId), JSON.stringify({
				values,
				currentIndex,
				savedAt: Date.now(),
			}))
		}, 500)
		return () => clearTimeout(timer)
	}, [values, currentIndex, form, submitted, formId])

	// Focus input when question changes
	useEffect(() => {
		if (currentIndex >= 0) {
			setTimeout(() => inputRef.current?.focus(), 350)
		}
	}, [currentIndex])

	// Check if form is closed (client-side)
	const isFormClosed = () => {
		if (settings.closesAt && Date.now() > settings.closesAt) return true
		if (settings.opensAt && Date.now() < settings.opensAt) return true
		return false
	}

	const validateCurrent = useCallback((): boolean => {
		if (currentIndex < 0 || currentIndex >= visibleFields.length) return true
		const field = visibleFields[currentIndex]!
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
	}, [currentIndex, visibleFields, values, errors])

	const [submitError, setSubmitError] = useState('')

	const goNext = useCallback(() => {
		if (currentIndex === -1) {
			setDirection('forward')
			setCurrentIndex(0)
			if (!startedAtRef.current) startedAtRef.current = Date.now()
			return
		}
		if (!validateCurrent()) return

		if (currentIndex < visibleFields.length - 1) {
			setDirection('forward')
			setCurrentIndex(currentIndex + 1)
		} else {
			const realFormId = String(form?.id || formId)
			// Attach metadata for analytics
			const ua = navigator.userAgent
			const meta = {
				startedAt: startedAtRef.current || Date.now(),
				completedAt: Date.now(),
				duration: startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0,
				ua,
				screen: `${window.screen.width}x${window.screen.height}`,
				lang: navigator.language,
			}
			const responseJson = JSON.stringify({ ...values, _meta: meta })

			// Duplicate detection — warn if identical response submitted within 5 minutes
			const dupKey = `koraforms-dup-${formId}`
			try {
				const lastSubmit = localStorage.getItem(dupKey)
				if (lastSubmit) {
					const { hash, time } = JSON.parse(lastSubmit)
					const responseHash = simpleHash(responseJson)
					if (hash === responseHash && Date.now() - time < 5 * 60 * 1000) {
						const confirmed = window.confirm('It looks like you already submitted this exact response. Submit again?')
						if (!confirmed) return
					}
				}
			} catch { /* ignore */ }

			setSubmitError('')
			setIsSubmitting(true)
			submitResponse(realFormId, responseJson)
				.then(() => {
					setSubmitted(true)
					// Clear saved progress on successful submission
					localStorage.removeItem(progressKey(formId))
					// Store hash for duplicate detection
					localStorage.setItem(dupKey, JSON.stringify({ hash: simpleHash(responseJson), time: Date.now() }))
				})
				.catch((err) => setSubmitError(err.message || 'Failed to submit. Please try again.'))
				.finally(() => setIsSubmitting(false))
		}
	}, [currentIndex, visibleFields.length, formId, values, form, validateCurrent, submitResponse])

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

	// Enhanced keyboard navigation
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			// Enter → next question
			if (e.key === 'Enter' && !e.shiftKey) {
				const tag = (e.target as HTMLElement)?.tagName
				if (tag === 'TEXTAREA') return // Allow newlines in textarea
				e.preventDefault()
				goNext()
				return
			}
			// Shift+Enter → previous question
			if (e.key === 'Enter' && e.shiftKey) {
				e.preventDefault()
				goBack()
				return
			}
			// Escape → exit
			if (e.key === 'Escape') {
				navigate('dashboard')
				return
			}
			// Number keys 1-9 for radio/select/checkbox options
			if (currentIndex >= 0 && currentIndex < visibleFields.length) {
				const field = visibleFields[currentIndex]!
				if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey && !e.altKey) {
					const tag = (e.target as HTMLElement)?.tagName
					if (tag === 'INPUT' || tag === 'TEXTAREA') return
					if (['select', 'radio'].includes(field.type)) {
						const options = (field.options || '').split(',').map(o => o.trim()).filter(Boolean)
						const idx = parseInt(e.key) - 1
						if (idx < options.length) {
							e.preventDefault()
							setValue(field.id, options[idx]!)
						}
					} else if (field.type === 'checkbox') {
						const options = (field.options || '').split(',').map(o => o.trim()).filter(Boolean)
						const idx = parseInt(e.key) - 1
						if (idx < options.length) {
							e.preventDefault()
							const opt = options[idx]!
							const selected = values[field.id] ? values[field.id]!.split(',') : []
							const next = selected.includes(opt)
								? selected.filter(s => s !== opt)
								: [...selected, opt]
							setValue(field.id, next.join(','))
						}
					}
				}
				// Y/N for yes/no fields
				if (field.type === 'yesno' && !e.ctrlKey && !e.metaKey && !e.altKey) {
					const tag = (e.target as HTMLElement)?.tagName
					if (tag === 'INPUT' || tag === 'TEXTAREA') return
					if (e.key.toLowerCase() === 'y') {
						e.preventDefault()
						setValue(field.id, 'yes')
					} else if (e.key.toLowerCase() === 'n') {
						e.preventDefault()
						setValue(field.id, 'no')
					}
				}
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [goNext, currentIndex, visibleFields, values]) // eslint-disable-line react-hooks/exhaustive-deps

	// Inject custom CSS if present
	useEffect(() => {
		if (!settings.customCSS) return
		const style = document.createElement('style')
		style.setAttribute('data-kf-custom', 'true')
		style.textContent = settings.customCSS
		document.head.appendChild(style)
		return () => { style.remove() }
	}, [settings.customCSS])

	// Embed mode — minimal chrome
	const isEmbed = new URLSearchParams(window.location.search).get('embed') === '1'

	if (!form) {
		if (!remoteFetched) {
			return <InlineLoader message="Loading form..." />
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

	// Form closed check (client-side)
	if (isFormClosed()) {
		return (
			<div className="flex items-center justify-center min-h-screen px-4" style={themeVars as React.CSSProperties}>
				<div className="text-center animate-fade-in max-w-md">
					<div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-6">
						<X className="h-8 w-8 text-gray-400" />
					</div>
					<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
						Form Closed
					</h2>
					<p className="text-gray-500 dark:text-gray-400 leading-relaxed">
						{settings.closedMessage || 'This form is no longer accepting responses.'}
					</p>
				</div>
			</div>
		)
	}

	// Password protection gate (server-side verification)
	if ((form as Record<string, unknown>).passwordProtected && !passwordUnlocked) {
		return (
			<div className="kf-form flex items-center justify-center min-h-screen px-4" style={themeVars as React.CSSProperties}>
				<div className="text-center animate-fade-in max-w-sm w-full">
					<div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mx-auto mb-5">
						<svg className="h-6 w-6 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
						</svg>
					</div>
					<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
						This form is protected
					</h2>
					<p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
						Enter the password to access this form.
					</p>
					<form onSubmit={async (e) => {
						e.preventDefault()
						setPasswordError(false)
						try {
							const res = await fetch(`/api/public/forms/${encodeURIComponent(formId)}`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ password: passwordInput }),
							})
							if (res.ok) {
								const fullForm = await res.json()
								setForm(fullForm)
								setPasswordUnlocked(true)
							} else {
								setPasswordError(true)
							}
						} catch {
							setPasswordError(true)
						}
					}}>
						<input
							type="password"
							value={passwordInput}
							onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false) }}
							placeholder="Enter password"
							autoFocus
							className={`w-full rounded-xl border-2 px-4 py-3 text-center text-sm outline-none transition-smooth ${
								passwordError
									? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
									: 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:border-brand-400 dark:focus:border-brand-600'
							}`}
						/>
						{passwordError && (
							<p className="mt-2 text-sm text-red-500 animate-fade-in">Incorrect password</p>
						)}
						<button
							type="submit"
							className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow-sm shadow-brand-600/25 transition-smooth hover:bg-brand-500 active:scale-[0.98]"
						>
							Continue
						</button>
					</form>
				</div>
			</div>
		)
	}

	// Resume prompt overlay
	if (showResumePrompt && savedProgress) {
		const savedTime = new Date(savedProgress.savedAt).toLocaleString()
		return (
			<div className="flex items-center justify-center min-h-screen px-4" style={themeVars as React.CSSProperties}>
				<div className="text-center max-w-md animate-scale-in">
					<div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mx-auto mb-5">
						<RotateCcw className="h-6 w-6 text-brand-600 dark:text-brand-400" />
					</div>
					<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
						Resume your progress?
					</h2>
					<p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
						You have saved progress from {savedTime}
					</p>
					<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
						<button
							onClick={() => {
								setValues(savedProgress.values)
								setCurrentIndex(savedProgress.currentIndex)
								setShowResumePrompt(false)
							}}
							className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-medium text-white transition-smooth hover:bg-brand-500 active:scale-[0.98]"
						>
							Resume
						</button>
						<button
							onClick={() => {
								localStorage.removeItem(progressKey(formId))
								setShowResumePrompt(false)
							}}
							className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 px-6 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 transition-smooth hover:border-gray-300 active:scale-[0.98]"
						>
							Start fresh
						</button>
					</div>
				</div>
			</div>
		)
	}

	// Submitted screen — custom thank-you page support
	if (submitted) {
		const customMessage = settings.thankYouMessage
		const redirectUrl = settings.redirectUrl
		const allowMultiple = settings.allowMultiple !== false // default true

		return (
			<SubmittedScreen
				themeVars={themeVars}
				customMessage={customMessage}
				redirectUrl={redirectUrl}
				redirectDelay={settings.redirectDelay || 3}
				allowMultiple={allowMultiple}
				showResultsLink={settings.publicResults && settings.showResultsAfterSubmit}
				formSlug={String(form?.slug || formId)}
				onReset={() => {
					setValues({})
					setSubmitted(false)
					setCurrentIndex(-1)
				}}
			/>
		)
	}

	// Welcome screen
	if (currentIndex === -1) {
		return (
			<div className="kf-form flex flex-col min-h-screen" style={themeVars as React.CSSProperties}>
				{/* Progress bar */}
				<div className="fixed top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-800 z-50">
					<div
						className="h-full bg-brand-500 transition-all duration-500 ease-out"
						style={{ width: '0%' }}
					/>
				</div>

				{/* Back button */}
				{!isEmbed && (
					<div className="p-4">
						<button
							onClick={() => navigate('dashboard')}
							className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
						>
							<ArrowLeft className="h-4 w-4" />
							Exit
						</button>
					</div>
				)}

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
						{/* Language picker */}
						{settings.languages && settings.languages.length > 1 && (
							<div className="flex flex-wrap items-center justify-center gap-2 mb-8">
								{settings.languages.map(code => {
									const lang = LANGUAGES.find(l => l.code === code)
									return (
										<button
											key={code}
											onClick={() => setLanguage(code)}
											className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-smooth ${
												(language || settings.defaultLanguage || settings.languages![0]) === code
													? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800'
													: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
											}`}
										>
											{lang?.name || code}
										</button>
									)
								})}
							</div>
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
	const field = visibleFields[currentIndex]!
	const isLast = currentIndex === visibleFields.length - 1
	const error = errors[field.id]

	// Get translated text (label, placeholder, options) for current language
	const fieldText = getFieldText(field, language)
	// Apply answer piping to label
	const pipedLabel = pipeValues(fieldText.label, values, fields)
	// Determine text direction
	const isRtl = language ? isRtlLanguage(language) : false

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
					{!isEmbed && (
						<button
							onClick={() => navigate('dashboard')}
							className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
						>
							<X className="h-4 w-4" />
							Exit
						</button>
					)}
				</div>

				<div className="flex-1 flex items-center justify-center px-4">
					<div className={`text-center max-w-lg ${direction === 'forward' ? 'animate-slide-up' : 'animate-fade-in'}`}>
						<h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">
							{pipedLabel || 'Section'}
						</h2>
						{field.placeholder && (
							<p className="text-lg text-gray-500 dark:text-gray-400 mb-10 leading-relaxed">
								{pipeValues(fieldText.placeholder || field.placeholder || '', values, fields)}
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
					{!isEmbed && (
						<button
							onClick={() => navigate('dashboard')}
							className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
						>
							<X className="h-4 w-4" />
							Exit
						</button>
					)}
				</div>

				<div className="flex-1 flex items-center justify-center px-4 sm:px-8">
					<div className={`w-full max-w-lg ${direction === 'forward' ? 'animate-slide-up' : 'animate-fade-in'}`}>
						<div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6 sm:p-8">
							<h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3 leading-snug">
								{pipedLabel || 'Information'}
							</h2>
							{field.placeholder && (
								<p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed">
									{pipeValues(fieldText.placeholder || field.placeholder || '', values, fields)}
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
		<div className="kf-form flex flex-col min-h-screen" style={themeVars as React.CSSProperties}>
			{/* Progress bar */}
			<div className="fixed top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-800 z-50">
				<div
					className="h-full bg-brand-500 transition-all duration-500 ease-out"
					style={{ width: `${progress}%` }}
				/>
			</div>

			{/* Top bar — exit + counter */}
			<div className="flex items-center justify-between p-4">
				{!isEmbed ? (
					<button
						onClick={() => navigate('dashboard')}
						className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
					>
						<X className="h-4 w-4" />
						Exit
					</button>
				) : <span />}
				<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
					{questionNumber} of {totalQuestions}
				</span>
			</div>

			{/* Question content */}
			<div className="flex-1 flex items-center justify-center px-4 sm:px-8" dir={isRtl ? 'rtl' : undefined}>
				<div
					key={field.id}
					className={`kf-question w-full max-w-lg ${direction === 'forward' ? 'animate-slide-up' : 'animate-fade-in'}`}
				>
					{/* Question number + label */}
					<div className="mb-6">
						<span className="text-sm font-medium text-brand-500 mb-2 block">
							{questionNumber} →
						</span>
						<h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-snug">
							{pipedLabel || `Question ${questionNumber}`}
							{field.required && (
								<span className="text-red-400 ml-1">*</span>
							)}
						</h2>
					</div>

					{/* Input */}
					<div className={error ? 'animate-shake' : ''}>
						<QuestionInput
							field={{ ...field, options: fieldText.options || field.options, placeholder: fieldText.placeholder || field.placeholder }}
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
							disabled={isSubmitting}
							className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white shadow-sm transition-smooth active:scale-[0.98] disabled:opacity-60 ${
								isLast
									? 'bg-emerald-600 shadow-emerald-600/25 hover:bg-emerald-500'
									: 'bg-brand-600 shadow-brand-600/25 hover:bg-brand-500'
							}`}
						>
							{isSubmitting ? (
								'Submitting...'
							) : isLast ? (
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

					{/* Submission error */}
					{submitError && (
						<p className="mt-3 text-sm text-red-500 animate-fade-in">{submitError}</p>
					)}
				</div>
			</div>

			{/* Bottom bar */}
			<div className="p-4 flex justify-center items-center">
				<PoweredByBadge slug={String(form?.slug || formId)} />
			</div>
		</div>
	)
}

// Custom thank-you screen with redirect support
function SubmittedScreen({
	themeVars,
	customMessage,
	redirectUrl,
	redirectDelay,
	allowMultiple,
	showResultsLink,
	formSlug,
	onReset,
}: {
	themeVars: Record<string, string>
	customMessage?: string
	redirectUrl?: string
	redirectDelay: number
	allowMultiple: boolean
	showResultsLink?: boolean
	formSlug: string
	onReset: () => void
}) {
	const [countdown, setCountdown] = useState(redirectDelay)

	useEffect(() => {
		if (!redirectUrl) return
		if (countdown <= 0) {
			window.location.href = redirectUrl
			return
		}
		const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
		return () => clearTimeout(timer)
	}, [countdown, redirectUrl])

	return (
		<div className="flex items-center justify-center min-h-screen px-4" style={themeVars as React.CSSProperties}>
			<div className="text-center animate-scale-in max-w-md">
				<div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-6">
					<Check className="h-8 w-8 text-emerald-500" strokeWidth={2.5} />
				</div>
				<h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
					{customMessage ? '' : 'Thank you!'}
				</h2>
				{customMessage ? (
					<p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed whitespace-pre-line">
						{customMessage}
					</p>
				) : (
					<p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
						Your response has been submitted successfully.
					</p>
				)}
				{redirectUrl && (
					<p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
						Redirecting in {countdown}...
					</p>
				)}
				<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
					{allowMultiple && (
						<button
							onClick={onReset}
							className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-medium text-white transition-smooth hover:bg-brand-500 active:scale-[0.98]"
						>
							Submit another response
						</button>
					)}
					{showResultsLink && (
						<a
							href={`/f/${formSlug}/results`}
							className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 px-6 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 transition-smooth hover:border-gray-300 active:scale-[0.98]"
						>
							View results
						</a>
					)}
					{redirectUrl && (
						<a
							href={redirectUrl}
							className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 px-6 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 transition-smooth hover:border-gray-300 active:scale-[0.98]"
						>
							Continue now
						</a>
					)}
				</div>
				<div className="mt-10">
					<PoweredByBadge slug={formSlug} variant="prominent" />
				</div>
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

		case 'file':
			return <FileInput field={field} value={value} onChange={onChange} />

		case 'ranking': {
			const rankOptions = (field.options || '').split(',').map(o => o.trim()).filter(Boolean)
			return <RankingInput options={rankOptions} value={value} onChange={onChange} />
		}

		case 'matrix':
			return <MatrixInput field={field} value={value} onChange={onChange} />

		case 'calculated':
			return (
				<div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
					<p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
						{value || '—'}
					</p>
					<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Calculated automatically</p>
				</div>
			)

		// hidden fields don't render, section and statement are handled at screen level
		case 'hidden':
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

function FileInput({
	field,
	value,
	onChange,
}: {
	field: FormField
	value: string
	onChange: (value: string) => void
}) {
	const fileRef = useRef<HTMLInputElement>(null)
	const maxSize = (field.maxSize || 10) * 1024 * 1024 // Convert MB to bytes
	const [error, setError] = useState('')
	const [preview, setPreview] = useState<string | null>(value || null)

	const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		setError('')

		if (file.size > maxSize) {
			setError(`File too large. Max size: ${field.maxSize || 10}MB`)
			return
		}

		const reader = new FileReader()
		reader.onload = () => {
			const result = reader.result as string
			onChange(result)
			// Preview for images
			if (file.type.startsWith('image/')) {
				setPreview(result)
			} else {
				setPreview(null)
			}
		}
		reader.readAsDataURL(file)
	}

	const clear = () => {
		onChange('')
		setPreview(null)
		if (fileRef.current) fileRef.current.value = ''
	}

	return (
		<div>
			{value ? (
				<div className="space-y-3">
					{preview && preview.startsWith('data:image/') && (
						<div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
							<img src={preview} alt="Upload preview" className="max-h-48 w-full object-contain bg-gray-50 dark:bg-gray-800" />
						</div>
					)}
					<div className="flex items-center gap-2">
						<span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
							<Check className="h-3.5 w-3.5" />
							File attached
						</span>
						<button
							onClick={clear}
							className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-smooth"
						>
							<Trash2 className="h-3 w-3" />
							Remove
						</button>
					</div>
				</div>
			) : (
				<label className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 py-8 px-4 cursor-pointer hover:border-brand-400 dark:hover:border-brand-600 transition-smooth">
					<Upload className="h-8 w-8 text-gray-400 dark:text-gray-500" />
					<span className="text-sm text-gray-500 dark:text-gray-400">
						Click to upload or take a photo
					</span>
					{field.accept && (
						<span className="text-xs text-gray-400 dark:text-gray-500">
							Accepted: {field.accept}
						</span>
					)}
					<input
						ref={fileRef}
						type="file"
						accept={field.accept || 'image/*'}
						capture={field.capture}
						onChange={handleFile}
						className="hidden"
					/>
				</label>
			)}
			{error && (
				<p className="mt-2 text-sm text-red-500">{error}</p>
			)}
		</div>
	)
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

// Ranking — drag to reorder options
function RankingInput({
	options,
	value,
	onChange,
}: {
	options: string[]
	value: string
	onChange: (value: string) => void
}) {
	const [items, setItems] = useState<string[]>(() => {
		if (value) {
			try {
				const parsed = JSON.parse(value) as string[]
				if (Array.isArray(parsed) && parsed.length > 0) return parsed
			} catch { /* ignore */ }
		}
		return [...options]
	})
	const [dragIndex, setDragIndex] = useState<number | null>(null)

	const moveItem = (from: number, to: number) => {
		const next = [...items]
		const [moved] = next.splice(from, 1)
		next.splice(to, 0, moved!)
		setItems(next)
		onChange(JSON.stringify(next))
	}

	return (
		<div className="space-y-1.5">
			<p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Drag to reorder, or use the arrows</p>
			{items.map((item, i) => (
				<div
					key={`${item}-${i}`}
					draggable
					onDragStart={() => setDragIndex(i)}
					onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
					onDrop={() => { if (dragIndex !== null && dragIndex !== i) moveItem(dragIndex, i); setDragIndex(null) }}
					onDragEnd={() => setDragIndex(null)}
					className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-grab active:cursor-grabbing transition-smooth select-none ${
						dragIndex === i
							? 'border-brand-400 dark:border-brand-600 bg-brand-50 dark:bg-brand-900/20 opacity-60'
							: 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
					}`}
				>
					<span className="text-sm font-bold text-brand-500 dark:text-brand-400 tabular-nums w-6 text-center shrink-0">
						{i + 1}
					</span>
					<span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{item}</span>
					<div className="flex flex-col gap-0.5 shrink-0">
						<button
							onClick={(e) => { e.stopPropagation(); if (i > 0) moveItem(i, i - 1) }}
							disabled={i === 0}
							className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-smooth"
						>
							<ArrowLeft className="h-3 w-3 rotate-90" />
						</button>
						<button
							onClick={(e) => { e.stopPropagation(); if (i < items.length - 1) moveItem(i, i + 1) }}
							disabled={i === items.length - 1}
							className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-smooth"
						>
							<ArrowRight className="h-3 w-3 rotate-90" />
						</button>
					</div>
				</div>
			))}
		</div>
	)
}

// Matrix / grid — rows × columns with radio selection per row
function MatrixInput({
	field,
	value,
	onChange,
}: {
	field: FormField
	value: string
	onChange: (value: string) => void
}) {
	const rows = (field.matrixRows || '').split(',').map(r => r.trim()).filter(Boolean)
	const columns = (field.matrixColumns || '').split(',').map(c => c.trim()).filter(Boolean)

	let answers: Record<string, string> = {}
	try { if (value) answers = JSON.parse(value) } catch { /* ignore */ }

	const setAnswer = (row: string, col: string) => {
		const next = { ...answers, [row]: col }
		onChange(JSON.stringify(next))
	}

	if (rows.length === 0 || columns.length === 0) {
		return <p className="text-sm text-gray-400 italic">Matrix not configured</p>
	}

	return (
		<div className="overflow-x-auto -mx-2">
			<table className="w-full text-sm">
				<thead>
					<tr>
						<th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[120px]" />
						{columns.map(col => (
							<th key={col} className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[80px]">
								{col}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, ri) => (
						<tr key={row} className={ri % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}>
							<td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 font-medium">{row}</td>
							{columns.map(col => (
								<td key={col} className="px-3 py-3 text-center">
									<button
										onClick={() => setAnswer(row, col)}
										className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
											answers[row] === col
												? 'border-brand-500 bg-brand-500 shadow-sm shadow-brand-500/30'
												: 'border-gray-300 dark:border-gray-600 hover:border-brand-400 dark:hover:border-brand-500'
										}`}
									>
										{answers[row] === col && (
											<div className="w-full h-full flex items-center justify-center">
												<div className="w-2 h-2 rounded-full bg-white" />
											</div>
										)}
									</button>
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
