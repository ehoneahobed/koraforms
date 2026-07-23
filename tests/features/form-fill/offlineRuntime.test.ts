import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildPublicFormVersionRecord,
	buildPublicFormProgressRecord,
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
		fields: form.fields,
		settings: { publicResults: true },
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
	assert.deepEqual(payload.fields, form.fields)
	assert.deepEqual(payload.settings, { publicResults: true })
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
		answers: { name: 'Ada' },
		currentIndex: 2,
		resumeId: 'resume-1',
		resumeUrl: 'https://forms.korajs.dev/f/field-survey?resume=resume-1',
		savedAt: 456,
		updatedAt: 456,
	})
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
