// Form field types supported by the form builder
export type FieldType = 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date'

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
]

// Pre-built form templates
export interface FormTemplate {
	title: string
	description: string
	fields: FormField[]
}
