import { defineSchema, t } from 'korajs'

export default defineSchema({
	version: 1,
	collections: {
		// A form definition (e.g. "Church Member Registration", "Sunday Attendance")
		forms: {
			fields: {
				title: t.string(),
				description: t.string().default(''),
				// JSON-encoded array of field definitions
				// Each field: { id, type, label, required, options? }
				fields: t.string().default('[]'),
				status: t.string().default('draft'), // draft | published | archived
				responseCount: t.number().default(0),
				createdAt: t.timestamp().auto(),
			},
			indexes: ['status', 'createdAt'],
		},

		// A single form submission
		responses: {
			fields: {
				formId: t.string(),
				// JSON-encoded key-value pairs: { fieldId: value }
				data: t.string().default('{}'),
				submittedBy: t.string().default(''),
				submittedAt: t.timestamp().auto(),
			},
			indexes: ['formId', 'submittedAt'],
		},
	},
})
