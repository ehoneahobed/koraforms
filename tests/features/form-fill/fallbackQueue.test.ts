import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
	FallbackStorageError,
	countFallbackSubmissions,
	flushFallbackSubmissions,
	countPendingAcrossQueues,
	forgetFallbackSubmissionHeldByKora,
	listFallbackSubmissions,
	saveFallbackSubmission,
	settleLateKoraInsert,
	type KoraPresence,
} from '../../../src/features/form-fill/fallbackQueue'
import { PublicOfflineLimitError, type ResponseSubmissionFlushItem } from '../../../src/features/form-fill/offlineModel'

// Node has no IndexedDB, so these run against the localStorage tier.
class MemoryStorage {
	values = new Map<string, string>()
	failWrites = false
	getItem(key: string): string | null {
		return this.values.get(key) ?? null
	}
	setItem(key: string, value: string): void {
		if (this.failWrites) throw new Error('QuotaExceededError')
		this.values.set(key, value)
	}
	removeItem(key: string): void {
		this.values.delete(key)
	}
	get length(): number {
		return this.values.size
	}
	key(index: number): string | null {
		return [...this.values.keys()][index] ?? null
	}
}

/**
 * Two tabs over one origin's localStorage, the way Chrome keeps it: each tab
 * reads and writes its own cached copy, and a write reaches the other tab's
 * copy only later (`deliver()`, the storage event). A shared-array
 * read-modify-write in both tabs before delivery loses one tab's write.
 */
class OriginStorage {
	committed = new Map<string, string>()
	tab(): TabStorage {
		return new TabStorage(this)
	}
}

class TabStorage {
	private view: Map<string, string>
	constructor(private readonly origin: OriginStorage) {
		this.view = new Map(origin.committed)
	}
	deliver(): void {
		this.view = new Map(this.origin.committed)
	}
	getItem(key: string): string | null {
		return this.view.get(key) ?? null
	}
	setItem(key: string, value: string): void {
		this.view.set(key, value)
		this.origin.committed.set(key, value)
	}
	removeItem(key: string): void {
		this.view.delete(key)
		this.origin.committed.delete(key)
	}
	get length(): number {
		return this.view.size
	}
	key(index: number): string | null {
		return [...this.view.keys()][index] ?? null
	}
}

let storage: MemoryStorage
beforeEach(() => {
	storage = new MemoryStorage()
	;(globalThis as { localStorage?: unknown }).localStorage = storage
})

const answers = JSON.stringify({ name: 'Ada', note: '{"looks":"like json"}' })

function submission(id: string, formId = 'form-1') {
	return { clientSubmissionId: id, formId, slug: 'church', formVersionHash: 'v1', data: answers, submittedAt: 1_000 }
}

test('a fallback response is kept with its answers exactly as submitted, once per submission id', async () => {
	await saveFallbackSubmission(submission('s1'))
	await saveFallbackSubmission(submission('s1'))
	const [record, ...rest] = await listFallbackSubmissions()
	assert.equal(rest.length, 0)
	assert.equal(record?.data, answers)
	assert.equal(record?.status, 'pending')
	assert.deepEqual(await countFallbackSubmissions(), { pending: 1, rejected: 0 })
	assert.deepEqual(await countFallbackSubmissions('other-form'), { pending: 0, rejected: 0 })
})

test('flushing sends each pending response once and removes it after the server accepts it', async () => {
	await saveFallbackSubmission(submission('s1'))
	await saveFallbackSubmission({ ...submission('s2'), submittedAt: 2_000 })
	const sent: ResponseSubmissionFlushItem[] = []
	const accepted: string[] = []
	const result = await flushFallbackSubmissions(
		async (item) => { sent.push(item) },
		{ deleteBlobs: async (data) => { accepted.push(JSON.parse(data).name) } },
	)
	assert.deepEqual(sent.map(item => item.clientSubmissionId), ['s1', 's2'])
	assert.deepEqual(sent[0], { formId: 'form-1', data: answers, clientSubmissionId: 's1', submittedAt: 1_000, formVersionHash: 'v1' })
	assert.deepEqual(accepted, ['Ada', 'Ada'])
	assert.deepEqual(result, { synced: 2, failed: 0, rejected: 0, remaining: 0 })
	assert.equal((await listFallbackSubmissions()).length, 0)
})

test('a network failure keeps the response pending; a permanent refusal keeps it for review, never deleted', async () => {
	await saveFallbackSubmission(submission('offline'))
	await saveFallbackSubmission(submission('refused'))
	const result = await flushFallbackSubmissions(async (item) => {
		if (item.clientSubmissionId === 'offline') throw new TypeError('Failed to fetch')
		throw Object.assign(new Error('This form is closed'), { permanent: true })
	})
	assert.deepEqual(result, { synced: 0, failed: 1, rejected: 1, remaining: 1 })
	const records = Object.fromEntries((await listFallbackSubmissions()).map(record => [record.clientSubmissionId, record]))
	assert.equal(records.offline?.status, 'pending')
	assert.equal(records.offline?.attempts, 1)
	assert.equal(records.refused?.status, 'rejected')
	assert.equal(records.refused?.lastError, 'This form is closed')

	const retried: string[] = []
	await flushFallbackSubmissions(async (item) => { retried.push(item.clientSubmissionId) })
	assert.deepEqual(retried, ['offline'])
	assert.deepEqual(await countFallbackSubmissions(), { pending: 0, rejected: 1 })
})

test('the device limit applies to fallback responses too', async () => {
	for (let index = 0; index < 100; index++) await saveFallbackSubmission(submission(`s${index}`))
	await assert.rejects(saveFallbackSubmission(submission('one-too-many')), PublicOfflineLimitError)
	await saveFallbackSubmission(submission('other-form', 'form-2'))
})

test('when nothing on the device can keep the response, the error tells the respondent what to do', async () => {
	storage.failWrites = true
	await assert.rejects(saveFallbackSubmission(submission('s1')), (error: unknown) => {
		assert.ok(error instanceof FallbackStorageError)
		assert.match(error.message, /answers are still on this page/)
		return true
	})
})

test('a copy that Kora\'s queue turned out to hold is dropped, whatever its state, because Kora keeps its own', async () => {
	await saveFallbackSubmission({ ...submission('late-insert'), mayAlsoBeInKoraQueue: true })
	await saveFallbackSubmission({ ...submission('refused'), mayAlsoBeInKoraQueue: true })
	await flushFallbackSubmissions(async (item) => {
		if (item.clientSubmissionId === 'refused') throw Object.assign(new Error('closed'), { permanent: true })
		throw new TypeError('Failed to fetch')
	}, { koraPresence: async () => 'unknown' })
	assert.equal((await listFallbackSubmissions()).find(item => item.clientSubmissionId === 'late-insert')?.mayAlsoBeInKoraQueue, true)
	await forgetFallbackSubmissionHeldByKora('late-insert')
	await forgetFallbackSubmissionHeldByKora('refused')
	assert.deepEqual(await listFallbackSubmissions(), [])
})

// Codex 4201745892: with IndexedDB unavailable, two tabs saving at once must
// both keep their response.
test('two tabs saving at once on localStorage both keep their response', async () => {
	const origin = new OriginStorage()
	const tabA = origin.tab()
	const tabB = origin.tab()
	;(globalThis as { localStorage?: unknown }).localStorage = tabA
	await saveFallbackSubmission(submission('from-tab-a'))
	;(globalThis as { localStorage?: unknown }).localStorage = tabB
	await saveFallbackSubmission(submission('from-tab-b'))
	tabA.deliver()
	tabB.deliver()
	for (const tab of [tabA, tabB]) {
		;(globalThis as { localStorage?: unknown }).localStorage = tab
		assert.deepEqual((await listFallbackSubmissions()).map(item => item.clientSubmissionId).sort(), ['from-tab-a', 'from-tab-b'])
	}

	// A flush in one tab removes only what it sent.
	;(globalThis as { localStorage?: unknown }).localStorage = tabA
	await flushFallbackSubmissions(async (item) => {
		if (item.clientSubmissionId === 'from-tab-b') throw new TypeError('Failed to fetch')
	})
	;(globalThis as { localStorage?: unknown }).localStorage = tabB
	await saveFallbackSubmission(submission('later-from-tab-b'))
	tabA.deliver()
	tabB.deliver()
	assert.deepEqual((await listFallbackSubmissions()).map(item => item.clientSubmissionId).sort(), ['from-tab-b', 'later-from-tab-b'])
})

test('responses saved by the earlier single-key format are moved to their own keys and still sent', async () => {
	const legacy = { ...submission('legacy'), status: 'pending', attempts: 0, lastError: '', updatedAt: 1_000 }
	storage.setItem('koraforms-public-fallback-submissions', JSON.stringify([legacy]))
	assert.deepEqual((await listFallbackSubmissions()).map(item => item.clientSubmissionId), ['legacy'])
	assert.equal(storage.getItem('koraforms-public-fallback-submissions'), null)
	assert.ok(storage.getItem('koraforms-public-fallback-submission:legacy'))
	const sent: string[] = []
	await flushFallbackSubmissions(async (item) => { sent.push(item.clientSubmissionId) })
	assert.deepEqual(sent, ['legacy'])
	assert.equal(storage.values.size, 0)
})

test('a legacy record that cannot be moved (storage full) is still listed, sent and removed', async () => {
	const legacy = { ...submission('stuck'), status: 'pending', attempts: 0, lastError: '', updatedAt: 1_000 }
	storage.setItem('koraforms-public-fallback-submissions', JSON.stringify([legacy]))
	storage.failWrites = true
	assert.deepEqual((await listFallbackSubmissions()).map(item => item.clientSubmissionId), ['stuck'])
	storage.failWrites = false
	await flushFallbackSubmissions(async () => undefined)
	assert.deepEqual(await listFallbackSubmissions(), [])
})

// Codex 4201745881: the limits count both queues, a shared response once.
test('the pending limits count Kora\'s queue and the fallback queue together, each response once', async () => {
	const koraQueue = new Set<string>()
	const elsewhere = {
		counts: async (formId: string) => ({ form: formId === 'form-1' ? koraQueue.size : 0, total: koraQueue.size }),
		holds: async (id: string): Promise<KoraPresence> => (koraQueue.has(id) ? 'present' : 'absent'),
	}
	for (let index = 0; index < 99; index++) koraQueue.add(`kora-${index}`)
	await saveFallbackSubmission(submission('fallback-0'), { pendingElsewhere: elsewhere })
	await assert.rejects(saveFallbackSubmission(submission('fallback-1'), { pendingElsewhere: elsewhere }), PublicOfflineLimitError)

	// A timed-out insert that landed is in both queues: counted once.
	koraQueue.delete('kora-98')
	await saveFallbackSubmission({ ...submission('both'), mayAlsoBeInKoraQueue: true }, { pendingElsewhere: elsewhere })
	koraQueue.add('both')
	assert.deepEqual(await countPendingAcrossQueues('form-1', elsewhere), { formPendingCount: 100, totalPendingCount: 100 })
	assert.deepEqual(await countPendingAcrossQueues('form-1', elsewhere, 'both'), { formPendingCount: 99, totalPendingCount: 99 })
	// When Kora cannot be asked, a possible duplicate is still counted (never under-counted).
	assert.deepEqual(
		await countPendingAcrossQueues('form-1', { ...elsewhere, holds: async () => 'unknown' }),
		{ formPendingCount: 101, totalPendingCount: 101 },
	)
})

// Codex 4201745873: a late insert that fails leaves the attachments to the fallback copy.
test('when the timed-out Kora insert later fails, the fallback flush deletes the attachments', async () => {
	await saveFallbackSubmission({ ...submission('late-fail'), mayAlsoBeInKoraQueue: true })
	await settleLateKoraInsert('late-fail', Promise.reject(new Error('SQLITE_FULL')))
	assert.equal((await listFallbackSubmissions())[0]?.mayAlsoBeInKoraQueue, undefined)
	const deleted: string[] = []
	await flushFallbackSubmissions(async () => undefined, { deleteBlobs: async () => { deleted.push('late-fail') }, koraPresence: async () => 'unknown' })
	assert.deepEqual(deleted, ['late-fail'])
	assert.deepEqual(await listFallbackSubmissions(), [])
})

test('when the timed-out Kora insert later lands, the fallback copy is dropped and its attachments left to Kora', async () => {
	await saveFallbackSubmission({ ...submission('late-ok'), mayAlsoBeInKoraQueue: true })
	await settleLateKoraInsert('late-ok', Promise.resolve())
	assert.deepEqual(await listFallbackSubmissions(), [])
})

test('the attachment owner of a flagged copy is decided by whether Kora really holds the response', async () => {
	let presence: Record<string, KoraPresence> = { 'in-kora': 'present', 'not-in-kora': 'absent', 'cannot-tell': 'unknown' }
	const sent: string[] = []
	const deleted: string[] = []
	const options = {
		koraPresence: async (id: string) => presence[id] ?? 'absent',
		deleteBlobs: async (data: string) => { deleted.push(JSON.parse(data).id) },
	}
	for (const id of ['in-kora', 'not-in-kora', 'cannot-tell']) {
		await saveFallbackSubmission({ ...submission(id), data: JSON.stringify({ id }), mayAlsoBeInKoraQueue: true })
	}

	const result = await flushFallbackSubmissions(async (item) => { sent.push(item.clientSubmissionId) }, options)
	// Kora's queue sends the one it holds; the fallback queue sends the others.
	assert.deepEqual(sent, ['not-in-kora', 'cannot-tell'])
	assert.deepEqual(deleted, ['not-in-kora'])
	assert.equal(result.remaining, 0)
	// The undecided copy waits, sent, until Kora can be asked; it is no longer pending.
	assert.deepEqual((await listFallbackSubmissions()).map(item => [item.clientSubmissionId, item.status]), [['cannot-tell', 'sent']])
	assert.deepEqual(await countFallbackSubmissions(), { pending: 0, rejected: 0 })

	presence = { 'cannot-tell': 'absent' }
	await flushFallbackSubmissions(async (item) => { sent.push(item.clientSubmissionId) }, options)
	assert.deepEqual(sent, ['not-in-kora', 'cannot-tell'])
	assert.deepEqual(deleted, ['not-in-kora', 'cannot-tell'])
	assert.deepEqual(await listFallbackSubmissions(), [])
})

test('a send that fails after another tab finished the same response does not bring it back', async () => {
	await saveFallbackSubmission(submission('raced'))
	await flushFallbackSubmissions(async () => {
		// Another tab (no Web Locks) sent it and removed it meanwhile.
		await forgetFallbackSubmissionHeldByKora('raced')
		throw new Error('Attachment "card.txt" is no longer available on this device.')
	})
	assert.deepEqual(await listFallbackSubmissions(), [])
})
