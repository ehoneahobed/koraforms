import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryServerStore, createKoraServer } from '@korajs/server'
import schema from '../../src/schema'
import { endCollaboration, grantFormMembership, reconcileFormMemberships, revokeFormMembership } from '../../src/domain/collaboratorAccess'

// Accepted collaborations become form memberships: at startup for rows accepted before
// access rules existed, and through the collaborator routes afterwards.

async function setup() {
	const store = new MemoryServerStore()
	await store.setSchema(schema, { accessRulesEnforced: true })
	const server = createKoraServer({ store, schema, experimentalAccessRules: true, accessSweepIntervalMs: 0 })
	const kora = server.getKoraContext()
	await kora.apply({ collection: 'forms', type: 'insert', recordId: 'f1', data: { title: 'Survey', ownerId: 'alice' } })
	const collaborator = (recordId: string, data: Record<string, unknown>) =>
		kora.apply({
			collection: 'form_collaborators',
			type: 'insert',
			recordId,
			data: { formId: 'f1', email: `${recordId}@example.com`, expiresAt: 0, createdAt: 0, ...data },
		})
	return { store, server, kora, collaborator }
}

test('startup backfill grants accepted collaborators their role, once', async () => {
	const { store, server, collaborator } = await setup()
	try {
		await collaborator('bob', { userId: 'bob', role: 'viewer', status: 'accepted' })
		await collaborator('carol', { role: 'editor' }) // pending: no user yet
		assert.deepEqual(await reconcileFormMemberships(server.getKoraContext(), server.access), { granted: 1, revoked: 0 })
		const bob = (await store.getMembershipIntervals?.('bob')) ?? []
		assert.deepEqual(bob.map((i) => [i.group, i.role, i.leftSeq]), [['forms:f1', 'viewer', null]])
		assert.deepEqual(await reconcileFormMemberships(server.getKoraContext(), server.access), { granted: 0, revoked: 0 }, 'a matching membership is left alone')
		// The owner is a member through the form itself.
		const alice = (await store.getMembershipIntervals?.('alice')) ?? []
		assert.deepEqual(alice.map((i) => [i.group, i.role, i.source]), [['forms:f1', 'owner', 'owner']])
	} finally {
		await server.stop?.()
	}
})

test('a role change and a removal move the membership', async () => {
	const { store, server } = await setup()
	try {
		const collab = { formId: 'f1', userId: 'bob', role: 'viewer', status: 'accepted' }
		await grantFormMembership(server.access, collab)
		await grantFormMembership(server.access, { ...collab, role: 'admin' })
		assert.equal((await store.getMembershipIntervals?.('bob'))?.[0]?.role, 'admin')
		await revokeFormMembership(server.access, collab)
		assert.notEqual((await store.getMembershipIntervals?.('bob'))?.[0]?.leftSeq, null)
		await grantFormMembership(server.access, { ...collab, status: 'pending' })
		assert.equal((await store.getMembershipIntervals?.('bob'))?.length, 1, 'a pending invitation grants nothing')
	} finally {
		await server.stop?.()
	}
})

test('removing an accepted collaborator ends the membership and the collaboration', async () => {
	const { store, server, kora, collaborator } = await setup()
	try {
		await collaborator('bob', { userId: 'bob', role: 'editor', status: 'accepted' })
		await grantFormMembership(server.access, { formId: 'f1', userId: 'bob', role: 'editor', status: 'accepted' })
		await endCollaboration(kora, server.access, { id: 'bob', formId: 'f1', userId: 'bob' })
		const bob = (await store.getMembershipIntervals?.('bob')) ?? []
		assert.ok(bob.every((i) => i.leftSeq !== null), 'no live membership remains')
		assert.equal(await kora.findById('form_collaborators', 'bob'), null)
	} finally {
		await server.stop?.()
	}
})

test('startup reconciliation finishes a removal a crash interrupted', async () => {
	const { store, server, kora } = await setup()
	try {
		// The collaborator row was deleted, but the process stopped before the revoke.
		await grantFormMembership(server.access, { formId: 'f1', userId: 'bob', role: 'editor', status: 'accepted' })
		assert.deepEqual(await reconcileFormMemberships(kora, server.access), { granted: 0, revoked: 1 })
		const bob = (await store.getMembershipIntervals?.('bob')) ?? []
		assert.ok(bob.every((i) => i.leftSeq !== null), 'no live membership remains')
	} finally {
		await server.stop?.()
	}
})
