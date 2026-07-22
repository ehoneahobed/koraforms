import type { FormField, FormSettings } from '../../types'
import { isFieldVisible } from '../../types'
import { isDisplayOnlyField } from '../../domain/forms'

export interface SavedProgress {
	values: Record<string, string>
	currentIndex: number
	savedAt: number
}

export interface SubmissionMeta {
	startedAt: number
	completedAt: number
	duration: number
	ua: string
	screen: string
	lang: string
}

export interface ValidationResult {
	valid: boolean
	error: string
}

export function progressStorageKey(formId: string): string {
	return `koraforms-progress-${formId}`
}

export function duplicateSubmissionStorageKey(formId: string): string {
	return `koraforms-dup-${formId}`
}

export function hashString(value: string): number {
	let hash = 0
	for (let i = 0; i < value.length; i++) {
		const charCode = value.charCodeAt(i)
		hash = ((hash << 5) - hash) + charCode
		hash &= hash
	}
	return hash
}

export function isDuplicateSubmission(
	previous: { hash?: number; time?: number },
	responseJson: string,
	now: number,
	windowMs = 5 * 60 * 1000,
): boolean {
	return previous.hash === hashString(responseJson) &&
		typeof previous.time === 'number' &&
		now - previous.time < windowMs
}

export function isFormUnavailable(settings: FormSettings, now: number): boolean {
	if (settings.closesAt && now > settings.closesAt) return true
	if (settings.opensAt && now < settings.opensAt) return true
	return false
}

export function countInteractiveQuestions(fields: FormField[]): number {
	return fields.filter(field => !isDisplayOnlyField(field)).length
}

export function questionNumberAtIndex(fields: FormField[], currentIndex: number): number {
	if (currentIndex < 0 || currentIndex >= fields.length) return 0
	return countInteractiveQuestions(fields.slice(0, currentIndex + 1))
}

export function progressForIndex(fields: FormField[], currentIndex: number): number {
	if (fields.length === 0) return 0
	return Math.max(0, (currentIndex / fields.length) * 100)
}

export function parseOptionList(value?: string): string[] {
	return String(value || '')
		.split(',')
		.map(option => option.trim())
		.filter(Boolean)
}

export function parseLabelList(value?: string): string[] {
	return String(value || '').split(',').map(label => label.trim())
}

export function parseSelectedOptions(value: string): string[] {
	return parseOptionList(value)
}

export function toggleSelectedOption(value: string, option: string): string {
	const selected = parseSelectedOptions(value)
	const next = selected.includes(option)
		? selected.filter(selectedOption => selectedOption !== option)
		: [...selected, option]
	return next.join(',')
}

export function optionForShortcutKey(options: string[], key: string): string | null {
	if (!/^[1-9]$/.test(key)) return null
	return options[Number(key) - 1] || null
}

export function yesNoValueForKey(key: string): 'yes' | 'no' | null {
	const normalized = key.toLowerCase()
	if (normalized === 'y') return 'yes'
	if (normalized === 'n') return 'no'
	return null
}

export function parseRankingValue(value: string, fallbackOptions: string[]): string[] {
	if (!value) return [...fallbackOptions]
	try {
		const parsed = JSON.parse(value) as unknown
		if (Array.isArray(parsed) && parsed.length > 0) {
			const allowed = new Set(fallbackOptions)
			const ranked = parsed
				.map(String)
				.filter((option, index, options) => allowed.has(option) && options.indexOf(option) === index)
			const missing = fallbackOptions.filter(option => !ranked.includes(option))
			return [...ranked, ...missing]
		}
	} catch {
		// Invalid saved ranking values fall back to the configured option order.
	}
	return [...fallbackOptions]
}

export function moveListItem(items: string[], from: number, to: number): string[] {
	if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) {
		return [...items]
	}
	const next = [...items]
	const [item] = next.splice(from, 1)
	if (item === undefined) return [...items]
	next.splice(to, 0, item)
	return next
}

export function parseMatrixAxis(value?: string): string[] {
	return parseOptionList(value)
}

export function parseMatrixAnswers(value: string): Record<string, string> {
	if (!value) return {}
	try {
		const parsed = JSON.parse(value) as unknown
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
		return Object.fromEntries(
			Object.entries(parsed as Record<string, unknown>)
				.filter(([, answer]) => typeof answer === 'string')
				.map(([row, answer]) => [row, answer as string]),
		)
	} catch {
		return {}
	}
}

export function buildPrefillValues(fields: FormField[], searchParams: URLSearchParams): Record<string, string> {
	const prefill: Record<string, string> = {}
	for (const [key, value] of searchParams) {
		if (key === 'embed' || key === 'resume') continue
		const exactMatch = fields.find(field => field.id === key)
		if (exactMatch) {
			prefill[exactMatch.id] = value
			continue
		}
		const normalizedKey = key.toLowerCase()
		const labelMatch = fields.find(field => field.label.toLowerCase().replace(/\s+/g, '_') === normalizedKey)
		if (labelMatch) prefill[labelMatch.id] = value
	}
	return prefill
}

export function normalizeSavedProgress(value: {
	values?: Record<string, string>
	currentIndex?: number
	savedAt?: number
}): SavedProgress | null {
	if (!value.values || Object.keys(value.values).length === 0) return null
	return {
		values: value.values,
		currentIndex: typeof value.currentIndex === 'number' ? value.currentIndex : -1,
		savedAt: typeof value.savedAt === 'number' ? value.savedAt : Date.now(),
	}
}

export function resumeIndexForValues(fields: FormField[], values: Record<string, string>): number {
	const visible = fields.filter(field => isFieldVisible(field, values))
	const firstUnanswered = visible.findIndex(field => !isDisplayOnlyField(field) && !values[field.id])
	if (firstUnanswered > 0) return firstUnanswered
	if (firstUnanswered === -1 && visible.length > 0) return visible.length - 1
	return 0
}

export function validateField(field: FormField, value: string): ValidationResult {
	if (isDisplayOnlyField(field)) return { valid: true, error: '' }

	if (field.required && !value.trim()) {
		return { valid: false, error: 'This field is required' }
	}
	if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
		return { valid: false, error: 'Please enter a valid email address' }
	}
	if (field.type === 'number' && value && !/^-?\d*\.?\d+$/.test(value)) {
		return { valid: false, error: 'Please enter a valid number' }
	}
	if (field.type === 'phone' && value) {
		const digitsOnly = value.replace(/\D/g, '')
		if (digitsOnly.length < 7) {
			return { valid: false, error: 'Please enter a valid phone number (at least 7 digits)' }
		}
	}
	if (field.type === 'url' && value && !/^https?:\/\/.+\..+/.test(value)) {
		return { valid: false, error: 'Please enter a valid URL (e.g. https://example.com)' }
	}
	if ((field.type === 'select' || field.type === 'radio') && field.required && !value) {
		return { valid: false, error: 'Please select an option' }
	}
	if (field.type === 'checkbox' && field.required && !value) {
		return { valid: false, error: 'Please select at least one option' }
	}
	if (field.type === 'signature' && field.required && !value) {
		return { valid: false, error: 'Please draw your signature' }
	}
	return { valid: true, error: '' }
}

export function buildSubmissionMeta(
	startedAt: number,
	now: number,
	env: { ua: string; screen: string; lang: string },
): SubmissionMeta {
	const effectiveStartedAt = startedAt || now
	return {
		startedAt: effectiveStartedAt,
		completedAt: now,
		duration: startedAt ? Math.round((now - startedAt) / 1000) : 0,
		ua: env.ua,
		screen: env.screen,
		lang: env.lang,
	}
}

export function buildResponseJson(values: Record<string, string>, meta: SubmissionMeta): string {
	return JSON.stringify({ ...values, _meta: meta })
}
