import type { AccessApi, ProductionHttpRouteContext } from '@korajs/server'

/** The parts of a `form_collaborators` row that decide a membership. */
export interface CollaboratorMembership {
	formId: string
	userId: string
	role: string
	status: string
}

/** The access group of a form (`forms:<id>`). */
export function formGroup(formId: string): readonly ['forms', string] {
	return ['forms', formId]
}

/**
 * Make an accepted collaborator a member of the form with their role, so their devices
 * sync the form, its responses and its analytics. A row that is not accepted, or names
 * no user, grants nothing.
 */
export async function grantFormMembership(access: AccessApi, collab: CollaboratorMembership): Promise<void> {
	if (collab.status !== 'accepted' || !collab.userId || !collab.formId) return
	const result = await access.grant({ userId: collab.userId, group: formGroup(collab.formId), role: collab.role })
	if (!result.ok) {
		throw new Error(`Granting ${collab.userId} access to form ${collab.formId} failed: ${result.code} ${result.message}`)
	}
}

/** End a collaborator's membership: their devices drop the form at once. */
export async function revokeFormMembership(access: AccessApi, collab: Pick<CollaboratorMembership, 'formId' | 'userId'>): Promise<void> {
	if (!collab.userId || !collab.formId) return
	const result = await access.revoke({ userId: collab.userId, group: formGroup(collab.formId) })
	if (result && !result.ok) {
		throw new Error(`Revoking ${collab.userId} from form ${collab.formId} failed: ${result.code} ${result.message}`)
	}
}

/**
 * Give every accepted collaborator the membership their row says, for collaborations
 * accepted before access rules existed (and any grant a crash interrupted). Runs at
 * startup; Kora leaves memberships that already match alone. Returns how many were
 * granted.
 */
export async function backfillFormMemberships(
	kora: ProductionHttpRouteContext,
	access: AccessApi,
): Promise<number> {
	const accepted = await kora.query('form_collaborators', { where: { status: 'accepted' }, limit: 100_000 })
	const memberships = accepted
		.filter((row) => row.formId && row.userId)
		.map((row) => ({ userId: String(row.userId), group: formGroup(String(row.formId)), role: String(row.role ?? 'editor') }))
	const result = await access.backfill(memberships)
	if (result.failed.length > 0) {
		const first = result.failed[0]
		throw new Error(`Backfilling form memberships failed for ${result.failed.length} collaborator(s): ${first?.code} ${first?.message}`)
	}
	return result.granted
}

/**
 * End a collaboration (removed by an admin, or the collaborator left): the membership
 * goes first, so the person loses access even if anything after it fails, then the
 * collaborator row is deleted (an accepted row cannot move to another status, and a
 * deleted invitation's link stops working).
 */
export async function endCollaboration(
	kora: ProductionHttpRouteContext,
	access: AccessApi,
	collab: Pick<CollaboratorMembership, 'formId' | 'userId'> & { id: string },
): Promise<void> {
	await revokeFormMembership(access, collab)
	const result = await kora.apply({ collection: 'form_collaborators', type: 'delete', recordId: collab.id })
	if (!result.ok) {
		throw new Error(`Removing collaborator ${collab.id} failed: ${result.code} ${result.message}`)
	}
}
