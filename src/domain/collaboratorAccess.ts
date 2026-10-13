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
 * Make form memberships match the collaborators table, both ways: every accepted
 * collaborator holds the membership their row says, and a form membership with no
 * accepted row is ended. Runs at startup, before sync connections are accepted, so it
 * also finishes a removal a crash interrupted. Kora leaves matching memberships alone.
 * Returns how many memberships were granted and revoked.
 */
export async function reconcileFormMemberships(
	kora: ProductionHttpRouteContext,
	access: AccessApi,
): Promise<{ granted: number; revoked: number }> {
	const accepted = await kora.query('form_collaborators', { where: { status: 'accepted' }, limit: 100_000 })
	const memberships = accepted
		.filter((row) => row.formId && row.userId)
		.map((row) => ({ userId: String(row.userId), group: formGroup(String(row.formId)), role: String(row.role ?? 'editor') }))
	const result = await access.backfill(memberships)
	if (result.failed.length > 0) {
		const first = result.failed[0]
		throw new Error(`Granting form memberships failed for ${result.failed.length} collaborator(s): ${first?.code} ${first?.message}`)
	}
	const wanted = new Set(memberships.map((m) => `${m.userId}\u0000${m.group[1]}`))
	let revoked = 0
	for (const row of await kora.query('members', { limit: 100_000 })) {
		const group = String(row.group ?? '')
		if (!group.startsWith('forms:')) continue
		const formId = group.slice('forms:'.length)
		const userId = String(row.userId ?? '')
		if (wanted.has(`${userId}\u0000${formId}`)) continue
		await revokeFormMembership(access, { formId, userId })
		revoked += 1
	}
	return { granted: result.granted, revoked }
}

/**
 * End a collaboration (removed by an admin, or the collaborator left): the collaborator
 * row is deleted (an accepted row cannot move to another status, and a deleted
 * invitation's link stops working), then the membership ends.
 */
export async function endCollaboration(
	kora: ProductionHttpRouteContext,
	access: AccessApi,
	collab: Pick<CollaboratorMembership, 'formId' | 'userId'> & { id: string },
): Promise<void> {
	// The row is the source of truth: delete it first, so a crash before the revoke is
	// finished by the startup reconciliation instead of re-granting the removed user.
	const result = await kora.apply({ collection: 'form_collaborators', type: 'delete', recordId: collab.id })
	if (!result.ok) {
		throw new Error(`Removing collaborator ${collab.id} failed: ${result.code} ${result.message}`)
	}
	await revokeFormMembership(access, collab)
}
