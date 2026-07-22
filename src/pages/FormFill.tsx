import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ArrowLeft, ArrowRight, Check, Send, X, RotateCcw, Link, Copy, Bookmark } from 'lucide-react'
import type { FormField, FormSettings } from '../types'
import { isFieldVisible, pipeValues, getFieldText, isRtlLanguage, LANGUAGES } from '../types'
import { evaluateFormula } from '../utils/formula'
import { getThemeCSSVars } from '../themes'
import { PoweredByBadge } from '../components/shared/PoweredByBadge'
import { QuestionInput } from '../components/form-fill/QuestionInput'
import { SubmittedScreen } from '../components/form-fill/SubmittedScreen'
import { setPageMeta } from '../utils/meta'
import { InlineLoader } from '../components/shared/BrandLoader'
import { isDisplayOnlyField, parseFormFields, parseFormSettings, safeJsonParse } from '../domain/forms'
import { readJsonFromStorage, removeStorageItem, writeJsonToStorage } from '../utils/storage'
import {
	buildPrefillValues,
	buildResponseJson,
	buildSubmissionMeta,
	countInteractiveQuestions,
	duplicateSubmissionStorageKey,
	hashString,
	isDuplicateSubmission,
	isFormUnavailable,
	normalizeSavedProgress,
	optionForShortcutKey,
	parseOptionList,
	progressStorageKey,
	progressForIndex,
	questionNumberAtIndex,
	resumeIndexForValues,
	toggleSelectedOption,
	validateField,
	yesNoValueForKey,
} from '../features/form-fill/flow'

interface Props {
	formId: string
	navigate: (path: string) => void
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
	const [resumeId, setResumeId] = useState<string | null>(null)
	const [showSaveLink, setShowSaveLink] = useState(false)
	const [resumeUrl, setResumeUrl] = useState('')
	const [isSaving, setIsSaving] = useState(false)

	const fields: FormField[] = useMemo(() => parseFormFields(form?.fields), [form?.fields])
	const settings: FormSettings = useMemo(() => parseFormSettings(form?.settings), [form?.settings])

	const themeVars = useMemo(() => getThemeCSSVars(String(form?.theme || 'red')), [form?.theme])

	// Compute visible fields based on conditional logic
	const visibleFields = useMemo(
		() => fields.filter(f => isFieldVisible(f, values)),
		[fields, values],
	)

	// Display-only / non-interactive field types
	const totalQuestions = countInteractiveQuestions(visibleFields)

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
	}, [values, fields])
	const questionNumber =
		currentIndex >= 0 && currentIndex < visibleFields.length
			? questionNumberAtIndex(visibleFields, currentIndex)
			: 0

	const progress = progressForIndex(visibleFields, currentIndex)

	// URL pre-fill — seed initial values from query params
	useEffect(() => {
		if (!form || fields.length === 0) return
		const searchParams = new URLSearchParams(window.location.search)
		if (searchParams.size === 0) return
		const prefill = buildPrefillValues(fields, searchParams)
		if (Object.keys(prefill).length > 0) {
			setValues(prev => ({ ...prefill, ...prev }))
		}
	}, [fields, form])

	// Progress saving — check for saved progress on mount
	useEffect(() => {
		if (!form) return
		try {
			const parsed = readJsonFromStorage<{ values?: Record<string, string>; currentIndex?: number; savedAt?: number }>(
				progressStorageKey(formId),
				{},
			)
			const progress = normalizeSavedProgress(parsed)
			if (progress) {
				setSavedProgress(progress)
				setShowResumePrompt(true)
			}
		} catch {
			// ignore
		}
	}, [form, formId])

	// Check for resume URL parameter (save & continue later)
	useEffect(() => {
		if (!form || fields.length === 0) return
		const searchParams = new URLSearchParams(window.location.search)
		const resume = searchParams.get('resume')
		if (!resume) return
		setResumeId(resume)
		fetch(`/api/public/partial/${encodeURIComponent(resume)}`)
			.then(res => res.ok ? res.json() : null)
			.then(data => {
				if (data?.data) {
					const saved = safeJsonParse<Record<string, string>>(data.data, {})
					setValues(saved)
					setCurrentIndex(resumeIndexForValues(fields, saved))
				}
			})
			.catch(() => {})
	}, [fields, form])

	// Save and continue later — POST current progress to server
	const saveAndContinueLater = useCallback(async () => {
		if (!form || Object.keys(values).length === 0) return
		setIsSaving(true)
		try {
			const realFormId = String(form.id || formId)
			const res = await fetch('/api/public/partial', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					formId: realFormId,
					data: JSON.stringify(values),
					resumeId: resumeId || undefined,
				}),
			})
			if (res.ok) {
				const result = await res.json()
				setResumeId(result.resumeId)
				setResumeUrl(result.resumeUrl)
				setShowSaveLink(true)
			}
		} catch {
			// Save failed silently — local progress still works
		} finally {
			setIsSaving(false)
		}
	}, [form, formId, values, resumeId])

	// Progress saving — auto-save on every answer change (debounced)
	useEffect(() => {
		if (!form || submitted || currentIndex < 0) return
		if (Object.keys(values).length === 0) return
		const timer = setTimeout(() => {
			writeJsonToStorage(progressStorageKey(formId), {
				values,
				currentIndex,
				savedAt: Date.now(),
			})
		}, 500)
		return () => clearTimeout(timer)
	}, [values, currentIndex, form, submitted, formId])

	// Focus input when question changes
	useEffect(() => {
		if (currentIndex >= 0) {
			setTimeout(() => inputRef.current?.focus(), 350)
		}
	}, [currentIndex])

	const validateCurrent = useCallback((): boolean => {
		if (currentIndex < 0 || currentIndex >= visibleFields.length) return true
		const field = visibleFields[currentIndex]!
		const value = values[field.id] || ''
		const result = validateField(field, value)
		if (!result.valid) {
			setErrors({ ...errors, [field.id]: result.error })
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
			const now = Date.now()
			const meta = buildSubmissionMeta(startedAtRef.current, now, {
				ua: navigator.userAgent,
				screen: `${window.screen.width}x${window.screen.height}`,
				lang: navigator.language,
			})
			const responseJson = buildResponseJson(values, meta)

			// Duplicate detection — warn if identical response submitted within 5 minutes
			const dupKey = duplicateSubmissionStorageKey(formId)
			try {
				const { hash, time } = readJsonFromStorage<{ hash?: number; time?: number }>(dupKey, {})
				if (isDuplicateSubmission({ hash, time }, responseJson, Date.now())) {
					const confirmed = window.confirm('It looks like you already submitted this exact response. Submit again?')
					if (!confirmed) return
				}
			} catch { /* ignore */ }

			setSubmitError('')
			setIsSubmitting(true)
			submitResponse(realFormId, responseJson)
				.then(() => {
					setSubmitted(true)
					// Clear saved progress on successful submission
					removeStorageItem(progressStorageKey(formId))
					// Store hash for duplicate detection
					writeJsonToStorage(dupKey, { hash: hashString(responseJson), time: Date.now() })
				})
				.catch((err) => setSubmitError(err.message || 'Failed to submit. Please try again.'))
				.finally(() => setIsSubmitting(false))
		}
	}, [currentIndex, visibleFields.length, formId, values, form, validateCurrent, submitResponse])

	const goBack = useCallback(() => {
		if (currentIndex > 0) {
			setDirection('back')
			setCurrentIndex(currentIndex - 1)
		} else if (currentIndex === 0) {
			setDirection('back')
			setCurrentIndex(-1)
		}
	}, [currentIndex])

	const setValue = useCallback((fieldId: string, value: string) => {
		setValues(currentValues => ({ ...currentValues, [fieldId]: value }))
		setErrors(currentErrors => {
			if (!currentErrors[fieldId]) return currentErrors
			return { ...currentErrors, [fieldId]: '' }
		})
	}, [])

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
						const option = optionForShortcutKey(parseOptionList(field.options), e.key)
						if (option) {
							e.preventDefault()
							setValue(field.id, option)
						}
					} else if (field.type === 'checkbox') {
						const option = optionForShortcutKey(parseOptionList(field.options), e.key)
						if (option) {
							e.preventDefault()
							setValue(field.id, toggleSelectedOption(values[field.id] || '', option))
						}
					}
				}
				// Y/N for yes/no fields
				if (field.type === 'yesno' && !e.ctrlKey && !e.metaKey && !e.altKey) {
					const tag = (e.target as HTMLElement)?.tagName
					if (tag === 'INPUT' || tag === 'TEXTAREA') return
					const nextValue = yesNoValueForKey(e.key)
					if (nextValue) {
						e.preventDefault()
						setValue(field.id, nextValue)
					}
				}
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [currentIndex, goBack, goNext, navigate, setValue, values, visibleFields])

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
	if (isFormUnavailable(settings, Date.now())) {
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
								removeStorageItem(progressStorageKey(formId))
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
			<div className="p-4 flex justify-center items-center gap-4">
				<button
					onClick={saveAndContinueLater}
					disabled={isSaving || Object.keys(values).length === 0}
					className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-smooth disabled:opacity-40"
				>
					<Bookmark className="h-3 w-3 inline mr-1" />
					{isSaving ? 'Saving...' : 'Save & continue later'}
				</button>
				<PoweredByBadge slug={String(form?.slug || formId)} />
			</div>

			{/* Save & continue later — resume URL overlay */}
			{showSaveLink && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
					<div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 mx-4 max-w-sm w-full animate-scale-in">
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-2">
								<div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
									<Link className="h-4 w-4 text-brand-600 dark:text-brand-400" />
								</div>
								<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Progress saved</h3>
							</div>
							<button
								onClick={() => setShowSaveLink(false)}
								className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-smooth"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
						<p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
							Use this link to continue from where you left off, on any device.
						</p>
						<div className="flex items-center gap-2">
							<input
								type="text"
								readOnly
								value={resumeUrl}
								className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 select-all outline-none"
								onFocus={(e) => e.target.select()}
							/>
							<button
								onClick={() => {
									navigator.clipboard.writeText(resumeUrl).catch(() => {})
								}}
								className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition-smooth hover:bg-brand-500 active:scale-[0.96]"
							>
								<Copy className="h-3 w-3" />
								Copy
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
