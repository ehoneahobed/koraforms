import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryServerStore, createKoraServer } from '@korajs/server'
import type { ProductionHttpRouteResponse } from '@korajs/server'
import { SPACE_INVITATIONS, SPACE_MEMBERS } from '@korajs/spaces'
import schema from '../../src/schema'
import { createFormSharing, type InvitationEmail } from '../../src/domain/sharing'

// Sharing goes through @korajs/spaces; collaborators kept before schema v21 move into it at
// startup: accepted ones become members, pending invitations are sent again with new links.

interface TestUser {
	id: string
	email: string
	name: string
	emailVerified: boolean
}

const USERS: TestUser[] = [
	{ id: 'alice', email: 'alice@example.com', name: 'Alice', emailVerified: true },
	{ id: 'bob', email: 'bob@example.com', name: 'Bob', emailVerified: true },
	{ id: 'carol', email: 'carol@example.com', name: 'Carol', emailVerified: false },
	{ id: 'dan', email: 'dan@example.com', name: 'Dan', emailVerified: true },
]

async function setup(options: { failMail?: boolean } = {}) {
	const store = new MemoryServerStore()
	await store.setSchema(schema)
	const server = createKoraServer({ store, schema, accessSweepIntervalMs: 0 })
	const kora = server.getKoraContext()
	const sent: Array<{ to: string } & InvitationEmail> = []
	const sharing = createFormSharing({
		auth: {
			routes: {
				// The bearer token is the user id in these tests.
				authenticateAccess: async (token) => {
					const user = USERS.find((u) => u.id === token)
					return user ? { user: { id: user.id, email: user.email, emailVerified: user.emailVerified } } : null
				},
			},
			userStore: { findByEmail: async (email) => USERS.find((u) => u.email === email) ?? null },
		},
		findUser: async (userId) => {
			const user = USERS.find((u) => u.id === userId)
			return user ? { email: user.email, name: user.name } : null
		},
		kora: () => kora,
		appUrl: 'https://forms.test',
		sendInvitation: async (to, email) => {
			if (options.failMail) throw new Error('mail down')
			sent.push({ to, ...email })
		},
	})
	const call = async (
		user: string | null,
		path: string,
		body: Record<string, unknown> | null = null,
		method = 'POST',
		query: Record<string, string> = {},
	): Promise<ProductionHttpRouteResponse> => {
		const route = path.startsWith('/api/forms/people') ? sharing.peopleRoute : sharing.route
		return route.handle({
			method,
			path,
			query,
			headers: user ? { authorization: `Bearer ${user}` } : {},
			body: body ?? undefined,
			kora,
			access: server.access,
		})
	}
	const legacy = (recordId: string, data: Record<string, unknown>) =>
		kora.apply({
			collection: 'form_collaborators',
			type: 'insert',
			recordId,
			data: { formId: 'f1', email: `${recordId}@example.com`, expiresAt: Date.now() + 86_400_000, createdAt: 1_000, ...data },
		})
	await kora.apply({ collection: 'forms', type: 'insert', recordId: 'f1', data: { title: 'Survey', ownerId: 'alice' } })
	const roleOf = async (userId: string, formId = 'f1') => (await server.access.roleOf(userId, ['forms', formId]))?.role ?? null
	return { server, kora, sharing, sent, call, legacy, roleOf }
}

const tokenOf = (url: string): string => url.split('#')[1] ?? ''

test('accepted collaborators become members with their role, once', async () => {
	const { server, kora, sharing, legacy, roleOf } = await setup()
	try {
		await legacy('bob', { userId: 'bob', role: 'viewer', status: 'accepted', invitedBy: 'alice' })
		assert.deepEqual(await sharing.migrateLegacyMembers(kora, server.access), { members: 1, invitations: 0, dropped: 0, retained: 0 })
		assert.equal(await roleOf('bob'), 'viewer')
		assert.equal(await roleOf('alice'), 'owner')
		const [row] = await kora.query(SPACE_MEMBERS, { where: { userId: 'bob' } })
		assert.equal(row?.invitedBy, 'alice')
		assert.equal(await kora.findById('form_collaborators', 'bob'), null, 'the legacy row is gone')
		assert.deepEqual(await sharing.migrateLegacyMembers(kora, server.access), { members: 0, invitations: 0, dropped: 0, retained: 0 })
	} finally {
		await server.stop?.()
	}
})

test('a deleted form keeps no collaborator access', async () => {
	const { server, kora, sharing, legacy, roleOf } = await setup()
	try {
		await legacy('bob', { userId: 'bob', role: 'editor', status: 'accepted', invitedBy: 'alice' })
		await kora.apply({ collection: 'forms', type: 'delete', recordId: 'f1' })
		const report = await sharing.migrateLegacyMembers(kora, server.access)
		assert.equal(report.dropped, 1)
		assert.equal(await roleOf('bob'), null)
		assert.equal(await kora.findById('form_collaborators', 'bob'), null)
	} finally {
		await server.stop?.()
	}
})

test('pending invitations are sent again with new links; expired, declined and unauthorized ones are dropped', async () => {
	const { server, kora, sharing, sent, legacy } = await setup()
	try {
		await legacy('bob', { userId: 'bob', role: 'admin', status: 'accepted', invitedBy: 'alice' })
		await legacy('dan', { userId: 'dan', role: 'editor', status: 'accepted', invitedBy: 'alice' })
		await legacy('erin', { role: 'editor', status: 'pending', invitedBy: 'alice' })
		// Sent by an admin collaborator: re-sent once their membership is in place.
		await legacy('fay', { role: 'viewer', status: 'pending', invitedBy: 'bob' })
		// An editor cannot invite.
		await legacy('gus', { role: 'viewer', status: 'pending', invitedBy: 'dan' })
		await legacy('hal', { role: 'viewer', status: 'pending', invitedBy: 'alice', expiresAt: 1 })
		await legacy('ivy', { role: 'viewer', status: 'declined', invitedBy: 'alice' })
		assert.deepEqual(await sharing.migrateLegacyMembers(kora, server.access), { members: 2, invitations: 0, dropped: 0, retained: 0 })
		assert.deepEqual(await sharing.resendLegacyInvitations(kora, server.access), { members: 0, invitations: 2, dropped: 3, retained: 0 })
		assert.deepEqual(sent.map((m) => [m.to, m.role, m.formTitle]).sort(), [['erin@example.com', 'editor', 'Survey'], ['fay@example.com', 'viewer', 'Survey']])
		assert.ok(sent.every((m) => m.url.startsWith('https://forms.test/invite#')))
		const pending = await kora.query(SPACE_INVITATIONS, { where: { group: 'forms:f1' } })
		assert.deepEqual(pending.map((i) => [i.email, i.invitedBy]).sort(), [['erin@example.com', 'alice'], ['fay@example.com', 'bob']])
		assert.equal((await kora.query('form_collaborators', { limit: 100 })).length, 0)
	} finally {
		await server.stop?.()
	}
})

test('a row for a deleted form is dropped without stopping the others; an invitation whose email fails is kept', async () => {
	const { server, kora, sharing, legacy, roleOf } = await setup({ failMail: true })
	try {
		await legacy('bob', { userId: 'bob', role: 'editor', status: 'accepted', invitedBy: 'alice' })
		await legacy('ghost', { userId: 'ghost', formId: 'gone', role: 'editor', status: 'accepted', invitedBy: 'alice' })
		await legacy('erin', { role: 'editor', status: 'pending', invitedBy: 'alice' })
		assert.deepEqual(await sharing.migrateLegacyMembers(kora, server.access), { members: 1, invitations: 0, dropped: 1, retained: 0 })
		assert.equal(await roleOf('bob'), 'editor')
		assert.deepEqual(await sharing.resendLegacyInvitations(kora, server.access), { members: 0, invitations: 0, dropped: 0, retained: 1 })
		assert.ok(await kora.findById('form_collaborators', 'erin'), 'kept for the next start')
	} finally {
		await server.stop?.()
	}
})

test('re-sending an invitation does not count against the 20-person limit, and expired ones hold no seat', async () => {
	const { server, call } = await setup()
	try {
		for (let i = 0; i < 20; i++) {
			assert.equal((await call('alice', '/api/spaces/invitations/create', { space: ['forms', 'f1'], email: `p${i}@example.com`, role: 'viewer' })).status, 200)
		}
		const resent = await call('alice', '/api/spaces/invitations/create', { space: ['forms', 'f1'], email: 'p0@example.com', role: 'viewer' })
		assert.equal(resent.status, 200, JSON.stringify(resent.body))
	} finally {
		await server.stop?.()
	}
})

test('invite, describe and accept through the routes; the people list is for members', async () => {
	const { server, kora, sent, call, roleOf } = await setup()
	try {
		assert.equal((await call('alice', '/api/spaces/invitations/create', { space: ['forms', 'f1'], email: 'bob@example.com', role: 'editor' })).status, 200)
		const token = tokenOf(sent[0]?.url ?? '')
		const described = await call('bob', '/api/spaces/invitations/describe', { token })
		assert.equal(described.status, 200)
		assert.deepEqual((described.body as { details?: unknown }).details, { title: 'Survey', inviterName: 'Alice' })
		assert.equal((await call('bob', '/api/spaces/invitations/accept', { token })).status, 200)
		assert.equal(await roleOf('bob'), 'editor')

		const people = await call('bob', '/api/forms/people', null, 'GET', { formId: 'f1' })
		assert.equal(people.status, 200)
		assert.deepEqual(
			(people.body as { people: Array<{ userId: string; name: string }> }).people.map((p) => [p.userId, p.name]).sort(),
			[['alice', 'Alice'], ['bob', 'Bob']],
		)
		assert.equal((await call('dan', '/api/forms/people', null, 'GET', { formId: 'f1' })).status, 404)

		const events = await kora.query('audit_events', { where: { formId: 'f1' }, limit: 10 })
		assert.deepEqual(events.map((e) => e.eventType).sort(), ['collaborator_accepted', 'collaborator_invited'])
	} finally {
		await server.stop?.()
	}
})

test('an unverified invitee is asked to verify before accepting', async () => {
	const { server, sent, call, roleOf } = await setup()
	try {
		await call('alice', '/api/spaces/invitations/create', { space: ['forms', 'f1'], email: 'carol@example.com', role: 'viewer' })
		const token = tokenOf(sent[0]?.url ?? '')
		const described = await call('carol', '/api/spaces/invitations/describe', { token })
		assert.equal((described.body as { match: string }).match, 'unverified')
		const accepted = await call('carol', '/api/spaces/invitations/accept', { token })
		assert.equal((accepted.body as { error: { code: string } }).error.code, 'EMAIL_NOT_VERIFIED')
		assert.equal(await roleOf('carol'), null)
	} finally {
		await server.stop?.()
	}
})

test('a form takes up to 20 people besides its owner', async () => {
	const { server, call } = await setup()
	try {
		for (let i = 0; i < 20; i++) {
			const res = await call('alice', '/api/spaces/invitations/create', { space: ['forms', 'f1'], email: `p${i}@example.com`, role: 'viewer' })
			assert.equal(res.status, 200)
		}
		const refused = await call('alice', '/api/spaces/invitations/create', { space: ['forms', 'f1'], email: 'p20@example.com', role: 'viewer' })
		assert.equal((refused.body as { error: { code: string } }).error.code, 'INVITE_REFUSED')
	} finally {
		await server.stop?.()
	}
})
