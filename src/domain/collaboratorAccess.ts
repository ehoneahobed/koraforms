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
 * startup; a membership that already matches is left alone. Returns how many were
 * granted.
 */
export async function backfillFormMemberships(
	kora: ProductionHttpRouteContext,
	access: AccessApi,
): Promise<number> {
	const accepted = await kora.query('form_collaborators', { where: { status: 'accepted' }, limit: 100_000 })
	let granted = 0
	for (const row of accepted) {
		const collab = {
			formId: String(row.formId ?? ''),
			userId: String(row.userId ?? ''),
			role: String(row.role ?? 'editor'),
			status: 'accepted',
		}
		if (!collab.formId || !collab.userId) continue
		const [existing] = await kora.query('members', {
			where: { userId: collab.userId, group: `forms:${collab.formId}` },
			limit: 1,
		})
		if (existing && existing.role === collab.role) continue
		await grantFormMembership(access, collab)
		granted += 1
	}
	return granted
}
