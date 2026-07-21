// Form field types supported by the form builder
export type FieldType = 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'rating' | 'scale' | 'yesno' | 'time' | 'url' | 'section' | 'statement' | 'signature' | 'file' | 'calculated' | 'hidden'

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
	formula?: string         // e.g. "{field_1} + {field_2}"
	defaultValue?: string    // Static default for hidden fields
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

// Replace {{field_id}} tokens in text with actual values (answer piping)
export function pipeValues(text: string, values: Record<string, string>, fields: FormField[]): string {
	return text.replace(/\{\{(\w+)\}\}/g, (match, fieldId) => {
		if (values[fieldId]) return values[fieldId]
		// Try matching by label (spaces → underscores)
		const field = fields.find(f => f.label.toLowerCase().replace(/\s+/g, '_') === fieldId.toLowerCase())
		return field ? (values[field.id] || match) : match
	})
}

// Pre-built form templates
export interface FormTemplate {
	title: string
	description: string
	fields: FormField[]
}
