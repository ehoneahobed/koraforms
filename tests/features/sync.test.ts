import test from 'node:test'
import assert from 'node:assert/strict'
import type { KoraEvent } from 'korajs'
import { applyNoticeAction, createNoticeStore, noticeActionForEvent } from '../../src/features/sync/notices'
import { describeSyncStatus } from '../../src/features/sync/status'

test('blocked storage shows a persistent notice that clears when the wait ends', () => {
	const store = createNoticeStore()
	store.handle({ type: 'store:storage-blocked', dbName: 'kora-db', resource: 'pool', state: 'waiting', message: 'held' })
	assert.equal(store.getSnapshot().length, 1)
	assert.equal(store.getSnapshot()[0]?.dismissible, false)
	store.handle({ type: 'store:storage-blocked', dbName: 'kora-db', resource: 'pool', state: 'resolved', waitedMs: 10, message: 'free' })
	assert.equal(store.getSnapshot().length, 0)
})

test('a terminal operation rejection becomes a dismissible notice; retriable ones are ignored', () => {
	const rejected = (retriable: boolean): KoraEvent => ({
		type: 'sync:operation-rejected',
		operationId: 'op-1',
		collection: 'forms',
		recordId: 'form-1',
		code: 'CONSTRAINT_VIOLATION',
		message: 'slug already taken',
		retriable,
	})
	assert.equal(noticeActionForEvent(rejected(true)), null)
	const action = noticeActionForEvent(rejected(false))
	assert.ok(action && action.type === 'show')
	assert.equal(action.notice.title, 'A form was undone')
	assert.equal(action.notice.dismissible, true)
	assert.match(action.notice.message, /CONSTRAINT_VIOLATION/)
})

test('notices replace by id and keep the newest first', () => {
	const notice = (id: string) => ({ id, tone: 'warning' as const, title: id, message: id, dismissible: true })
	let notices = applyNoticeAction([], { type: 'show', notice: notice('a') })
	notices = applyNoticeAction(notices, { type: 'show', notice: notice('b') })
	notices = applyNoticeAction(notices, { type: 'show', notice: notice('a') })
	assert.deepEqual(notices.map(n => n.id), ['a', 'b'])
})

test('durability loss is a blocking error notice', () => {
	const action = noticeActionForEvent({ type: 'store:durability-lost', dbName: 'kora-db', phase: 'open', reason: 'unsupported', message: 'no storage' })
	assert.ok(action && action.type === 'show')
	assert.equal(action.notice.tone, 'error')
	assert.equal(action.notice.dismissible, false)
})

test('every sync status has creator-facing wording', () => {
	assert.equal(describeSyncStatus('offline', 2).subtitle, '2 changes pending')
	assert.equal(describeSyncStatus('reconnecting', 0).tone, 'busy')
	assert.equal(describeSyncStatus('clock-error', 0).tone, 'attention')
	assert.equal(describeSyncStatus('auth-required', 1).subtitle, '1 change pending')
	assert.equal(describeSyncStatus('synced', 0).tone, 'synced')
})
