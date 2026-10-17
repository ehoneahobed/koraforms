import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HybridLogicalClock, createOperation } from '@korajs/core'
import { createSqliteServerStore } from '@korajs/server'
import schema from '../../src/schema'

// KoraForms relies on Kora's device node handover (beta.14) instead of binding
// legacy node claims at boot. This pins the store half of it on our own schema:
// a node with history but no owner (written before claims existed) is claimed
// atomically by the first user, and a node with an owner is never taken over.
test('an ownerless legacy node is handed to its device owner once, never taken from an owner', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'koraforms-claims-'))
	const store = createSqliteServerStore({ filename: join(dir, 'server.db') })
	try {
		await store.setSchema(schema)
		const legacy = '11111111-1111-4111-8111-111111111111'
		const op = await createOperation({
			nodeId: legacy,
			type: 'insert',
			collection: 'forms',
			recordId: 'form-legacy',
			data: { title: 'Legacy', ownerId: 'alice' },
			previousData: null,
			sequenceNumber: 1,
			causalDeps: [],
			schemaVersion: 19,
		}, new HybridLogicalClock(legacy))
		await store.applyRemoteOperation(op)

		assert.ok(store.claimUnownedNode, 'the server store supports device node handover')
		assert.equal(await store.getNodeClaimOwner?.(legacy), null, 'legacy history records no claim')
		assert.equal(await store.claimUnownedNode(legacy, 'alice'), true)
		assert.equal(await store.getNodeClaimOwner?.(legacy), 'alice')
		assert.equal(await store.claimUnownedNode(legacy, 'mallory'), false, 'an owned node is never handed over')
		assert.equal(await store.getNodeClaimOwner?.(legacy), 'alice')
	} finally {
		await store.close()
		rmSync(dir, { recursive: true, force: true })
	}
})
