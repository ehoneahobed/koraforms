import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createKoraServer, createSqliteServerStore } from '@korajs/server'
import { SPACE_INVITATIONS } from '@korajs/spaces'
import schema from '../../src/schema'
import schemaV20 from '../fixtures/schema-v20'
import { createFormSharing } from '../../src/domain/sharing'

// A server database written by KoraForms at schema v20 (collaborators in `form_collaborators`,
// memberships in `members`) opened by v21: the startup move keeps everyone's access.

test('a v20 database upgrades to sharing with access kept and invitations re-sent', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'kf-sharing-upgrade-'))
	const filename = join(dir, 'server.db')
	try {
		// v20: alice owns f1; bob is an accepted admin; erin has bob's pending invitation.
		{
			const store = createSqliteServerStore({ filename })
			await store.setSchema(schemaV20, { accessRulesEnforced: true })
			const server = createKoraServer({ store, schema: schemaV20, experimentalAccessRules: true, accessSweepIntervalMs: 0 })
			const kora = server.getKoraContext()
			await kora.apply({ collection: 'forms', type: 'insert', recordId: 'f1', data: { title: 'Survey', ownerId: 'alice' } })
			const legacy = (recordId: string, data: Record<string, unknown>) =>
				kora.apply({
					collection: 'form_collaborators',
					type: 'insert',
					recordId,
					data: { formId: 'f1', email: `${recordId}@example.com`, expiresAt: Date.now() + 86_400_000, createdAt: 5, ...data },
				})
			await legacy('bob', { userId: 'bob', role: 'admin', status: 'accepted', invitedBy: 'alice' })
			await server.access.grant({ userId: 'bob', group: ['forms', 'f1'], role: 'admin' })
			await legacy('erin', { role: 'viewer', status: 'pending', invitedBy: 'bob' })
			assert.equal((await server.access.roleOf('bob', ['forms', 'f1']))?.role, 'admin')
			await server.stop?.()
			await store.close()
		}

		// v21 boot: schema, then the move, before devices connect.
		const store = createSqliteServerStore({ filename })
		await store.setSchema(schema, { accessRulesEnforced: true })
		const server = createKoraServer({ store, schema, experimentalAccessRules: true, accessSweepIntervalMs: 0 })
		const kora = server.getKoraContext()
		const sent: string[] = []
		const sharing = createFormSharing({
			auth: { routes: { authenticateAccess: async () => null }, userStore: { findByEmail: async () => null } },
			findUser: async (userId) => ({ email: `${userId}@example.com`, name: userId }),
			kora: () => kora,
			appUrl: 'https://forms.test',
			sendInvitation: async (to) => {
				sent.push(to)
			},
		})
		try {
			assert.deepEqual(await sharing.migrateLegacyMembers(kora, server.access), { members: 1, invitations: 0, dropped: 0, retained: 0 })
			assert.deepEqual(await sharing.resendLegacyInvitations(kora, server.access), { members: 0, invitations: 1, dropped: 0, retained: 0 })
			assert.equal((await server.access.roleOf('bob', ['forms', 'f1']))?.role, 'admin')
			assert.equal((await server.access.roleOf('alice', ['forms', 'f1']))?.role, 'owner')
			assert.deepEqual(sent, ['erin@example.com'])
			const [invitation] = await kora.query(SPACE_INVITATIONS, { where: { group: 'forms:f1' } })
			assert.equal(invitation?.invitedBy, 'bob')
			// Restarting moves nothing again.
			assert.deepEqual(await sharing.migrateLegacyMembers(kora, server.access), { members: 0, invitations: 0, dropped: 0, retained: 0 })
			assert.deepEqual(await sharing.resendLegacyInvitations(kora, server.access), { members: 0, invitations: 0, dropped: 0, retained: 0 })
		} finally {
			await server.stop?.()
			await store.close()
		}
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
