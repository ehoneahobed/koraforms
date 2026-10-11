import { and, defineSchema, member, memberOfKey, owner, t } from 'korajs'
import type { FormField, FormSettings } from './types'

type ResponseData = Record<string, unknown>
type SideEffectPayload = Record<string, unknown>
type AnalyticsEventMetadata = Record<string, unknown>
type SavedAnalyticsFilters = Array<{ fieldId: string; value: string }>
type ResponseExportPresetConfig = { selectedFieldIds: string[]; includeMetadata: boolean }

/** A collaborator's access to a form: `member(field, 'viewer', FORM)`. */
const FORM = { group: 'forms' } as const

export default defineSchema({
	version: 20,
	// Who may read and write what, enforced by the sync server and followed live by
	// every device: a form is a group; its creator is its 'owner', and accepted
	// collaborators are members with their role (written by the collaborator routes).
	access: {
		memberships: 'members',
		roles: ['viewer', 'editor', 'admin', 'owner'],
		groups: { forms: { owner: 'ownerId', role: 'owner' } },
	},
	collections: {
		// Form memberships of accepted collaborators. Server-written only.
		members: {
			fields: { userId: t.string(), group: t.string(), role: t.string() },
			indexes: ['userId', 'group'],
			access: { read: memberOfKey('group') },
		},

		// A form definition (e.g. "Customer Feedback", "Event Registration")
		forms: {
			fields: {
				title: t.string(),
				description: t.string().default(''),
				fields: t.json<FormField[]>().default([]),
				status: t.enum(['draft', 'published', 'closed']).default('draft').transitions({
					draft: ['published', 'closed'],
					published: ['draft', 'closed'],
					// The settings panel offers Draft and Live on a closed form, and the
					// audit log has form_reopened: closing is not terminal.
					closed: ['published', 'draft'],
				}),
				// Color theme preset id (e.g. 'blue', 'rose', 'emerald')
				theme: t.string().default('red'),
				// Counter merge: concurrent submissions add rather than overwrite
				responseCount: t.number().default(0).merge('counter'),
				// User who created this form (filled with the signed-in user on insert)
				ownerId: t.string().stamp('userId'),
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
				// Live links resolve slugs among published forms only. A constraint
				// `where` matches by equality: the previous `{ $ne: 'draft' }` never
				// applied (Kora beta.14 refuses it), so slugs were not unique at all.
				where: { status: 'published' },
				onConflict: 'first-write-wins',
			}],
			access: {
				read: member('id'),
				create: owner('ownerId'),
				update: member('id', 'editor'),
				delete: member('id', 'owner'),
			},
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
			access: {
				read: member('formId', 'viewer', FORM),
				// Respondents submit through the public routes (server writes); a creator may add
				// sample responses.
				create: member('formId', 'editor', FORM),
				update: member('formId', 'editor', FORM),
				delete: member('formId', 'admin', FORM),
			},
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
			// Recorded by the public routes; the creator reads them.
			access: { read: member('formId', 'viewer', FORM) },
		},

		response_filter_views: {
			fields: {
				formId: t.string(),
				ownerId: t.string().stamp('userId'),
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
			// Each user's own saved views of a form they can read.
			access: {
				read: and(owner('ownerId'), member('formId', 'viewer', FORM)),
				write: and(owner('ownerId'), member('formId', 'viewer', FORM)),
			},
		},

		response_export_presets: {
			fields: {
				formId: t.string(),
				ownerId: t.string().stamp('userId'),
				name: t.string(),
				format: t.enum(['csv', 'json']).default('csv'),
				config: t.json<ResponseExportPresetConfig>().default({ selectedFieldIds: [], includeMetadata: true }),
				createdAt: t.number(),
				updatedAt: t.number(),
			},
			indexes: ['formId', 'ownerId', 'updatedAt'],
			constraints: [{
				type: 'unique',
				fields: ['formId', 'ownerId', 'name'],
				onConflict: 'last-write-wins',
			}],
			// Each user's own saved views of a form they can read.
			access: {
				read: and(owner('ownerId'), member('formId', 'viewer', FORM)),
				write: and(owner('ownerId'), member('formId', 'viewer', FORM)),
			},
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
			access: {
				read: member('formId', 'viewer', FORM),
				create: member('formId', 'editor', FORM),
				update: member('formId', 'editor', FORM),
			},
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
			// Lives in the respondent's local database only (it never syncs).
			access: {},
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
			// Lives in the respondent's local database only (it never syncs).
			access: {},
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
			// Server-only: resume tokens are handed out by the public routes.
			access: {},
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
			// Written by the server's delivery worker; the creator sees delivery status.
			access: { read: member('formId', 'viewer', FORM) },
		},

		form_collaborators: {
			fields: {
				formId: t.string(),
				userId: t.string().default(''),
				email: t.string(),
				role: t.enum(['viewer', 'editor', 'admin']).default('editor'),
				status: t.enum(['pending', 'accepted', 'declined']).default('pending').transitions({
					pending: ['accepted', 'declined'],
					accepted: [],
					declined: [],
				}),
				invitedBy: t.string().default(''),
				inviteToken: t.string().default(''),
				expiresAt: t.number(),
				createdAt: t.number(),
			},
			indexes: ['formId', 'userId', 'email', 'status', 'inviteToken', 'invitedBy'],
			constraints: [{
				type: 'unique',
				fields: ['formId', 'email'],
				onConflict: 'last-write-wins',
			}],
			// Invitations are written by the collaborator routes.
			access: { read: member('formId', 'viewer', FORM) },
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
					'collaborator_invited',
					'collaborator_accepted',
					'collaborator_declined',
					'collaborator_removed',
					'collaborator_left',
					'collaborator_role_changed',
				]),
				summary: t.string(),
				metadata: t.json<Record<string, unknown>>().default({}),
				createdAt: t.number(),
			},
			indexes: ['formId', 'actorId', 'eventType', 'createdAt'],
			access: {
				read: member('formId', 'viewer', FORM),
				// A member records their own actions; the server records the rest.
				create: and(owner('actorId'), member('formId', 'viewer', FORM)),
			},
		},
	},
})
