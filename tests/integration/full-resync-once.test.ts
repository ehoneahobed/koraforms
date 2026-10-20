import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSqliteServerStore } from '@korajs/server'
import type { FullResyncTarget } from '@korajs/server'
import schema from '../../src/schema'
import { FULL_RESYNC_MARKER, createSqliteTaskMarkers, runFullResyncOnce } from '../../src/domain/fullResyncOnce'

// The one-time 2026-10-20 full resync (remove with src/domain/fullResyncOnce.ts).
test('requests a full resync for every user once, then records its marker', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'koraforms-resync-'))
	const filename = join(dir, 'server.db')
	const store = createSqliteServerStore({ filename })
	try {
		await store.setSchema(schema)
		const markers = await createSqliteTaskMarkers(filename)
		const requestFullResync = store.requestFullResync?.bind(store)
		assert.ok(requestFullResync, 'the built-in SQLite store supports full resync')

		const first = await runFullResyncOnce({
			markers,
			listUserIds: async () => ['alice', 'bob', 'alice'],
			requestFullResync,
		})
		assert.deepEqual(first, { status: 'requested', users: 2 })
		assert.equal(await markers.has(FULL_RESYNC_MARKER), true)
		const alice = await store.getFullResyncState?.('alice', 'node-a')
		assert.ok(alice && alice.requested !== null && alice.done === null, 'alice\'s devices must resync')

		const calls: FullResyncTarget[] = []
		const second = await runFullResyncOnce({
			markers,
			listUserIds: async () => ['alice'],
			requestFullResync: async (target) => { calls.push(target); return 1 },
		})
		assert.deepEqual(second, { status: 'already-done' })
		assert.deepEqual(calls, [])
		await markers.close()
	} finally {
		await store.close()
		rmSync(dir, { recursive: true, force: true })
	}
})

test('a failed request leaves the marker absent so the next start retries', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'koraforms-resync-'))
	try {
		const markers = await createSqliteTaskMarkers(join(dir, 'server.db'))
		await assert.rejects(runFullResyncOnce({
			markers,
			listUserIds: async () => ['alice', 'bob'],
			requestFullResync: async (target) => {
				if (target.userId === 'bob') throw new Error('store unavailable')
				return 1
			},
		}), /store unavailable/)
		assert.equal(await markers.has(FULL_RESYNC_MARKER), false)
		await assert.rejects(runFullResyncOnce({
			markers,
			listUserIds: async () => ['alice'],
			requestFullResync: undefined,
		}), /FULL_RESYNC_UNSUPPORTED/)
		assert.equal(await markers.has(FULL_RESYNC_MARKER), false)
		await markers.close()
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
