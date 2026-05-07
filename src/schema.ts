import { defineSchema, t } from 'korajs'

export default defineSchema({
	version: 3,
	collections: {
		// A form definition (e.g. "Customer Feedback", "Event Registration")
		forms: {
			fields: {
				title: t.string(),
				description: t.string().default(''),
				// JSON-encoded array of field definitions
				// Each field: { id, type, label, required, options? }
				fields: t.string().default('[]'),
				status: t.string().default('draft'), // draft | published | closed
				// Color theme preset id (e.g. 'indigo', 'rose', 'emerald')
				theme: t.string().default('indigo'),
				responseCount: t.number().default(0),
				// User who created this form
				ownerId: t.string().default(''),
				// URL-friendly slug for shareable links
				slug: t.string().default(''),
				createdAt: t.timestamp().auto(),
			},
			indexes: ['status', 'createdAt', 'ownerId', 'slug'],
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
