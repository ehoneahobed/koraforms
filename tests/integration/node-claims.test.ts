import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HybridLogicalClock, createOperation } from '@korajs/core'
import { createSqliteServerStore } from '@korajs/server'
import { createSqliteUserStore } from '@korajs/auth/server'
import schema from '../../src/schema'
import { bindLegacyDeviceNodeClaims, type NodeClaimStore } from '../../src/domain/nodeClaims'

// Real server and user stores. Operations applied straight to the store record
// no node claim, exactly like history written by a beta.7 server.
test('binds ownerless device nodes to the device owner, once, and never replaces a real claim', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'koraforms-claims-'))
	const store = createSqliteServerStore({ filename: join(dir, 'server.db') })
	const users = await createSqliteUserStore({ filename: join(dir, 'server.db') })
	try {
		await store.setSchema(schema)
		const alice = await users.createUser({ email: 'alice@example.test', passwordHash: 'x', salt: 'y', name: 'Alice' })
		const bob = await users.createUser({ email: 'bob@example.test', passwordHash: 'x', salt: 'y', name: 'Bob' })
		const legacy = '11111111-1111-4111-8111-111111111111' // Alice's browser, written by beta.7
		const claimed = '22222222-2222-4222-8222-222222222222' // a node Bob already claimed
		const unknown = '33333333-3333-4333-8333-333333333333' // history with no auth device
		await users.registerDevice({ id: legacy, userId: alice.id, publicKey: 'k', name: 'browser' })
		await users.registerDevice({ id: claimed, userId: alice.id, publicKey: 'k', name: 'browser' })
		for (const nodeId of [legacy, claimed, unknown]) {
			const op = await createOperation({
				nodeId,
				type: 'insert',
				collection: 'forms',
				recordId: `form-${nodeId}`,
				data: { title: 'Legacy', ownerId: alice.id },
				previousData: null,
				sequenceNumber: 1,
				causalDeps: [],
				schemaVersion: 19,
			}, new HybridLogicalClock(nodeId))
			await store.applyRemoteOperation(op)
		}
		const claims = store as unknown as Required<NodeClaimStore>
		assert.equal(await claims.getNodeClaimOwner(legacy), null)
		await claims.releaseNodeClaim(claimed)
		assert.equal(await claims.claimNode(claimed, bob.id), true)

		const first = await bindLegacyDeviceNodeClaims(store, users)
		assert.deepEqual(first, { nodes: 3, devices: 2, bound: 1, alreadyClaimed: 1, failed: 0, supported: true })
		assert.equal(await claims.getNodeClaimOwner(legacy), alice.id)
		assert.equal(await claims.getNodeClaimOwner(claimed), bob.id, 'a real claim is kept')
		assert.equal(await claims.getNodeClaimOwner(unknown), null)

		const second = await bindLegacyDeviceNodeClaims(store, users)
		assert.deepEqual(second, { nodes: 3, devices: 2, bound: 0, alreadyClaimed: 2, failed: 0, supported: true })
	} finally {
		await store.close()
		rmSync(dir, { recursive: true, force: true })
	}
})

test('a released node (owner "") is bound; stores without claim support are reported, not touched', async () => {
	const calls: string[] = []
	const store: NodeClaimStore = {
		getNodeIdsAfterDelivery: async () => ['kora:server:1', 'dev-1'],
		getNodeClaimOwner: async () => '',
		releaseNodeClaim: async nodeId => { calls.push(`release ${nodeId}`); return true },
		claimNode: async (nodeId, userId) => { calls.push(`claim ${nodeId} ${userId}`); return true },
	}
	const result = await bindLegacyDeviceNodeClaims(store, { findDevice: async id => (id === 'dev-1' ? { userId: 'u1' } : null) })
	assert.equal(result.bound, 1)
	assert.deepEqual(calls, ['release dev-1', 'claim dev-1 u1'])
	assert.equal((await bindLegacyDeviceNodeClaims({}, { findDevice: async () => null })).supported, false)
})
