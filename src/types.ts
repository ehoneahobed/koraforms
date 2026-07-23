// Form field types supported by the form builder
export type FieldType = 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'rating' | 'scale' | 'yesno' | 'time' | 'url' | 'section' | 'statement' | 'signature' | 'file' | 'calculated' | 'hidden' | 'ranking' | 'matrix'

// Conditional logic — show/hide fields based on previous answers
export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'

export interface ConditionalRule {
	fieldId: string
	operator: ConditionOperator
	value: string
}

export const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
	{ value: 'equals', label: 'equals' },
	{ value: 'not_equals', label: 'does not equal' },
	{ value: 'contains', label: 'contains' },
	{ value: 'not_contains', label: 'does not contain' },
	{ value: 'is_empty', label: 'is empty' },
	{ value: 'is_not_empty', label: 'is not empty' },
	{ value: 'greater_than', label: 'is greater than' },
	{ value: 'less_than', label: 'is less than' },
]

export interface FormField {
	id: string
	type: FieldType
	label: string
	required: boolean
	placeholder?: string
	// For select, radio, checkbox — comma-separated options
	options?: string
	// Conditional visibility rules
	conditions?: ConditionalRule[]
	conditionLogic?: 'and' | 'or'
	// File upload config
	accept?: string          // e.g. 'image/*', '.pdf,.doc'
	maxSize?: number         // Max file size in MB (default: 10)
	capture?: 'environment' | 'user'  // Camera direction on mobile
	// Calculated / hidden field config
	formula?: string         // e.g. "{Number of guests} * 25"
	defaultValue?: string    // Static default for hidden fields
	// Matrix config — comma-separated rows and columns
	matrixRows?: string      // e.g. "Quality,Service,Price"
	matrixColumns?: string   // e.g. "Poor,Fair,Good,Excellent"
	// Multi-language translations
	translations?: Record<string, {
		label?: string
		placeholder?: string
		options?: string
	}>
}

// Form-level settings stored as JSON in the `settings` field
export interface FormSettings {
	// Thank-you page
	thankYouMessage?: string
	redirectUrl?: string
	redirectDelay?: number
	allowMultiple?: boolean
	// Response limits
	maxResponses?: number
	opensAt?: number
	closesAt?: number
	closedMessage?: string
	// Webhooks
	webhooks?: WebhookConfig[]
	// Public results
	publicResults?: boolean
	showResultsAfterSubmit?: boolean
	// Multi-language
	languages?: string[]
	defaultLanguage?: string
	// Custom branding
	customCSS?: string
	// Email notifications
	notifyEmail?: string
	// Archived flag
	archived?: boolean
}

export interface WebhookConfig {
	url: string
	method?: 'POST' | 'PUT'
	headers?: Record<string, string>
	active?: boolean
}

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
	{ value: 'text', label: 'Short Text' },
	{ value: 'textarea', label: 'Long Text' },
	{ value: 'number', label: 'Number' },
	{ value: 'email', label: 'Email' },
	{ value: 'phone', label: 'Phone' },
	{ value: 'date', label: 'Date' },
	{ value: 'select', label: 'Dropdown' },
	{ value: 'radio', label: 'Multiple Choice' },
	{ value: 'checkbox', label: 'Checkboxes' },
	{ value: 'rating', label: 'Rating' },
	{ value: 'scale', label: 'Linear Scale' },
	{ value: 'yesno', label: 'Yes / No' },
	{ value: 'time', label: 'Time' },
	{ value: 'url', label: 'Website URL' },
	{ value: 'section', label: 'Section Break' },
	{ value: 'statement', label: 'Statement' },
	{ value: 'signature', label: 'Signature' },
	{ value: 'file', label: 'File Upload' },
	{ value: 'ranking', label: 'Ranking' },
	{ value: 'matrix', label: 'Matrix / Grid' },
	{ value: 'calculated', label: 'Calculated' },
	{ value: 'hidden', label: 'Hidden Field' },
]

// Evaluate a single conditional rule against current values
export function evaluateCondition(rule: ConditionalRule, values: Record<string, string>): boolean {
	const value = values[rule.fieldId] || ''
	switch (rule.operator) {
		case 'equals': return value === rule.value
		case 'not_equals': return value !== rule.value
		case 'contains': return value.toLowerCase().includes(rule.value.toLowerCase())
		case 'not_contains': return !value.toLowerCase().includes(rule.value.toLowerCase())
		case 'is_empty': return !value.trim()
		case 'is_not_empty': return !!value.trim()
		case 'greater_than': return parseFloat(value) > parseFloat(rule.value)
		case 'less_than': return parseFloat(value) < parseFloat(rule.value)
		default: return true
	}
}

// Check if a field should be visible given current form values
export function isFieldVisible(field: FormField, values: Record<string, string>): boolean {
	if (!field.conditions || field.conditions.length === 0) return true
	const logic = field.conditionLogic || 'and'
	const results = field.conditions.map(rule => evaluateCondition(rule, values))
	return logic === 'and' ? results.every(Boolean) : results.some(Boolean)
}

function normalizePipeKey(value: string): string {
	return value.toLowerCase().trim().replace(/\s+/g, '_')
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fieldLabelPattern(label: string): string {
	return escapeRegExp(label.trim()).replace(/\s+/g, '\\s+')
}

function findPipeField(key: string, fields: FormField[]): FormField | undefined {
	const normalizedKey = normalizePipeKey(key)
	return fields.find(f =>
		f.id === key ||
		normalizePipeKey(f.id) === normalizedKey ||
		normalizePipeKey(f.label) === normalizedKey
	)
}

// Replace {{Question Label}} tokens in text with actual values. Field ids are
// still accepted for backwards compatibility with older saved forms.
export function pipeValues(text: string, values: Record<string, string>, fields: FormField[]): string {
	let output = text

	// If a user typed a field label and then inserted that same field as a token
	// (for example, "your name {{Your Name}}"), render only the answer value.
	for (const field of fields) {
		const answer = values[field.id]
		if (!answer || !field.label.trim()) continue
		const label = fieldLabelPattern(field.label)
		const tokenKeys = [field.label, field.id].filter(Boolean)
		for (const tokenKey of tokenKeys) {
			const token = `\\{\\{\\s*${escapeRegExp(tokenKey)}\\s*\\}\\}`
			output = output.replace(new RegExp(`${label}\\s*${token}`, 'gi'), answer)
		}
	}

	return output.replace(/\{\{([^}]+)\}\}/g, (match, rawKey) => {
		const key = String(rawKey).trim()
		const field = findPipeField(key, fields)
		if (field) return values[field.id] || match
		return values[key] || match
	})
}

// Supported languages for multi-language forms
export const LANGUAGES: { code: string; name: string; rtl?: boolean }[] = [
	{ code: 'en', name: 'English' },
	{ code: 'fr', name: 'Fran\u00e7ais' },
	{ code: 'es', name: 'Espa\u00f1ol' },
	{ code: 'pt', name: 'Portugu\u00eas' },
	{ code: 'de', name: 'Deutsch' },
	{ code: 'ar', name: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', rtl: true },
	{ code: 'sw', name: 'Kiswahili' },
	{ code: 'ha', name: 'Hausa' },
	{ code: 'am', name: '\u12a0\u121b\u122d\u129b' },
	{ code: 'yo', name: 'Yor\u00f9b\u00e1' },
	{ code: 'ig', name: 'Igbo' },
	{ code: 'zu', name: 'isiZulu' },
	{ code: 'hi', name: '\u0939\u093f\u0928\u094d\u0926\u0940' },
	{ code: 'ur', name: '\u0627\u0631\u062f\u0648', rtl: true },
	{ code: 'bn', name: '\u09ac\u09be\u0982\u09b2\u09be' },
	{ code: 'zh', name: '\u4e2d\u6587' },
	{ code: 'ja', name: '\u65e5\u672c\u8a9e' },
	{ code: 'ko', name: '\ud55c\uad6d\uc5b4' },
	{ code: 'tr', name: 'T\u00fcrk\u00e7e' },
	{ code: 'ru', name: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
	{ code: 'he', name: '\u05e2\u05d1\u05e8\u05d9\u05ea', rtl: true },
	{ code: 'fa', name: '\u0641\u0627\u0631\u0633\u06cc', rtl: true },
]

// Get translated field text for a given language
export function getFieldText(field: FormField, lang: string | undefined): { label: string; placeholder: string; options: string } {
	const t = lang && field.translations?.[lang]
	return {
		label: (t && t.label) || field.label,
		placeholder: (t && t.placeholder) || field.placeholder || '',
		options: (t && t.options) || field.options || '',
	}
}

// Check if a language is RTL
export function isRtlLanguage(lang: string): boolean {
	return LANGUAGES.find(l => l.code === lang)?.rtl === true
}

// Pre-built form templates
export interface FormTemplate {
	title: string
	description: string
	fields: FormField[]
}
