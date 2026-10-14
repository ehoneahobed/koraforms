import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Operation } from '@korajs/core'
import { MemoryServerStore, TokenAuthProvider, createKoraServer } from '@korajs/server'
import type { KoraSyncServer } from '@korajs/server'
import { createServerTransportPair } from '@korajs/server/internal'
import { Store } from '@korajs/store'
import { BetterSqlite3Adapter } from '@korajs/store/better-sqlite3'
import { MergeEngine } from '@korajs/merge'
import { SyncEngine } from '@korajs/sync'
import type { SyncTransport } from '@korajs/sync'
import { SimpleEventEmitter } from '@korajs/core/internal'
import { ApplyPipeline, MergeAwareSyncStore, StoreQueueStorage, StoreSyncStatePersistence } from 'korajs/testing'
import schema from '../../src/schema'

// What each signed-in user's devices hold follows the schema's access rules: a form
// and its responses reach the owner and accepted collaborators only, a removed
// collaborator's devices drop them, and a viewer cannot edit.

const settle = async (n = 15): Promise<void> => {
	for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 20))
}

class Device {
	readonly emitter = new SimpleEventEmitter()
	readonly adapter: BetterSqlite3Adapter
	readonly store: Store
	readonly rejections: string[] = []
	private engine: SyncEngine | null = null

	constructor(
		dir: string,
		readonly user: string,
		private readonly server: KoraSyncServer,
	) {
		this.adapter = new BetterSqlite3Adapter(join(dir, `${user}.db`))
		this.store = new Store({ schema, adapter: this.adapter, emitter: this.emitter })
		this.emitter.on('sync:operation-rejected', (event: { code: string }) => {
			this.rejections.push(event.code)
		})
	}

	async open(): Promise<void> {
		await this.store.open()
		await this.store.bindPrincipal(this.user)
		this.store.setLocalMutationHandler(
			new ApplyPipeline({ store: this.store, mergeEngine: new MergeEngine(), emitter: this.emitter }),
		)
	}

	async connect(): Promise<void> {
		const pair = createServerTransportPair()
		const client = pair.client as unknown as SyncTransport
		const engine = new SyncEngine({
			transport: client,
			store: new MergeAwareSyncStore(this.store, new MergeEngine(), this.emitter),
			queueStorage: new StoreQueueStorage(this.adapter),
			syncState: new StoreSyncStatePersistence(this.store),
			config: { url: 'ws://test', schemaVersion: schema.version, auth: async () => ({ token: this.user }) },
			emitter: this.emitter,
		})
		this.engine = engine
		this.emitter.on('operation:created', (event: { operation: Operation }) => {
			if (this.engine === engine && client.isConnected()) engine.pushOperation(event.operation).catch(() => {})
		})
		this.server.handleConnection(pair.server)
		await engine.start()
		await settle()
	}

	async ids(collection: string): Promise<string[]> {
		const rows = (await this.store.collection(collection).where({}).exec()) as Array<{ id: string }>
		return rows.map((row) => row.id).sort()
	}

	async close(): Promise<void> {
		await this.engine?.stop().catch(() => {})
		await this.store.close()
	}
}

test('forms and responses reach their owner and collaborators only, and leave on removal', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'koraforms-access-'))
	const store = new MemoryServerStore()
	await store.setSchema(schema, { accessRulesEnforced: true })
	const server = createKoraServer({
		store,
		schema,
		auth: new TokenAuthProvider({ validate: async (token) => ({ userId: token }) }),
		experimentalAccessRules: true,
		accessSweepIntervalMs: 0,
	})
	const alice = new Device(dir, 'alice', server)
	const bob = new Device(dir, 'bob', server)
	try {
		await alice.open()
		await bob.open()
		await alice.connect()
		await bob.connect()
		// Alice creates a form (ownerId is filled with her id) and a sample response.
		const form = (await alice.store.collection('forms').insert({ title: 'Survey' })) as { id: string; ownerId: string }
		assert.equal(form.ownerId, 'alice')
		const response = (await alice.store.collection('responses').insert({ formId: form.id, submittedAt: 1 })) as { id: string }
		await alice.store.collection('response_filter_views').insert({ formId: form.id, name: 'Mine', createdAt: 1, updatedAt: 1 })
		await settle()
		assert.deepEqual(await bob.ids('forms'), [], 'nothing of Alice reaches Bob')
		assert.deepEqual(await bob.ids('responses'), [])

		// Bob accepts an invitation as a viewer.
		await server.access.grant({ userId: 'bob', group: ['forms', form.id], role: 'viewer' })
		await settle()
		assert.deepEqual(await bob.ids('forms'), [form.id])
		assert.deepEqual(await bob.ids('responses'), [response.id])
		assert.deepEqual(await bob.ids('response_filter_views'), [], "Alice's saved views stay hers")

		// A viewer cannot edit the form: refused by the server, undone on Bob's device.
		await bob.store.collection('forms').update(form.id, { title: 'Hijacked' })
		await settle()
		assert.ok(bob.rejections.includes('ACCESS_DENIED'), `refusals: ${bob.rejections.join(', ')}`)
		const [stored] = await server.getKoraContext().query('forms', { where: { id: form.id }, limit: 1 })
		assert.equal(stored?.title, 'Survey')

		// An editor still cannot change collected results.
		await server.access.grant({ userId: 'bob', group: ['forms', form.id], role: 'editor' })
		await settle()
		const refusalsBefore = bob.rejections.length
		await bob.store.collection('responses').insert({ formId: form.id, submittedAt: 2 })
		await settle()
		assert.ok(bob.rejections.length > refusalsBefore, 'an editor cannot add a response')
		assert.equal((await server.getKoraContext().query('responses', { where: { formId: form.id } })).length, 1)

		// Removed: Bob's device drops the form and its responses.
		await server.access.revoke({ userId: 'bob', group: ['forms', form.id] })
		await settle()
		assert.deepEqual(await bob.ids('forms'), [])
		assert.deepEqual(await bob.ids('responses'), [])
		assert.deepEqual(await alice.ids('forms'), [form.id], "the owner's devices keep it")
	} finally {
		await alice.close()
		await bob.close()
		await server.stop?.()
		rmSync(dir, { recursive: true, force: true })
	}
})
