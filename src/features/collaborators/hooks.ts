import { useMemo } from 'react'
import { useQuery } from '@korajs/react'
import { app } from '../../kora'
import { getEffectiveRole, type CollaboratorRecord } from './access'
import type { CollaboratorRole } from '../../types'

/** Query all collaborator records for a specific form */
export function useFormCollaborators(formId: string): CollaboratorRecord[] {
	const all = useQuery(app.form_collaborators.where({ formId }))
	return all as unknown as CollaboratorRecord[]
}

/** Query all forms where the user is an accepted collaborator */
export function useSharedFormIds(userId: string): string[] {
	const allCollabs = useQuery(
		userId
			? app.form_collaborators.where({ userId, status: 'accepted' })
			: app.form_collaborators.where({ status: 'accepted' }),
	)
	return useMemo(
		() => allCollabs.map(c => String(c.formId)),
		[allCollabs],
	)
}

/** Get the current user's effective role for a form */
export function useFormRole(
	formOwnerId: string,
	userId: string,
	formId: string,
): { role: 'owner' | CollaboratorRole; isOwner: boolean; isCollaborator: boolean } | null {
	const collaborators = useFormCollaborators(formId)
	return useMemo(() => {
		const effective = getEffectiveRole(formOwnerId, userId, collaborators)
		if (!effective) return null
		return {
			role: effective.role,
			isOwner: effective.role === 'owner',
			isCollaborator: effective.role !== 'owner',
		}
	}, [formOwnerId, userId, collaborators])
}
