import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildPublicFormVersionRecord,
	buildPublicFormProgressRecord,
	buildPublicOfflineReadiness,
	buildResponseSubmissionRecord,
	assertLocalBlobStorageLimit,
	assertPendingSubmissionLimit,
	isPermanentSubmissionError,
	isCacheablePublicForm,
	PublicOfflineLimitError,
	publicFormRecordToForm,
	shouldQueueSubmission,
	stableHash,
} from '../../../src/features/form-fill/offlineModel'

const form = {
	id: 'form-1',
	slug: 'field-survey',
	title: 'Field survey',
	description: 'Works anywhere',
	fields: [{ id: 'name', type: 'text', label: 'Name', required: true }],
	accessPassword: 'secret:v1:hash',
	settings: { publicResults: true },
	theme: 'red',
	status: 'published',
}

test('public form versions are stable and exclude password metadata stubs', () => {
	assert.equal(isCacheablePublicForm(form), true)
	assert.equal(isCacheablePublicForm({ id: 'form-1', passwordProtected: true }), false)

	const first = buildPublicFormVersionRecord('field-survey', form, 100)
	const second = buildPublicFormVersionRecord('field-survey', { ...form }, 200)

	assert.equal(first.formId, 'form-1')
	assert.equal(first.cachedAt, 100)
	assert.equal(first.versionHash, second.versionHash)
	assert.equal(first.versionHash, stableHash({
		id: form.id,
		title: form.title,
		description: form.description,
		fields: JSON.stringify(form.fields),
		settings: JSON.stringify({ publicResults: true }),
		theme: form.theme,
		status: form.status,
	}))
	assert.equal(JSON.stringify(first.settings).includes('secret'), false)
})

test('public form version records reconstruct public form payloads', () => {
	const record = buildPublicFormVersionRecord('field-survey', form, 100)
	const payload = publicFormRecordToForm(record)

	assert.equal(payload.id, 'form-1')
	assert.equal(payload.slug, 'field-survey')
	assert.deepEqual(payload.fields, JSON.stringify(form.fields))
	assert.deepEqual(payload.settings, JSON.stringify({ publicResults: true }))
})

test('response submissions are stored as Kora outbox records', () => {
	const record = buildResponseSubmissionRecord({
		formId: 'form-1',
		slug: 'field-survey',
		formVersionHash: 'v1',
		data: '{"name":"Ada"}',
		clientSubmissionId: 'local-a',
		now: 123,
	})

	assert.deepEqual(record, {
		formId: 'form-1',
		slug: 'field-survey',
		formVersionHash: 'v1',
		data: '{"name":"Ada"}',
		clientSubmissionId: 'local-a',
		localStatus: 'submitted_locally',
		attempts: 0,
		lastError: '',
		submittedAt: 123,
		updatedAt: 123,
	})
})

test('public form progress records preserve respondent resume state', () => {
	const record = buildPublicFormProgressRecord({
		slug: 'field-survey',
		formId: 'form-1',
		values: { name: 'Ada' },
		currentIndex: 2,
		resumeId: 'resume-1',
		resumeUrl: 'https://forms.korajs.dev/f/field-survey?resume=resume-1',
		now: 456,
	})

	assert.deepEqual(record, {
		slug: 'field-survey',
		formId: 'form-1',
		answers: JSON.stringify({ name: 'Ada' }),
		currentIndex: 2,
		resumeId: 'resume-1',
		resumeUrl: 'https://forms.korajs.dev/f/field-survey?resume=resume-1',
		savedAt: 456,
		updatedAt: 456,
	})
})

test('offline readiness model reports ready only when every required capability is ready', () => {
	const ready = buildPublicOfflineReadiness({
		hasCachedForm: true,
		cachedVersionHash: 'v1',
		formSource: 'network',
		appShellSupported: true,
		appShellReady: true,
		localDatabaseReady: true,
		blobStorageReady: true,
		pendingSubmissionCount: 0,
		rejectedSubmissionCount: 0,
		localBlobBytes: 0,
		localBlobCount: 0,
	})

	assert.equal(ready.ready, true)
	assert.equal(ready.cachedVersionHash, 'v1')
	assert.deepEqual(ready.checks.map(check => check.status), ['ready', 'ready', 'ready', 'ready'])

	const notReady = buildPublicOfflineReadiness({
		hasCachedForm: false,
		formSource: 'local',
		appShellSupported: true,
		appShellReady: false,
		localDatabaseReady: true,
		blobStorageReady: true,
		pendingSubmissionCount: 2,
		rejectedSubmissionCount: 1,
		localBlobBytes: 1024,
		localBlobCount: 1,
	})

	assert.equal(notReady.ready, false)
	assert.deepEqual(notReady.checks.map(check => check.status), ['pending', 'pending', 'ready', 'unavailable'])
	assert.equal(notReady.pendingSubmissionCount, 2)
	assert.equal(notReady.rejectedSubmissionCount, 1)

	const storageIssue = buildPublicOfflineReadiness({
		hasCachedForm: true,
		formSource: 'local',
		appShellSupported: true,
		appShellReady: true,
		localDatabaseReady: true,
		blobStorageReady: true,
		pendingSubmissionCount: 0,
		rejectedSubmissionCount: 0,
		localBlobBytes: 0,
		localBlobCount: 0,
		storeIssues: [{
			type: 'opfs-unavailable',
			reason: 'unsupported',
			message: 'OPFS unavailable',
			seenAt: 123,
		}],
	})

	assert.equal(storageIssue.ready, false)
	assert.equal(storageIssue.checks[2].status, 'unavailable')
	assert.match(storageIssue.checks[2].detail, /OPFS is unsupported/)

	const durableFallback = buildPublicOfflineReadiness({
		hasCachedForm: true,
		formSource: 'local',
		appShellSupported: true,
		appShellReady: true,
		localDatabaseReady: true,
		blobStorageReady: true,
		pendingSubmissionCount: 0,
		rejectedSubmissionCount: 0,
		localBlobBytes: 0,
		localBlobCount: 0,
		storeIssues: [{
			type: 'storage-fallback',
			reason: 'unsupported',
			from: 'opfs',
			to: 'indexeddb',
			blocking: false,
			message: 'OPFS unavailable, using IndexedDB',
			seenAt: 124,
		}],
	})

	assert.equal(durableFallback.ready, true)
	assert.equal(durableFallback.checks[2].status, 'ready')

	const persistenceFailure = buildPublicOfflineReadiness({
		hasCachedForm: true,
		formSource: 'local',
		appShellSupported: true,
		appShellReady: true,
		localDatabaseReady: true,
		blobStorageReady: true,
		pendingSubmissionCount: 0,
		rejectedSubmissionCount: 0,
		localBlobBytes: 0,
		localBlobCount: 0,
		storeIssues: [{
			type: 'persistence-error',
			reason: 'PERSISTENCE_FAILED',
			message: 'Export failed: Export not yet supported in browser worker',
			seenAt: 125,
		}],
	})

	assert.equal(persistenceFailure.ready, false)
	assert.equal(persistenceFailure.checks[2].status, 'unavailable')
	assert.match(persistenceFailure.checks[2].detail, /Export failed/)
})

test('queue decision distinguishes offline/network failures from server rejections', () => {
	assert.equal(shouldQueueSubmission(new Error('validation failed'), false), true)
	assert.equal(shouldQueueSubmission(new TypeError('Failed to fetch'), true), true)
	assert.equal(shouldQueueSubmission(new Error('validation failed'), true), false)
})

test('permanent submission errors are explicitly marked', () => {
	assert.equal(isPermanentSubmissionError(new Error('validation failed')), false)
	const permanent = new Error('response rejected') as Error & { permanent?: boolean }
	permanent.permanent = true
	assert.equal(isPermanentSubmissionError(permanent), true)
})

test('offline pending submission limits fail before unbounded local queue growth', () => {
	assert.doesNotThrow(() => assertPendingSubmissionLimit({
		formPendingCount: 1,
		totalPendingCount: 2,
		formLimit: 2,
		totalLimit: 3,
	}))

	assert.throws(
		() => assertPendingSubmissionLimit({
			formPendingCount: 2,
			totalPendingCount: 2,
			formLimit: 2,
			totalLimit: 10,
		}),
		PublicOfflineLimitError,
	)
	assert.throws(
		() => assertPendingSubmissionLimit({
			formPendingCount: 1,
			totalPendingCount: 3,
			formLimit: 10,
			totalLimit: 3,
		}),
		PublicOfflineLimitError,
	)
})

test('offline blob storage limits account for replacements', () => {
	assert.doesNotThrow(() => assertLocalBlobStorageLimit({
		currentBytes: 9,
		nextBlobBytes: 5,
		replacingBytes: 5,
		maxTotalBytes: 10,
		maxWriteBytes: 5,
	}))
	assert.throws(
		() => assertLocalBlobStorageLimit({
			currentBytes: 9,
			nextBlobBytes: 6,
			replacingBytes: 5,
			maxTotalBytes: 20,
			maxWriteBytes: 5,
		}),
		PublicOfflineLimitError,
	)
	assert.throws(
		() => assertLocalBlobStorageLimit({
			currentBytes: 9,
			nextBlobBytes: 5,
			replacingBytes: 0,
			maxTotalBytes: 10,
			maxWriteBytes: 5,
		}),
		PublicOfflineLimitError,
	)
})
