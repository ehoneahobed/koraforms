import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@korajs/react'
import { useMyRole } from '@korajs/spaces/react'
import { app } from '../../kora'
import { authClient } from '../../auth'
import type { FormRole } from '../../types'
import { asFormRole } from './access'
import { formSpace } from './spaces'

/** Ids of the forms the user is a member of (not the ones they own). */
export function useSharedFormIds(userId: string): string[] {
	const rows = useQuery(app.space_members.where({ userId }), { enabled: userId !== '' })
	return useMemo(
		() => rows.map((row) => String(row.group)).filter((group) => group.startsWith('forms:')).map((group) => group.slice('forms:'.length)),
		[rows],
	)
}

/** The user's role in a form, from the local store (works offline). */
export function useFormRole(
	formId: string,
	userId: string,
): { role: FormRole; isOwner: boolean; isCollaborator: boolean } | null {
	const role = asFormRole(useMyRole(formId ? formSpace(formId) : null, userId || null))
	return useMemo(
		() => (role ? { role, isOwner: role === 'owner', isCollaborator: role !== 'owner' } : null),
		[role],
	)
}

/** A person in a form: their address and name, as the server knows them. */
export interface FormPerson {
	userId: string
	email: string | null
	name: string | null
}

/**
 * Names and addresses of a form's people, fetched when the member list changes. Offline,
 * the last answer stays (and members show without a name until the next one).
 */
export function useFormPeople(formId: string, memberIds: readonly string[]): ReadonlyMap<string, FormPerson> {
	const [people, setPeople] = useState<ReadonlyMap<string, FormPerson>>(new Map())
	const key = [...memberIds].sort().join(',')
	useEffect(() => {
		if (!formId || key === '') return
		let cancelled = false
		void (async () => {
			try {
				const token = await authClient.getAccessToken()
				if (!token) return
				const base = import.meta.env.VITE_AUTH_URL || ''
				const res = await fetch(`${base}/api/forms/people?formId=${encodeURIComponent(formId)}`, {
					headers: { authorization: `Bearer ${token}` },
				})
				if (!res.ok) return
				const body = (await res.json()) as { people?: FormPerson[] }
				if (!cancelled) setPeople(new Map((body.people ?? []).map((person) => [person.userId, person])))
			} catch {
				// Offline: keep what we had.
			}
		})()
		return () => {
			cancelled = true
		}
	}, [formId, key])
	return people
}
