import test from 'node:test'
import assert from 'node:assert/strict'
import {
	isPublicResultsFieldVisible,
	publicResultsDisplaySettings,
	sanitizePublicResultsResponseData,
} from '../../src/domain/publicResults'
import type { FormField } from '../../src/types'

const fields: FormField[] = [
	{ id: 'name', type: 'text', label: 'Name', required: true },
	{ id: 'email', type: 'email', label: 'Email', required: true },
	{ id: 'phone', type: 'phone', label: 'Phone', required: false },
	{ id: 'choice', type: 'radio', label: 'Choice', required: false },
	{ id: 'score', type: 'number', label: 'Score', required: false },
	{ id: 'file', type: 'file', label: 'Attachment', required: false },
]

test('public results display settings apply privacy-first defaults', () => {
	assert.deepEqual(publicResultsDisplaySettings({}), {
		mode: 'summary',
		showEmptyFields: false,
		showRespondentCount: true,
	})
	assert.deepEqual(publicResultsDisplaySettings({
		publicResultsMode: 'summary_text',
		publicResultsShowEmpty: true,
		publicResultsShowRespondentCount: false,
	}), {
		mode: 'summary_text',
		showEmptyFields: true,
		showRespondentCount: false,
	})
})

test('public results sanitization never exposes contact or attachment values', () => {
	const summary = publicResultsDisplaySettings({ publicResultsMode: 'summary' })
	assert.equal(isPublicResultsFieldVisible(fields[0]!, summary), false)
	assert.equal(isPublicResultsFieldVisible(fields[3]!, summary), true)
	assert.deepEqual(sanitizePublicResultsResponseData(fields, {
		name: 'Ada',
		email: 'ada@example.com',
		phone: '+1 555 0100',
		choice: 'Yes',
		score: 9,
		file: 'blob:secret',
	}, summary), {
		choice: 'Yes',
		score: '9',
	})

	const withText = publicResultsDisplaySettings({ publicResultsMode: 'summary_text' })
	assert.deepEqual(sanitizePublicResultsResponseData(fields, {
		name: 'Ada',
		email: 'ada@example.com',
		phone: '+1 555 0100',
		choice: 'Yes',
		file: 'blob:secret',
	}, withText), {
		name: 'Ada',
		choice: 'Yes',
	})
})
