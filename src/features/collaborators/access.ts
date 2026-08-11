import type { CollaboratorRole } from '../../types'

export interface CollaboratorRecord extends Record<string, unknown> {
	id?: string
	formId: string
	userId: string
	email: string
	role: CollaboratorRole
	status: 'pending' | 'accepted' | 'declined'
	invitedBy: string
	inviteToken: string
	expiresAt: number
	createdAt: number
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

/** Determine user's effective role for a form */
export function getEffectiveRole(
	formOwnerId: string,
	userId: string,
	collaborators: readonly CollaboratorRecord[],
): { role: 'owner' | CollaboratorRole; capabilities: Capabilities } | null {
	if (formOwnerId === userId) {
		return { role: 'owner', capabilities: getOwnerCapabilities() }
	}
	const collab = collaborators.find(
		c => c.userId === userId && c.status === 'accepted',
	)
	if (!collab) return null
	return { role: collab.role, capabilities: getRoleCapabilities(collab.role) }
}

/** Check if a user has any access to a form (owner or accepted collaborator) */
export function hasFormAccess(
	formOwnerId: string,
	userId: string,
	collaborators: readonly CollaboratorRecord[],
): boolean {
	return getEffectiveRole(formOwnerId, userId, collaborators) !== null
}

/** Check if a user can manage collaborators (owner or admin) */
export function canManageCollaborators(
	formOwnerId: string,
	userId: string,
	collaborators: readonly CollaboratorRecord[],
): boolean {
	const effective = getEffectiveRole(formOwnerId, userId, collaborators)
	return effective?.capabilities.canManageCollaborators ?? false
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

/** Maximum collaborators per form */
export const MAX_COLLABORATORS_PER_FORM = 20

/** Invitation expiry duration (7 days) */
export const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000
