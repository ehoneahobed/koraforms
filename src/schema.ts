import { defineSchema, t } from 'korajs'

export default defineSchema({
	version: 5,
	collections: {
		// A form definition (e.g. "Customer Feedback", "Event Registration")
		forms: {
			fields: {
				title: t.string(),
				description: t.string().default(''),
				// JSON-encoded array of field definitions
				// Each field: { id, type, label, required, options?, conditions? }
				fields: t.string().default('[]'),
				status: t.enum(['draft', 'published', 'closed']).default('draft').transitions({
					draft: ['published', 'closed'],
					published: ['draft', 'closed'],
					closed: [],
				}),
				// Color theme preset id (e.g. 'blue', 'rose', 'emerald')
				theme: t.string().default('blue'),
				// Counter merge: concurrent submissions add rather than overwrite
				responseCount: t.number().default(0).merge('counter'),
				// User who created this form
				ownerId: t.string().default(''),
				// URL-friendly slug for shareable links
				slug: t.string().default(''),
				// JSON-encoded form settings (thank-you page, limits, scheduling, etc.)
				settings: t.string().default('{}'),
				createdAt: t.timestamp().auto(),
			},
			indexes: ['status', 'createdAt', 'ownerId', 'slug'],
			constraints: [{
				type: 'unique',
				fields: ['slug'],
				where: { status: { $ne: 'draft' } },
				onConflict: 'first-write-wins',
			}],
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
