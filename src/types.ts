// Form field types supported by the form builder
export type FieldType = 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'rating' | 'scale' | 'yesno' | 'time' | 'url' | 'section' | 'statement' | 'signature'

export interface FormField {
	id: string
	type: FieldType
	label: string
	required: boolean
	placeholder?: string
	// For select, radio, checkbox — comma-separated options
	options?: string
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
]

// Pre-built form templates
export interface FormTemplate {
	title: string
	description: string
	fields: FormField[]
}
