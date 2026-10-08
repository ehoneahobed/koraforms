import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryServerStore, createKoraServer } from '@korajs/server'
import schema from '../../src/schema'

// The forms slug constraint applies among published forms only and is decided
// by the sync server: drafts and closed forms may share a slug (every new draft
// starts with ''), but publishing a second form with a live slug is refused, so
// two live links never resolve to different forms.
test('the server refuses publishing a second form with a live slug; drafts and closed forms may share it', async () => {
	const store = new MemoryServerStore()
	await store.setSchema(schema)
	const server = createKoraServer({ store, schema })
	try {
		const ctx = server.getKoraContext()
		const insert = (recordId: string, data: Record<string, unknown>) =>
			ctx.apply({ collection: 'forms', type: 'insert', recordId, data: { title: recordId, ownerId: 'u1', ...data } })

		assert.equal((await insert('live', { slug: 'survey', status: 'published' })).ok, true)
		assert.equal((await insert('draft', { slug: 'survey' })).ok, true, 'a draft may share a live slug')
		assert.equal((await insert('closed', { slug: 'survey', status: 'closed' })).ok, true, 'a closed form may share it')

		const publish = await ctx.apply({ collection: 'forms', type: 'update', recordId: 'draft', data: { status: 'published' } })
		assert.equal(publish.ok, false, 'publishing a second form with the live slug is refused')

		const other = await insert('other', { slug: 'other-survey', status: 'published' })
		assert.equal(other.ok, true, 'a different slug publishes')
	} finally {
		await server.stop?.()
	}
})
