import type { FormTemplate } from './types'

export const FORM_TEMPLATES: Record<string, FormTemplate> = {
	'church-members': {
		title: 'Church Member Registration',
		description: 'Register new members with their contact and family details.',
		fields: [
			{ id: 'full_name', type: 'text', label: 'Full Name', required: true },
			{ id: 'date_of_birth', type: 'date', label: 'Date of Birth', required: false },
			{ id: 'gender', type: 'radio', label: 'Gender', required: true, options: 'Male,Female' },
			{ id: 'phone', type: 'phone', label: 'Phone Number', required: true },
			{ id: 'email', type: 'email', label: 'Email Address', required: false },
			{ id: 'address', type: 'textarea', label: 'Home Address', required: false },
			{ id: 'occupation', type: 'text', label: 'Occupation', required: false },
			{
				id: 'membership_type',
				type: 'select',
				label: 'Membership Type',
				required: true,
				options: 'New Member,Transfer,Restoration',
			},
			{ id: 'baptized', type: 'radio', label: 'Baptized?', required: true, options: 'Yes,No' },
			{ id: 'emergency_contact', type: 'text', label: 'Emergency Contact Name', required: false },
			{ id: 'emergency_phone', type: 'phone', label: 'Emergency Contact Phone', required: false },
		],
	},

	'church-attendance': {
		title: 'Sunday Service Attendance',
		description: 'Record attendance for each service.',
		fields: [
			{ id: 'service_date', type: 'date', label: 'Service Date', required: true },
			{
				id: 'service_type',
				type: 'select',
				label: 'Service Type',
				required: true,
				options: 'Sunday Worship,Midweek Service,Prayer Meeting,Bible Study,Special Service',
			},
			{ id: 'adult_men', type: 'number', label: 'Adult Men', required: true },
			{ id: 'adult_women', type: 'number', label: 'Adult Women', required: true },
			{ id: 'youth', type: 'number', label: 'Youth', required: true },
			{ id: 'children', type: 'number', label: 'Children', required: true },
			{ id: 'visitors', type: 'number', label: 'First-time Visitors', required: false },
			{ id: 'notes', type: 'textarea', label: 'Notes', required: false },
		],
	},

	'church-offering': {
		title: 'Tithe & Offering Record',
		description: 'Record tithes, offerings, and special contributions.',
		fields: [
			{ id: 'date', type: 'date', label: 'Date', required: true },
			{ id: 'member_name', type: 'text', label: 'Member Name', required: true },
			{
				id: 'type',
				type: 'select',
				label: 'Type',
				required: true,
				options: 'Tithe,Offering,Special Seed,Building Fund,Missions,Welfare,Other',
			},
			{ id: 'amount', type: 'number', label: 'Amount (GHS)', required: true },
			{
				id: 'payment_method',
				type: 'radio',
				label: 'Payment Method',
				required: true,
				options: 'Cash,Mobile Money,Bank Transfer',
			},
			{ id: 'reference', type: 'text', label: 'Reference / Receipt No.', required: false },
			{ id: 'notes', type: 'textarea', label: 'Notes', required: false },
		],
	},

	'event-registration': {
		title: 'Event Registration',
		description: 'Register participants for an event or program.',
		fields: [
			{ id: 'full_name', type: 'text', label: 'Full Name', required: true },
			{ id: 'phone', type: 'phone', label: 'Phone Number', required: true },
			{ id: 'email', type: 'email', label: 'Email', required: false },
			{
				id: 'age_group',
				type: 'select',
				label: 'Age Group',
				required: true,
				options: 'Under 18,18-25,26-35,36-45,46-60,60+',
			},
			{ id: 'dietary', type: 'text', label: 'Dietary Requirements', required: false, placeholder: 'Leave blank if none' },
			{ id: 'special_needs', type: 'textarea', label: 'Any Special Needs?', required: false },
		],
	},

	'survey': {
		title: 'Community Survey',
		description: 'Collect feedback and information from the community.',
		fields: [
			{ id: 'respondent_name', type: 'text', label: 'Name (optional)', required: false },
			{ id: 'location', type: 'text', label: 'Location / Area', required: true },
			{ id: 'question_1', type: 'textarea', label: 'Question 1', required: true },
			{ id: 'question_2', type: 'textarea', label: 'Question 2', required: false },
			{
				id: 'rating',
				type: 'radio',
				label: 'Overall Rating',
				required: true,
				options: 'Excellent,Good,Average,Poor',
			},
			{ id: 'suggestions', type: 'textarea', label: 'Suggestions for Improvement', required: false },
		],
	},

	blank: {
		title: '',
		description: '',
		fields: [],
	},
}
