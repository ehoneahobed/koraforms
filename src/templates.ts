import type { FormField, FormTemplate } from './types'

export const FORM_TEMPLATES: Record<string, FormTemplate> = {
	// -----------------------------------------------------------------------
	// Church & Religious
	// -----------------------------------------------------------------------
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

	// -----------------------------------------------------------------------
	// Events & Registration
	// -----------------------------------------------------------------------
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

	rsvp: {
		title: 'RSVP',
		description: 'Quick event RSVP form.',
		fields: [
			{ id: 'name', type: 'text', label: 'Your Name', required: true },
			{ id: 'email', type: 'email', label: 'Email', required: true },
			{ id: 'attending', type: 'yesno', label: 'Will you attend?', required: true },
			{ id: 'guests', type: 'number', label: 'Number of guests', required: false },
			{ id: 'dietary', type: 'select', label: 'Dietary preference', required: false, options: 'No preference,Vegetarian,Vegan,Halal,Gluten-free,Other' },
			{ id: 'message', type: 'textarea', label: 'Message (optional)', required: false },
		],
	},

	// -----------------------------------------------------------------------
	// Feedback & Surveys
	// -----------------------------------------------------------------------
	'customer-satisfaction': {
		title: 'Customer Satisfaction Survey',
		description: 'Measure how happy your customers are.',
		fields: [
			{ id: 'intro', type: 'statement', label: 'We value your feedback! This survey takes about 2 minutes.', required: false },
			{ id: 'overall', type: 'rating', label: 'How would you rate your overall experience?', required: true },
			{ id: 'service_quality', type: 'rating', label: 'How would you rate our service quality?', required: true },
			{ id: 'recommend', type: 'scale', label: 'How likely are you to recommend us? (1-10)', required: true },
			{ id: 'best_part', type: 'textarea', label: 'What did you enjoy most?', required: false },
			{ id: 'improve', type: 'textarea', label: 'What could we improve?', required: false },
			{ id: 'contact', type: 'yesno', label: 'May we contact you for follow-up?', required: false },
			{ id: 'email', type: 'email', label: 'Email (if yes above)', required: false },
		],
	},

	'nps-survey': {
		title: 'NPS Survey',
		description: 'Net Promoter Score — one simple question.',
		fields: [
			{ id: 'score', type: 'scale', label: 'How likely are you to recommend us to a friend or colleague? (0-10)', required: true },
			{ id: 'reason', type: 'textarea', label: 'What is the main reason for your score?', required: false },
			{ id: 'improve', type: 'textarea', label: 'What could we do better?', required: false },
		],
	},

	'product-feedback': {
		title: 'Product Feedback',
		description: 'Collect feedback on your product or feature.',
		fields: [
			{ id: 'feature', type: 'text', label: 'Which feature are you reviewing?', required: true },
			{ id: 'ease', type: 'rating', label: 'Ease of use', required: true },
			{ id: 'usefulness', type: 'rating', label: 'How useful is this feature?', required: true },
			{ id: 'frequency', type: 'select', label: 'How often do you use it?', required: true, options: 'Daily,Weekly,Monthly,Rarely,First time' },
			{ id: 'likes', type: 'textarea', label: 'What do you like about it?', required: false },
			{ id: 'dislikes', type: 'textarea', label: 'What frustrates you?', required: false },
			{ id: 'suggestion', type: 'textarea', label: 'Any suggestions for improvement?', required: false },
		],
	},

	survey: {
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

	// -----------------------------------------------------------------------
	// HR & Business
	// -----------------------------------------------------------------------
	'job-application': {
		title: 'Job Application',
		description: 'Collect applications for an open position.',
		fields: [
			{ id: 'section_personal', type: 'section', label: 'Personal Information', required: false },
			{ id: 'name', type: 'text', label: 'Full Name', required: true },
			{ id: 'email', type: 'email', label: 'Email Address', required: true },
			{ id: 'phone', type: 'phone', label: 'Phone Number', required: true },
			{ id: 'section_exp', type: 'section', label: 'Experience', required: false },
			{ id: 'position', type: 'text', label: 'Position Applied For', required: true },
			{ id: 'experience', type: 'select', label: 'Years of Experience', required: true, options: 'Less than 1,1-3,3-5,5-10,10+' },
			{ id: 'current_employer', type: 'text', label: 'Current Employer', required: false },
			{ id: 'resume_link', type: 'url', label: 'Link to Resume / CV', required: false },
			{ id: 'cover_letter', type: 'textarea', label: 'Why do you want this role?', required: true },
			{ id: 'start_date', type: 'date', label: 'Earliest Start Date', required: false },
		],
	},

	'employee-onboarding': {
		title: 'Employee Onboarding',
		description: 'Collect new employee details for HR records.',
		fields: [
			{ id: 'full_name', type: 'text', label: 'Full Legal Name', required: true },
			{ id: 'preferred_name', type: 'text', label: 'Preferred Name', required: false },
			{ id: 'dob', type: 'date', label: 'Date of Birth', required: true },
			{ id: 'email', type: 'email', label: 'Personal Email', required: true },
			{ id: 'phone', type: 'phone', label: 'Phone Number', required: true },
			{ id: 'address', type: 'textarea', label: 'Home Address', required: true },
			{ id: 'emergency_name', type: 'text', label: 'Emergency Contact Name', required: true },
			{ id: 'emergency_phone', type: 'phone', label: 'Emergency Contact Phone', required: true },
			{ id: 'shirt_size', type: 'select', label: 'T-Shirt Size', required: false, options: 'XS,S,M,L,XL,XXL' },
			{ id: 'dietary', type: 'text', label: 'Dietary Restrictions', required: false },
		],
	},

	'contact-form': {
		title: 'Contact Form',
		description: 'Simple contact form for websites.',
		fields: [
			{ id: 'name', type: 'text', label: 'Your Name', required: true },
			{ id: 'email', type: 'email', label: 'Email Address', required: true },
			{ id: 'subject', type: 'select', label: 'Subject', required: true, options: 'General Inquiry,Support,Feedback,Partnership,Other' },
			{ id: 'message', type: 'textarea', label: 'Message', required: true },
		],
	},

	'order-form': {
		title: 'Order Form',
		description: 'Simple product or service order form.',
		fields: [
			{ id: 'customer_name', type: 'text', label: 'Full Name', required: true },
			{ id: 'phone', type: 'phone', label: 'Phone Number', required: true },
			{ id: 'email', type: 'email', label: 'Email', required: false },
			{ id: 'product', type: 'text', label: 'Product / Service', required: true },
			{ id: 'quantity', type: 'number', label: 'Quantity', required: true },
			{ id: 'delivery_address', type: 'textarea', label: 'Delivery Address', required: true },
			{ id: 'delivery_date', type: 'date', label: 'Preferred Delivery Date', required: false },
			{ id: 'notes', type: 'textarea', label: 'Special Instructions', required: false },
		],
	},

	// -----------------------------------------------------------------------
	// Education
	// -----------------------------------------------------------------------
	'student-enrollment': {
		title: 'Student Enrollment',
		description: 'Enroll students for a course or program.',
		fields: [
			{ id: 'student_name', type: 'text', label: 'Student Name', required: true },
			{ id: 'dob', type: 'date', label: 'Date of Birth', required: true },
			{ id: 'parent_name', type: 'text', label: 'Parent / Guardian Name', required: true },
			{ id: 'phone', type: 'phone', label: 'Contact Phone', required: true },
			{ id: 'email', type: 'email', label: 'Email Address', required: false },
			{ id: 'grade', type: 'select', label: 'Grade / Level', required: true, options: 'Nursery,KG1,KG2,Grade 1,Grade 2,Grade 3,Grade 4,Grade 5,Grade 6,JHS 1,JHS 2,JHS 3' },
			{ id: 'previous_school', type: 'text', label: 'Previous School', required: false },
			{ id: 'medical', type: 'textarea', label: 'Medical Conditions (if any)', required: false },
		],
	},

	'course-feedback': {
		title: 'Course Feedback',
		description: 'Collect student feedback on a course or training.',
		fields: [
			{ id: 'course_name', type: 'text', label: 'Course Name', required: true },
			{ id: 'instructor_rating', type: 'rating', label: 'Instructor Rating', required: true },
			{ id: 'content_rating', type: 'rating', label: 'Content Quality', required: true },
			{ id: 'pace', type: 'radio', label: 'Course Pace', required: true, options: 'Too slow,Just right,Too fast' },
			{ id: 'most_useful', type: 'textarea', label: 'What was most useful?', required: false },
			{ id: 'least_useful', type: 'textarea', label: 'What was least useful?', required: false },
			{ id: 'recommend', type: 'yesno', label: 'Would you recommend this course?', required: true },
			{ id: 'overall', type: 'rating', label: 'Overall Rating', required: true },
		],
	},

	'workshop-signup': {
		title: 'Workshop Sign-Up',
		description: 'Register participants for a workshop or training.',
		fields: [
			{ id: 'name', type: 'text', label: 'Full Name', required: true },
			{ id: 'email', type: 'email', label: 'Email', required: true },
			{ id: 'phone', type: 'phone', label: 'Phone', required: true },
			{ id: 'organization', type: 'text', label: 'Organization / Company', required: false },
			{ id: 'experience', type: 'select', label: 'Experience Level', required: true, options: 'Beginner,Intermediate,Advanced' },
			{ id: 'expectations', type: 'textarea', label: 'What do you hope to learn?', required: false },
			{ id: 'laptop', type: 'yesno', label: 'Will you bring a laptop?', required: false },
		],
	},

	// -----------------------------------------------------------------------
	// Field Data Collection
	// -----------------------------------------------------------------------
	'bug-report': {
		title: 'Bug Report',
		description: 'Report a bug or issue.',
		fields: [
			{ id: 'title', type: 'text', label: 'Bug Title', required: true },
			{ id: 'severity', type: 'radio', label: 'Severity', required: true, options: 'Critical,High,Medium,Low' },
			{ id: 'steps', type: 'textarea', label: 'Steps to Reproduce', required: true },
			{ id: 'expected', type: 'textarea', label: 'Expected Behavior', required: true },
			{ id: 'actual', type: 'textarea', label: 'Actual Behavior', required: true },
			{ id: 'browser', type: 'select', label: 'Browser', required: false, options: 'Chrome,Firefox,Safari,Edge,Other' },
			{ id: 'screenshot_url', type: 'url', label: 'Screenshot URL (if any)', required: false },
			{ id: 'email', type: 'email', label: 'Your Email (for follow-up)', required: false },
		],
	},

	'health-screening': {
		title: 'Health Screening Form',
		description: 'Community health screening data collection.',
		fields: [
			{ id: 'section_patient', type: 'section', label: 'Patient Information', required: false },
			{ id: 'name', type: 'text', label: 'Full Name', required: true },
			{ id: 'age', type: 'number', label: 'Age', required: true },
			{ id: 'gender', type: 'radio', label: 'Gender', required: true, options: 'Male,Female,Other' },
			{ id: 'section_vitals', type: 'section', label: 'Vitals', required: false },
			{ id: 'blood_pressure', type: 'text', label: 'Blood Pressure (e.g. 120/80)', required: true },
			{ id: 'weight', type: 'number', label: 'Weight (kg)', required: true },
			{ id: 'height', type: 'number', label: 'Height (cm)', required: true },
			{ id: 'temperature', type: 'number', label: 'Temperature (°C)', required: false },
			{ id: 'section_history', type: 'section', label: 'Medical History', required: false },
			{ id: 'conditions', type: 'checkbox', label: 'Known Conditions', required: false, options: 'Diabetes,Hypertension,Asthma,Heart Disease,None' },
			{ id: 'medications', type: 'textarea', label: 'Current Medications', required: false },
			{ id: 'notes', type: 'textarea', label: 'Examiner Notes', required: false },
			{ id: 'signature', type: 'signature', label: 'Examiner Signature', required: true },
		],
	},

	// -----------------------------------------------------------------------
	// Volunteer & Community
	// -----------------------------------------------------------------------
	'volunteer-signup': {
		title: 'Volunteer Sign-Up',
		description: 'Recruit and register volunteers for your organization.',
		fields: [
			{ id: 'full_name', type: 'text', label: 'Full Name', required: true },
			{ id: 'email', type: 'email', label: 'Email Address', required: true },
			{ id: 'phone', type: 'phone', label: 'Phone Number', required: true },
			{ id: 'availability', type: 'checkbox', label: 'Availability', required: true, options: 'Weekday mornings,Weekday afternoons,Weekday evenings,Weekends' },
			{ id: 'skills', type: 'checkbox', label: 'Skills & Interests', required: false, options: 'Teaching,Cooking,Driving,Admin,Tech support,Cleaning,Music,Photography' },
			{ id: 'experience', type: 'textarea', label: 'Previous Volunteer Experience', required: false },
			{ id: 'emergency_contact', type: 'text', label: 'Emergency Contact', required: true },
			{ id: 'emergency_phone', type: 'phone', label: 'Emergency Contact Phone', required: true },
		],
	},

	'donation-form': {
		title: 'Donation Pledge',
		description: 'Collect donation pledges and contributions.',
		fields: [
			{ id: 'donor_name', type: 'text', label: 'Your Name', required: true },
			{ id: 'email', type: 'email', label: 'Email', required: true },
			{ id: 'phone', type: 'phone', label: 'Phone', required: false },
			{ id: 'amount', type: 'number', label: 'Donation Amount', required: true },
			{ id: 'frequency', type: 'radio', label: 'Frequency', required: true, options: 'One-time,Monthly,Quarterly,Annually' },
			{ id: 'purpose', type: 'select', label: 'Designated For', required: false, options: 'General Fund,Building Fund,Missions,Youth Programs,Education,Other' },
			{ id: 'anonymous', type: 'yesno', label: 'Would you like to remain anonymous?', required: false },
			{ id: 'notes', type: 'textarea', label: 'Additional Notes', required: false },
		],
	},

	// -----------------------------------------------------------------------
	// Quizzes & Assessments
	// -----------------------------------------------------------------------
	'quiz': {
		title: 'Quick Quiz',
		description: 'A simple quiz or knowledge check.',
		fields: [
			{ id: 'name', type: 'text', label: 'Your Name', required: true },
			{ id: 'q1', type: 'radio', label: 'What is the capital of Ghana?', required: true, options: 'Lagos,Accra,Kumasi,Nairobi' },
			{ id: 'q2', type: 'radio', label: 'Which planet is closest to the sun?', required: true, options: 'Venus,Mercury,Mars,Earth' },
			{ id: 'q3', type: 'radio', label: 'What year did the internet become publicly available?', required: true, options: '1985,1991,1995,2000' },
			{ id: 'q4', type: 'textarea', label: 'In your own words, what is machine learning?', required: false },
			{ id: 'confidence', type: 'scale', label: 'How confident are you in your answers?', required: false, options: 'Not confident,Very confident' },
		],
	},

	// -----------------------------------------------------------------------
	// Travel & Hospitality
	// -----------------------------------------------------------------------
	'hotel-feedback': {
		title: 'Hotel Guest Feedback',
		description: 'Collect guest reviews and improvement suggestions.',
		fields: [
			{ id: 'name', type: 'text', label: 'Guest Name', required: false },
			{ id: 'room', type: 'text', label: 'Room Number', required: false },
			{ id: 'checkin', type: 'date', label: 'Check-in Date', required: true },
			{ id: 'checkout', type: 'date', label: 'Check-out Date', required: true },
			{ id: 'overall', type: 'rating', label: 'Overall Experience', required: true },
			{ id: 'categories', type: 'matrix', label: 'Rate each area', required: true, matrixRows: 'Cleanliness,Comfort,Staff,Location,Value for Money', matrixColumns: 'Poor,Fair,Good,Excellent' },
			{ id: 'best', type: 'textarea', label: 'What did you enjoy most?', required: false },
			{ id: 'improve', type: 'textarea', label: 'What could we improve?', required: false },
			{ id: 'recommend', type: 'scale', label: 'How likely are you to recommend us?', required: true, options: 'Not at all,Definitely' },
		],
	},

	// -----------------------------------------------------------------------
	// Inventory & Operations
	// -----------------------------------------------------------------------
	'inventory-check': {
		title: 'Inventory Check',
		description: 'Record stock levels and equipment status.',
		fields: [
			{ id: 'checker', type: 'text', label: 'Checked By', required: true },
			{ id: 'date', type: 'date', label: 'Date', required: true },
			{ id: 'location', type: 'select', label: 'Location / Warehouse', required: true, options: 'Main Store,Warehouse A,Warehouse B,Office,Other' },
			{ id: 'item_name', type: 'text', label: 'Item Name', required: true },
			{ id: 'category', type: 'select', label: 'Category', required: true, options: 'Electronics,Furniture,Supplies,Food,Equipment,Other' },
			{ id: 'quantity', type: 'number', label: 'Quantity in Stock', required: true },
			{ id: 'condition', type: 'radio', label: 'Condition', required: true, options: 'New,Good,Fair,Damaged,Expired' },
			{ id: 'reorder', type: 'yesno', label: 'Needs Reorder?', required: true },
			{ id: 'notes', type: 'textarea', label: 'Notes', required: false },
		],
	},

	// -----------------------------------------------------------------------
	// Blank
	// -----------------------------------------------------------------------
	blank: {
		title: '',
		description: '',
		fields: [],
	},
}

// Template categories for the gallery
export const TEMPLATE_CATEGORIES: { label: string; keys: string[] }[] = [
	{ label: 'Church & Religious', keys: ['church-members', 'church-attendance', 'church-offering', 'donation-form'] },
	{ label: 'Events & Registration', keys: ['event-registration', 'rsvp', 'workshop-signup', 'volunteer-signup'] },
	{ label: 'Feedback & Surveys', keys: ['customer-satisfaction', 'nps-survey', 'product-feedback', 'survey', 'course-feedback', 'hotel-feedback'] },
	{ label: 'Business & HR', keys: ['contact-form', 'order-form', 'job-application', 'employee-onboarding'] },
	{ label: 'Education', keys: ['student-enrollment', 'course-feedback', 'quiz'] },
	{ label: 'Data Collection', keys: ['bug-report', 'health-screening', 'inventory-check'] },
]

export interface TemplateMetadata {
	key: string
	category: string
	tags: string[]
	audience: string
	seoTitle: string
	seoDescription: string
	useCases: string[]
	relatedKeys: string[]
	inputFieldCount: number
	requiredFieldCount: number
	estimatedMinutes: number
}

const TEMPLATE_KEYWORDS: Record<string, { audience: string; tags: string[]; useCases: string[] }> = {
	'church-members': {
		audience: 'Church administrators and ministry teams',
		tags: ['membership', 'church', 'records', 'family'],
		useCases: ['Register first-time members', 'Update church records', 'Collect family and emergency details'],
	},
	'church-attendance': {
		audience: 'Church operations teams',
		tags: ['attendance', 'church', 'service', 'reporting'],
		useCases: ['Track weekly attendance', 'Record service type counts', 'Prepare ministry reports'],
	},
	'church-offering': {
		audience: 'Finance and stewardship teams',
		tags: ['offering', 'tithe', 'finance', 'church'],
		useCases: ['Record offerings', 'Track payment methods', 'Keep contribution notes'],
	},
	rsvp: {
		audience: 'Event hosts and coordinators',
		tags: ['rsvp', 'event', 'guests', 'attendance'],
		useCases: ['Confirm event attendance', 'Collect guest counts', 'Capture dietary preferences'],
	},
	'event-registration': {
		audience: 'Event organizers',
		tags: ['registration', 'event', 'participants', 'program'],
		useCases: ['Register attendees', 'Collect contact details', 'Plan capacity and support needs'],
	},
	'customer-satisfaction': {
		audience: 'Customer success and product teams',
		tags: ['feedback', 'survey', 'customers', 'satisfaction'],
		useCases: ['Measure satisfaction', 'Collect improvement ideas', 'Spot customer experience issues'],
	},
	'nps-survey': {
		audience: 'Growth and customer success teams',
		tags: ['nps', 'loyalty', 'feedback', 'survey'],
		useCases: ['Measure loyalty', 'Identify promoters', 'Follow up with detractors'],
	},
	'job-application': {
		audience: 'Hiring teams',
		tags: ['hiring', 'hr', 'application', 'recruiting'],
		useCases: ['Collect applicant details', 'Screen candidates', 'Standardize hiring intake'],
	},
	'employee-onboarding': {
		audience: 'People operations teams',
		tags: ['onboarding', 'hr', 'employees', 'operations'],
		useCases: ['Collect new hire details', 'Prepare first-day setup', 'Standardize onboarding'],
	},
}

const NON_INPUT_FIELD_TYPES = new Set(['section', 'statement', 'hidden'])

export function getTemplateCategory(templateKey: string): string {
	return TEMPLATE_CATEGORIES.find(category => category.keys.includes(templateKey))?.label || 'General'
}

export function getTemplateKeys(): string[] {
	const seen = new Set<string>()
	return TEMPLATE_CATEGORIES.flatMap(category => category.keys).filter((key) => {
		if (seen.has(key) || !FORM_TEMPLATES[key]) return false
		seen.add(key)
		return true
	})
}

export function getTemplateMetadata(templateKey: string): TemplateMetadata | null {
	const template = FORM_TEMPLATES[templateKey]
	if (!template) return null
	const category = getTemplateCategory(templateKey)
	const inputFields = template.fields.filter(field => !NON_INPUT_FIELD_TYPES.has(field.type))
	const requiredFieldCount = inputFields.filter(field => field.required).length
	const custom = TEMPLATE_KEYWORDS[templateKey]
	const titleKeyword = `${template.title.toLowerCase()} template`
	const tags = Array.from(new Set([
		...(custom?.tags || []),
		...category.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
		...template.title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
	]))

	return {
		key: templateKey,
		category,
		tags,
		audience: custom?.audience || `${category} teams`,
		seoTitle: `${template.title} Template - Free Online Form Template | KoraForms`,
		seoDescription: `${template.description} Start with a free ${titleKeyword}, customize every field, and collect responses even when your connection drops.`,
		useCases: custom?.useCases || [
			`Create a ${template.title.toLowerCase()} quickly`,
			'Customize fields for your workflow',
			'Collect responses online or offline',
		],
		relatedKeys: getRelatedTemplateKeys(templateKey, category),
		inputFieldCount: inputFields.length,
		requiredFieldCount,
		estimatedMinutes: Math.max(1, Math.round((inputFields.length * 20) / 60)),
	}
}

export function getRelatedTemplateKeys(templateKey: string, category = getTemplateCategory(templateKey)): string[] {
	const categoryKeys = TEMPLATE_CATEGORIES.find(item => item.label === category)?.keys || []
	return categoryKeys.filter(key => key !== templateKey && FORM_TEMPLATES[key]).slice(0, 3)
}

export function getTemplateSearchText(templateKey: string): string {
	const template = FORM_TEMPLATES[templateKey]
	const metadata = getTemplateMetadata(templateKey)
	if (!template || !metadata) return templateKey
	return [
		template.title,
		template.description,
		metadata.category,
		metadata.audience,
		metadata.tags.join(' '),
		metadata.useCases.join(' '),
	].join(' ').toLowerCase()
}

export function createFieldsFromTemplate(templateKey: string): FormField[] {
	const template = FORM_TEMPLATES[templateKey]
	if (!template) return []
	const prefix = `field_${Date.now()}`
	const idMap = new Map(template.fields.map((field, index) => [field.id, `${prefix}_${index}`]))

	return template.fields.map((field) => {
		const nextId = idMap.get(field.id) || field.id
		const nextFormula = field.formula
			? Array.from(idMap.entries()).reduce(
				(formula, [oldId, newId]) => formula.replace(new RegExp(`\\{${oldId}\\}`, 'g'), `{${newId}}`),
				field.formula,
			)
			: undefined

		return {
			...field,
			id: nextId,
			formula: nextFormula,
			conditions: field.conditions?.map(rule => ({
				...rule,
				fieldId: idMap.get(rule.fieldId) || rule.fieldId,
			})),
		}
	})
}
