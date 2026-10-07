import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
	FallbackStorageError,
	countFallbackSubmissions,
	flushFallbackSubmissions,
	forgetPendingFallbackSubmission,
	listFallbackSubmissions,
	saveFallbackSubmission,
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
		async (item) => { accepted.push(item.clientSubmissionId) },
	)
	assert.deepEqual(sent.map(item => item.clientSubmissionId), ['s1', 's2'])
	assert.deepEqual(sent[0], { formId: 'form-1', data: answers, clientSubmissionId: 's1', submittedAt: 1_000, formVersionHash: 'v1' })
	assert.deepEqual(accepted, ['s1', 's2'])
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

test('a copy that Kora\'s queue turned out to hold is dropped while pending, and kept once it needs review', async () => {
	await saveFallbackSubmission({ ...submission('late-insert'), mayAlsoBeInKoraQueue: true })
	await saveFallbackSubmission(submission('refused'))
	await flushFallbackSubmissions(async (item) => {
		if (item.clientSubmissionId === 'refused') throw Object.assign(new Error('closed'), { permanent: true })
		throw new TypeError('Failed to fetch')
	})
	assert.equal((await listFallbackSubmissions()).find(item => item.clientSubmissionId === 'late-insert')?.mayAlsoBeInKoraQueue, true)
	await forgetPendingFallbackSubmission('late-insert')
	await forgetPendingFallbackSubmission('refused')
	assert.deepEqual((await listFallbackSubmissions()).map(item => item.clientSubmissionId), ['refused'])
})
