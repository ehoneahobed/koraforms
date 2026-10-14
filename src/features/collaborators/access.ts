import type { CollaboratorRole, FormRole } from '../../types'

/** A form role, or null for a role this version does not know (shown as the lowest). */
export function asFormRole(role: string | null | undefined): FormRole | null {
	return role === 'viewer' || role === 'editor' || role === 'admin' || role === 'owner' ? role : null
}

/** A member's role as the panel shows it: an unknown role reads as viewer. */
export function collaboratorRole(role: string | null | undefined): CollaboratorRole {
	const known = asFormRole(role)
	return known && known !== 'owner' ? known : 'viewer'
}

/** Permission capabilities by role */
const ROLE_CAPABILITIES = {
	viewer: {
		canViewForm: true,
		canEditForm: false,
		canViewResponses: true,
		canDeleteResponses: false,
		canManageCollaborators: false,
		canDeleteForm: false,
		canPublish: false,
		canManageSettings: false,
	},
	editor: {
		canViewForm: true,
		canEditForm: true,
		canViewResponses: true,
		canDeleteResponses: false,
		canManageCollaborators: false,
		canDeleteForm: false,
		canPublish: true,
		canManageSettings: true,
	},
	admin: {
		canViewForm: true,
		canEditForm: true,
		canViewResponses: true,
		canDeleteResponses: true,
		canManageCollaborators: true,
		canDeleteForm: false,
		canPublish: true,
		canManageSettings: true,
	},
} as const

export interface Capabilities {
	canViewForm: boolean
	canEditForm: boolean
	canViewResponses: boolean
	canDeleteResponses: boolean
	canManageCollaborators: boolean
	canDeleteForm: boolean
	canPublish: boolean
	canManageSettings: boolean
}

/** Get capabilities for a given role */
export function getRoleCapabilities(role: CollaboratorRole): Capabilities {
	return ROLE_CAPABILITIES[role]
}

/** Owner has all capabilities */
export function getOwnerCapabilities(): Capabilities {
	return {
		canViewForm: true,
		canEditForm: true,
		canViewResponses: true,
		canDeleteResponses: true,
		canManageCollaborators: true,
		canDeleteForm: true,
		canPublish: true,
		canManageSettings: true,
	}
}

/** Capabilities of a role in a form. */
export function capabilitiesOf(role: FormRole): Capabilities {
	return role === 'owner' ? getOwnerCapabilities() : getRoleCapabilities(role)
}

/** Role display labels */
export const ROLE_LABELS: Record<CollaboratorRole, string> = {
	viewer: 'Viewer',
	editor: 'Editor',
	admin: 'Admin',
}

/** Role descriptions for UI */
export const ROLE_DESCRIPTIONS: Record<CollaboratorRole, string> = {
	viewer: 'Can view form and responses',
	editor: 'Can edit form and view responses',
	admin: 'Full access except deleting the form',
}

/** People per form besides its owner: members and pending invitations together. */
export { MAX_PEOPLE_PER_FORM } from '../../domain/limits'
