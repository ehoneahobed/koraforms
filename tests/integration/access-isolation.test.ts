import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServerTransportPair } from '@korajs/server/internal'
import type { SyncTransport } from '@korajs/sync'
import { TestDevice, TestServer } from '@korajs/test'
import schema from '../../src/schema'

// What each signed-in user's devices hold follows the schema's access rules: a form
// and its responses reach the owner and accepted collaborators only, a removed
// collaborator's devices drop them, and a viewer cannot edit. Built on Kora's public
// test harness: a TestServer that signs devices in, and a TestDevice per user.

class Device {
	readonly device: TestDevice
	constructor(dir: string, readonly user: string, server: TestServer) {
		this.device = new TestDevice({
			name: `${user}-device`,
			schema,
			server,
			tmpDir: dir,
			user,
			createTransportPair: () => {
				const pair = createServerTransportPair()
				return { client: pair.client as unknown as SyncTransport, serverTransport: pair.server }
			},
		})
	}

	get store() {
		return this.device.store
	}

	/** Refusal codes the server sent this device, oldest first. */
	async rejections(): Promise<string[]> {
		return (await this.device.getRejectedOperations()).map((rejected) => rejected.code)
	}

	async open(): Promise<void> {
		await this.device.open()
	}

	/** Sends this device's writes and takes in what the server has for it. */
	async sync(): Promise<void> {
		for (let round = 0; round < 3; round += 1) await this.device.sync()
	}

	async ids(collection: string): Promise<string[]> {
		const rows = (await this.store.collection(collection).where({}).exec()) as Array<{ id: string }>
		return rows.map((row) => row.id).sort()
	}

	async close(): Promise<void> {
		await this.device.close()
	}
}

async function createServer(): Promise<TestServer> {
	const server = new TestServer(schema, { auth: true, accessSweepIntervalMs: 0 })
	await server.ready
	return server
}

test('collected answers and published revisions cannot be rewritten, and audit entries name a user', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'koraforms-access-'))
	const server = await createServer()
	const alice = new Device(dir, 'alice', server)
	const bob = new Device(dir, 'bob', server)
	const stored = async (collection: string, id: string): Promise<Record<string, unknown> | undefined> => {
		const [row] = await server.getKoraContext().query(collection, { where: { id }, limit: 1 })
		return row as Record<string, unknown> | undefined
	}
	const refusedBy = async (device: Device, write: () => Promise<unknown>): Promise<boolean> => {
		const before = (await device.rejections()).length
		await write()
		await device.sync()
		return (await device.rejections()).length > before
	}
	try {
		await alice.open()
		await bob.open()
		const form = (await alice.store.collection('forms').insert({ title: 'Survey' })) as { id: string }
		const kept = (await alice.store.collection('responses').insert({ formId: form.id, submittedAt: 1 })) as { id: string }
		const removable = (await alice.store.collection('responses').insert({ formId: form.id, submittedAt: 2 })) as { id: string }
		const revision = (await alice.store.collection('public_form_versions').insert({
			slug: 'survey',
			formId: form.id,
			versionHash: 'v1',
			title: 'Survey',
			cachedAt: 1,
			publishedAt: 1,
		})) as { id: string }
		await alice.sync()
		await server.access.grant({ userId: 'bob', group: ['forms', form.id], role: 'admin' })
		await bob.sync()

		// Neither an admin nor the owner rewrites an answer someone submitted.
		assert.ok(await refusedBy(bob, () => bob.store.collection('responses').update(kept.id, { submittedAt: 99 })))
		assert.ok(await refusedBy(alice, () => alice.store.collection('responses').update(kept.id, { submittedAt: 98 })))
		assert.equal((await stored('responses', kept.id))?.submittedAt, 1)

		// Deleting a response stays with admins and the owner.
		await bob.store.collection('responses').delete(removable.id)
		await bob.sync()
		assert.equal(await stored('responses', removable.id), undefined)

		// A published revision is permanent, for its owner too.
		assert.ok(
			await refusedBy(alice, () => alice.store.collection('public_form_versions').update(revision.id, { title: 'Rewritten' })),
		)
		assert.equal((await stored('public_form_versions', revision.id))?.title, 'Survey')

		// A member's audit entry names them as a user, never the system or a respondent.
		const entry = { formId: form.id, actorId: 'bob', eventType: 'form_updated', summary: 'Edited', createdAt: 1 }
		assert.ok(await refusedBy(bob, () => bob.store.collection('audit_events').insert({ ...entry, actorType: 'system' })))
		assert.equal(
			await refusedBy(bob, () => bob.store.collection('audit_events').insert({ ...entry, actorType: 'user' })),
			false,
		)
	} finally {
		await alice.close()
		await bob.close()
		await server.close()
		rmSync(dir, { recursive: true, force: true })
	}
})

test('forms and responses reach their owner and collaborators only, and leave on removal', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'koraforms-access-'))
	const server = await createServer()
	const alice = new Device(dir, 'alice', server)
	const bob = new Device(dir, 'bob', server)
	try {
		await alice.open()
		await bob.open()
		// Alice creates a form (ownerId is filled with her id) and a sample response.
		const form = (await alice.store.collection('forms').insert({ title: 'Survey' })) as { id: string; ownerId: string }
		assert.equal(form.ownerId, 'alice')
		const response = (await alice.store.collection('responses').insert({ formId: form.id, submittedAt: 1 })) as { id: string }
		await alice.store.collection('response_filter_views').insert({ formId: form.id, name: 'Mine', createdAt: 1, updatedAt: 1 })
		await alice.sync()
		await bob.sync()
		assert.deepEqual(await bob.ids('forms'), [], 'nothing of Alice reaches Bob')
		assert.deepEqual(await bob.ids('responses'), [])

		// Bob accepts an invitation as a viewer.
		await server.access.grant({ userId: 'bob', group: ['forms', form.id], role: 'viewer' })
		await bob.sync()
		assert.deepEqual(await bob.ids('forms'), [form.id])
		assert.deepEqual(await bob.ids('responses'), [response.id])
		assert.deepEqual(await bob.ids('response_filter_views'), [], "Alice's saved views stay hers")

		// A viewer cannot edit the form: refused by the server, undone on Bob's device.
		await bob.store.collection('forms').update(form.id, { title: 'Hijacked' })
		await bob.sync()
		const refusals = await bob.rejections()
		assert.ok(refusals.includes('ACCESS_DENIED'), `refusals: ${refusals.join(', ')}`)
		const [stored] = await server.getKoraContext().query('forms', { where: { id: form.id }, limit: 1 })
		assert.equal(stored?.title, 'Survey')

		// An editor still cannot change collected results.
		await server.access.grant({ userId: 'bob', group: ['forms', form.id], role: 'editor' })
		await bob.sync()
		const refusalsBefore = (await bob.rejections()).length
		await bob.store.collection('responses').insert({ formId: form.id, submittedAt: 2 })
		await bob.sync()
		assert.ok((await bob.rejections()).length > refusalsBefore, 'an editor cannot add a response')
		assert.equal((await server.getKoraContext().query('responses', { where: { formId: form.id } })).length, 1)

		// Removed: Bob's device drops the form and its responses.
		await server.access.revoke({ userId: 'bob', group: ['forms', form.id] })
		await bob.sync()
		await alice.sync()
		assert.deepEqual(await bob.ids('forms'), [])
		assert.deepEqual(await bob.ids('responses'), [])
		assert.deepEqual(await alice.ids('forms'), [form.id], "the owner's devices keep it")
	} finally {
		await alice.close()
		await bob.close()
		await server.close()
		rmSync(dir, { recursive: true, force: true })
	}
})
