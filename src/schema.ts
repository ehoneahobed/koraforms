import { defineSchema, t } from 'korajs'
import type { FormField, FormSettings } from './types'

type ResponseData = Record<string, unknown>
type SideEffectPayload = Record<string, unknown>
type AnalyticsEventMetadata = Record<string, unknown>
type SavedAnalyticsFilters = Array<{ fieldId: string; value: string }>

export default defineSchema({
	version: 17,
	collections: {
		// A form definition (e.g. "Customer Feedback", "Event Registration")
		forms: {
			fields: {
				title: t.string(),
				description: t.string().default(''),
				fields: t.json<FormField[]>().default([]),
				status: t.enum(['draft', 'published', 'closed']).default('draft').transitions({
					draft: ['published', 'closed'],
					published: ['draft', 'closed'],
					closed: [],
				}),
				// Color theme preset id (e.g. 'blue', 'rose', 'emerald')
				theme: t.string().default('red'),
				// Counter merge: concurrent submissions add rather than overwrite
				responseCount: t.number().default(0).merge('counter'),
				// User who created this form
				ownerId: t.string().default(''),
				// URL-friendly slug for shareable links
				slug: t.string().default(''),
				accessPassword: t.secret().hashed().optional(),
				settings: t.json<FormSettings>().default({}),
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
				data: t.json<ResponseData>().default({}),
				submittedBy: t.string().default(''),
				clientSubmissionId: t.string().default(''),
				formVersionHash: t.string().default(''),
				submittedAt: t.number(),
			},
			indexes: ['formId', 'clientSubmissionId', 'formVersionHash', 'submittedAt'],
		},

		form_analytics_events: {
			fields: {
				formId: t.string(),
				slug: t.string().default(''),
				formVersionHash: t.string().default(''),
				clientEventId: t.string(),
				sessionId: t.string(),
				visitorKey: t.string(),
				type: t.enum(['viewed_form', 'started_form', 'answered_question', 'saved_progress', 'submitted_form']),
				fieldId: t.string().default(''),
				questionIndex: t.number().default(-1),
				answeredCount: t.number().default(0),
				visibleQuestionCount: t.number().default(0),
				metadata: t.json<AnalyticsEventMetadata>().default({}),
				syncStatus: t.enum(['pending', 'syncing', 'accepted', 'failed']).default('pending').transitions({
					pending: ['syncing', 'accepted', 'failed'],
					syncing: ['accepted', 'failed'],
					failed: ['syncing', 'pending'],
					accepted: [],
				}),
				occurredAt: t.number(),
				updatedAt: t.number(),
			},
			indexes: ['formId', 'slug', 'clientEventId', 'sessionId', 'visitorKey', 'type', 'syncStatus', 'occurredAt'],
			constraints: [{
				type: 'unique',
				fields: ['formId', 'clientEventId'],
				onConflict: 'first-write-wins',
			}],
		},

		response_filter_views: {
			fields: {
				formId: t.string(),
				ownerId: t.string().default(''),
				name: t.string(),
				timeRange: t.enum(['7d', '14d', '30d', '90d', 'all']).default('30d'),
				filters: t.json<SavedAnalyticsFilters>().default([]),
				createdAt: t.number(),
				updatedAt: t.number(),
			},
			indexes: ['formId', 'ownerId', 'updatedAt'],
			constraints: [{
				type: 'unique',
				fields: ['formId', 'ownerId', 'name'],
				onConflict: 'last-write-wins',
			}],
		},

		// Sanitized, immutable public form payloads cached in Kora's local
		// database so respondents can open known forms without connectivity.
		public_form_versions: {
			fields: {
				slug: t.string(),
				formId: t.string(),
				versionHash: t.string(),
				title: t.string(),
				description: t.string().default(''),
				fields: t.json<FormField[]>().default([]),
				settings: t.json<FormSettings>().default({}),
				theme: t.string().default('red'),
				status: t.enum(['published', 'revoked']).default('published').transitions({
					published: ['revoked'],
					revoked: [],
				}),
				cachedAt: t.number(),
				publishedAt: t.number(),
			},
			indexes: ['slug', 'formId', 'versionHash', 'status', 'cachedAt'],
			constraints: [{
				type: 'unique',
				fields: ['slug', 'versionHash'],
				onConflict: 'first-write-wins',
			}],
		},

		// Respondent-side durable outbox. These records live in Kora's offline
		// database first, then an app-level bridge finalizes them with the server.
		response_submissions: {
			fields: {
				formId: t.string(),
				slug: t.string().default(''),
				formVersionHash: t.string().default(''),
				data: t.json<ResponseData>().default({}),
				clientSubmissionId: t.string(),
				localStatus: t.enum(['submitted_locally', 'syncing', 'accepted', 'rejected', 'failed']).default('submitted_locally').transitions({
					submitted_locally: ['syncing', 'accepted', 'rejected', 'failed'],
					syncing: ['accepted', 'rejected', 'failed'],
					failed: ['syncing', 'submitted_locally'],
					accepted: [],
					rejected: [],
				}),
				attempts: t.number().default(0),
				lastError: t.string().default(''),
				submittedAt: t.number(),
				updatedAt: t.number(),
			},
			indexes: ['formId', 'slug', 'clientSubmissionId', 'localStatus', 'submittedAt'],
			constraints: [{
				type: 'unique',
				fields: ['formId', 'clientSubmissionId'],
				onConflict: 'first-write-wins',
			}],
		},

		public_form_progress: {
			fields: {
				slug: t.string(),
				formId: t.string(),
				answers: t.json<ResponseData>().default({}),
				currentIndex: t.number().default(-1),
				resumeId: t.string().default(''),
				resumeUrl: t.string().default(''),
				savedAt: t.number(),
				updatedAt: t.number(),
			},
			indexes: ['slug', 'formId', 'resumeId', 'updatedAt'],
			constraints: [{
				type: 'unique',
				fields: ['slug'],
				onConflict: 'last-write-wins',
			}],
		},

		resume_links: {
			fields: {
				token: t.string(),
				formId: t.string(),
				slug: t.string(),
				data: t.json<ResponseData>().default({}),
				status: t.enum(['active', 'expired', 'revoked']).default('active').transitions({
					active: ['expired', 'revoked'],
					expired: [],
					revoked: [],
				}),
				createdAt: t.number(),
				updatedAt: t.number(),
				expiresAt: t.number(),
			},
			indexes: ['token', 'formId', 'slug', 'status', 'expiresAt', 'updatedAt'],
			constraints: [{
				type: 'unique',
				fields: ['token'],
				onConflict: 'first-write-wins',
			}],
		},

		side_effect_deliveries: {
			fields: {
				responseId: t.string(),
				formId: t.string(),
				type: t.enum(['webhook', 'email']),
				target: t.string(),
				payload: t.json<SideEffectPayload>().default({}),
				status: t.enum(['pending', 'delivering', 'delivered', 'failed']).default('pending').transitions({
					pending: ['delivering', 'failed'],
					delivering: ['delivering', 'delivered', 'failed'],
					failed: ['delivering', 'failed'],
					delivered: [],
				}),
				attempts: t.number().default(0),
				lastError: t.string().default(''),
				nextAttemptAt: t.number(),
				createdAt: t.number(),
				updatedAt: t.number(),
			},
			indexes: ['responseId', 'formId', 'type', 'status', 'nextAttemptAt', 'createdAt'],
		},

		audit_events: {
			fields: {
				formId: t.string(),
				actorId: t.string().default(''),
				actorType: t.enum(['user', 'system', 'public']).default('user'),
				eventType: t.enum([
					'form_created',
					'form_updated',
					'form_published',
					'form_closed',
					'form_reopened',
					'form_archived',
					'form_restored',
					'form_duplicated',
					'form_deleted',
					'template_used',
					'theme_changed',
					'settings_updated',
					'password_updated',
					'password_cleared',
					'responses_exported',
					'responses_deleted',
				]),
				summary: t.string(),
				metadata: t.json<Record<string, unknown>>().default({}),
				createdAt: t.number(),
			},
			indexes: ['formId', 'actorId', 'eventType', 'createdAt'],
		},
	},
})
