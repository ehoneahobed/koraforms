/**
 * Form sharing on the server, through @korajs/spaces: the invitation and membership routes,
 * the people list a form's members see, and the one-time move of collaborators kept before
 * schema v21 (`form_collaborators`) into the kit's collections. Server only.
 */
import { randomUUID } from 'node:crypto'
import type {
	AccessApi,
	ProductionHttpRoute,
	ProductionHttpRouteContext,
	ProductionHttpRouteRequest,
	ProductionHttpRouteResponse,
} from '@korajs/server'
import { SPACE_INVITATIONS, SPACE_MEMBERS } from '@korajs/spaces'
import {
	type KoraAuthIdentitySource,
	type SpacesEvent,
	type SpacesIdentity,
	koraAuthIdentity,
	spacesRoutes,
} from '@korajs/spaces/server'
import { safeJsonParse } from './forms'
import { MAX_PEOPLE_PER_FORM } from './limits'
import { sharing } from '../schema'

/** Where the sharing routes live. */
export const SPACES_BASE_PATH = '/api/spaces'

/** The invitee-facing part of an invitation email. */
export interface InvitationEmail {
	inviterName: string
	formTitle: string
	role: string
	url: string
}

export interface FormSharingOptions {
	auth: KoraAuthIdentitySource
	/** A user's address and name, for the people list and audit summaries. */
	findUser(userId: string): Promise<{ email: string; name: string | null } | null>
	/** The server's data plane, for describing invitations and writing audit events. */
	kora(): ProductionHttpRouteContext
	/** The page an invitation link opens. */
	appUrl: string
	/** Send an invitation email. Null: the inviter receives the link instead (development). */
	sendInvitation: ((to: string, email: InvitationEmail) => Promise<void>) | null
}

/** Outcome of moving pre-v21 collaborators into the sharing collections. */
export interface LegacyMigrationReport {
	/** Accepted collaborators who are now members. */
	members: number
	/** Pending invitations sent again through the kit (each with a new link). */
	invitations: number
	/** Rows dropped: declined, expired, of a deleted form, or no longer allowed. */
	dropped: number
	/** Rows left for the next start (a transient failure). */
	retained: number
}

export interface FormSharing {
	/** The kit's routes, mounted at {@link SPACES_BASE_PATH}. */
	route: ProductionHttpRoute
	/** `GET /api/forms/people?formId=`: names and addresses of a form's people, for its members. */
	peopleRoute: ProductionHttpRoute
	/**
	 * Make accepted `form_collaborators` rows members of their forms, then delete them. Run
	 * at startup, before devices connect, so nobody reconnects without access. A row is
	 * deleted only once moved; one the access engine refuses is kept and logged.
	 */
	migrateLegacyMembers(kora: ProductionHttpRouteContext, access: AccessApi): Promise<LegacyMigrationReport>
	/**
	 * Send pending `form_collaborators` invitations again through the kit, in the inviter's
	 * name (with new links), then delete them. Run after the members move; it sends email,
	 * so run it in the background once the server is up. Unsent ones are kept for the next start.
	 */
	resendLegacyInvitations(kora: ProductionHttpRouteContext, access: AccessApi): Promise<LegacyMigrationReport>
}

type AuditEventType =
	| 'collaborator_invited'
	| 'collaborator_accepted'
	| 'collaborator_declined'
	| 'collaborator_removed'
	| 'collaborator_left'
	| 'collaborator_role_changed'

const AUDIT_TYPES: Partial<Record<SpacesEvent['type'], AuditEventType>> = {
	'invitation.created': 'collaborator_invited',
	'invitation.resent': 'collaborator_invited',
	'invitation.revoked': 'collaborator_removed',
	'invitation.accepted': 'collaborator_accepted',
	'invitation.declined': 'collaborator_declined',
	'member.role-changed': 'collaborator_role_changed',
	'member.removed': 'collaborator_removed',
	'member.left': 'collaborator_left',
}

const formGroup = (formId: string): string => `forms:${formId}`

const LEGACY_ROLES = new Set(['viewer', 'editor', 'admin'])
/** Kit refusals worth trying again later: the invitation was not sent. */
const RETRY_LATER = new Set(['DELIVERY_FAILED', 'RATE_LIMITED', 'CONFLICT', 'INTERNAL', 'SPACE_NOT_SYNCED'])
const RATE_LIMIT_WAIT_MS = 61_000

function errorCode(response: ProductionHttpRouteResponse): string | null {
	return (response.body as { error?: { code?: string } } | undefined)?.error?.code ?? null
}

/** `jane@example.com` -> `j***@example.com`. */
function maskEmail(email: string): string {
	const at = email.indexOf('@')
	return at > 0 ? `${email[0]}***${email.slice(at)}` : '***'
}

/** Creates the sharing routes and the legacy migration for KoraForms. */
export function createFormSharing(options: FormSharingOptions): FormSharing {
	const identity = koraAuthIdentity(options.auth)
	// Requests the server makes itself (the legacy migration) act as a recorded user.
	const internalCallers = new WeakMap<object, SpacesIdentity>()

	async function formTitle(formId: string): Promise<string> {
		const form = await options.kora().findById('forms', formId)
		return String(form?.title || 'Untitled Form')
	}

	async function displayName(userId: string): Promise<string> {
		const user = await options.findUser(userId)
		return user?.name || user?.email || 'Someone'
	}

	async function audit(event: SpacesEvent): Promise<void> {
		const eventType = AUDIT_TYPES[event.type]
		if (!eventType) return
		const target = event.targetUserId ? await options.findUser(event.targetUserId) : null
		// Viewers read the audit log, and only managers may see who is invited: an
		// invitation's address is masked until the person joins.
		const invitee = event.email ? (event.type === 'invitation.accepted' ? event.email : maskEmail(event.email)) : null
		const who = invitee ?? target?.email ?? 'a collaborator'
		const summaries: Partial<Record<SpacesEvent['type'], string>> = {
			'invitation.created': `Invited ${who} as ${event.role}`,
			'invitation.resent': `Re-sent the invitation to ${who}`,
			'invitation.revoked': `Cancelled the invitation to ${who}`,
			'invitation.accepted': `${who} accepted the invitation as ${event.role}`,
			'invitation.declined': `${who} declined the invitation`,
			'member.role-changed': `Changed ${who} role to ${event.role}`,
			'member.removed': `Removed ${who}`,
			'member.left': `${who} left the form`,
		}
		const summary = summaries[event.type]
		const result = await options.kora().apply({
			collection: 'audit_events',
			type: 'insert',
			recordId: randomUUID(),
			data: {
				formId: event.space[1],
				actorId: event.actorId,
				actorType: 'user',
				eventType,
				summary: summary ?? eventType,
				metadata: {
					email: who,
					...(event.role ? { role: event.role } : {}),
					...(event.previousRole ? { previousRole: event.previousRole } : {}),
				},
				createdAt: Date.now(),
			},
		})
		if (!result.ok) throw new Error(`Audit event refused: ${result.code} ${result.message}`)
	}

	const routes = spacesRoutes({
		sharing,
		basePath: SPACES_BASE_PATH,
		...identity,
		identify: (request) => internalCallers.get(request) ?? identity.identify(request),
		acceptUrl: (token) => `${options.appUrl}/invite#${token}`,
		...(options.sendInvitation
			? {
					deliverInvitation: async (delivery) => {
						const send = options.sendInvitation
						if (!send) return
						await send(delivery.email, {
							inviterName: await displayName(delivery.invitedBy),
							formTitle: await formTitle(delivery.space[1]),
							role: delivery.role,
							url: delivery.url,
						})
					},
				}
			: {}),
		describeInvitation: async ({ space, invitedBy }) => ({
			title: await formTitle(space[1]),
			inviterName: await displayName(invitedBy),
		}),
		beforeInvite: async ({ space, email, request }) => {
			const group = formGroup(space[1])
			const [members, pending] = await Promise.all([
				request.kora.query(SPACE_MEMBERS, { where: { group }, limit: MAX_PEOPLE_PER_FORM + 1 }),
				request.kora.query(SPACE_INVITATIONS, { where: { group }, limit: MAX_PEOPLE_PER_FORM * 4 }),
			])
			// Expired invitations hold no seat, and re-sending one does not take another.
			const now = Date.now()
			const seats = pending.filter((row) => Number(row.expiresAt) > now && row.email !== email).length
			if (members.length + seats >= MAX_PEOPLE_PER_FORM) {
				return { message: `A form can have up to ${MAX_PEOPLE_PER_FORM} people besides its owner.` }
			}
			return null
		},
		onEvent: audit,
	})

	const route: ProductionHttpRoute = {
		path: routes.path,
		handle: (request) =>
			routes.handle(
				typeof request.body === 'string' ? { ...request, body: safeJsonParse<unknown>(request.body, null) } : request,
			),
	}

	const peopleRoute: ProductionHttpRoute = {
		path: '/api/forms/people',
		async handle(request) {
			if (request.method !== 'GET') return { status: 405, body: { error: 'Method not allowed' } }
			const caller = await identity.identify(request)
			if (!caller) return { status: 401, body: { error: 'Unauthorized' } }
			const raw = request.query?.formId
			const formId = typeof raw === 'string' ? raw : ''
			if (!formId || formId.length > 180) return { status: 400, body: { error: 'Form ID is required.' } }
			if (!(await request.access.roleOf(caller.userId, ['forms', formId]))) {
				return { status: 404, body: { error: 'Form not found' } }
			}
			const form = await request.kora.findById('forms', formId)
			const rows = await request.kora.query(SPACE_MEMBERS, { where: { group: formGroup(formId) }, limit: 200 })
			const ids = [...new Set([String(form?.ownerId ?? ''), ...rows.map((row) => String(row.userId ?? ''))])].filter(Boolean)
			const people = await Promise.all(
				ids.map(async (userId) => {
					const user = await options.findUser(userId)
					return { userId, email: user?.email ?? null, name: user?.name ?? null }
				}),
			)
			return { status: 200, headers: { 'Cache-Control': 'no-store' }, body: { people } }
		},
	}

	async function invokeAs(
		caller: SpacesIdentity,
		kora: ProductionHttpRouteContext,
		access: AccessApi,
		path: string,
		body: Record<string, unknown>,
	): Promise<ProductionHttpRouteResponse> {
		const request: ProductionHttpRouteRequest = {
			method: 'POST',
			path: `${SPACES_BASE_PATH}${path}`,
			headers: {},
			body,
			kora,
			access,
		}
		internalCallers.set(request, caller)
		return routes.handle(request)
	}

	async function dropLegacy(kora: ProductionHttpRouteContext, id: string): Promise<void> {
		const result = await kora.apply({ collection: 'form_collaborators', type: 'delete', recordId: id })
		if (!result.ok) throw new Error(`Removing legacy collaborator ${id} failed: ${result.code} ${result.message}`)
	}

	async function migrateLegacyMembers(
		kora: ProductionHttpRouteContext,
		access: AccessApi,
	): Promise<LegacyMigrationReport> {
		const report: LegacyMigrationReport = { members: 0, invitations: 0, dropped: 0, retained: 0 }
		const rows = await kora.query('form_collaborators', { where: { status: 'accepted' }, limit: 100_000 })
		for (const row of rows) {
			const id = String(row.id)
			const userId = String(row.userId ?? '')
			const formId = String(row.formId ?? '')
			if (!userId || !formId) {
				report.dropped += 1
				await dropLegacy(kora, id)
				continue
			}
			// One row at a time: a row the access engine refuses is kept and reported, and
			// stops neither the others nor the server.
			const role = LEGACY_ROLES.has(String(row.role)) ? String(row.role) : 'viewer'
			const result = await access.backfill([{ userId, group: ['forms', formId], role }]).catch((error: unknown) => ({
				granted: 0,
				unchanged: 0,
				missingGroups: [],
				failed: [{ code: 'BACKFILL_THREW', message: error instanceof Error ? error.message : String(error) }],
			}))
			if (result.failed.length > 0) {
				console.error(`Collaborator ${id} (user ${userId}, form ${formId}) kept for the next start: ${result.failed[0]?.code} ${result.failed[0]?.message}`)
				report.retained += 1
				continue
			}
			if (result.missingGroups.length > 0) {
				// The form was deleted: no access to carry over.
				report.dropped += 1
				await dropLegacy(kora, id)
				continue
			}
			const [member] = await kora.query(SPACE_MEMBERS, { where: { userId, group: formGroup(formId) }, limit: 1 })
			if (member && !member.invitedBy && row.invitedBy) {
				// Who invited them, as the member list shows it. Cosmetic: a refusal is logged.
				const updated = await kora.apply({ collection: SPACE_MEMBERS, type: 'update', recordId: String(member.id), data: { invitedBy: String(row.invitedBy) } })
				if (!updated.ok) console.warn(`Recording who invited ${userId} to ${formId} failed: ${updated.code}`)
			}
			report.members += 1
			await dropLegacy(kora, id)
		}
		return report
	}

	async function resendLegacyInvitations(
		kora: ProductionHttpRouteContext,
		access: AccessApi,
	): Promise<LegacyMigrationReport> {
		const report: LegacyMigrationReport = { members: 0, invitations: 0, dropped: 0, retained: 0 }
		const rows = await kora.query('form_collaborators', { limit: 100_000 })
		const now = Date.now()
		for (const row of rows) {
			const id = String(row.id)
			if (row.status === 'accepted') continue // left by the member move for its next start
			const inviter = String(row.invitedBy ?? '')
			if (row.status !== 'pending' || Number(row.expiresAt) <= now || !inviter || !row.formId || !row.email) {
				report.dropped += 1
				await dropLegacy(kora, id)
				continue
			}
			const body = {
				space: ['forms', String(row.formId)],
				email: String(row.email),
				role: LEGACY_ROLES.has(String(row.role)) ? String(row.role) : 'viewer',
			}
			let invited = await invokeAs({ userId: inviter }, kora, access, '/invitations/create', body)
			// The kit's limits count these like the inviter's own requests: wait them out.
			for (let attempt = 0; attempt < 3 && errorCode(invited) === 'RATE_LIMITED'; attempt++) {
				await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS))
				invited = await invokeAs({ userId: inviter }, kora, access, '/invitations/create', body)
			}
			const code = errorCode(invited)
			if (invited.status === 200) {
				const url = (invited.body as { url?: string } | undefined)?.url
				// No mailer (development): the link is only in the log.
				if (url) console.log(`Re-sent invitation for ${body.email}: ${url}`)
				report.invitations += 1
				await dropLegacy(kora, id)
			} else if (code && RETRY_LATER.has(code)) {
				// Not sent (the email failed, or a transient refusal): tried again at the next start.
				console.warn(`Legacy invitation ${id} kept for the next start: ${code}`)
				report.retained += 1
			} else {
				// The inviter can no longer invite, the person is already in, the form is gone.
				console.warn(`Legacy invitation ${id} not carried over: ${code ?? invited.status}`)
				report.dropped += 1
				await dropLegacy(kora, id)
			}
		}
		return report
	}

	return { route, peopleRoute, migrateLegacyMembers, resendLegacyInvitations }
}
