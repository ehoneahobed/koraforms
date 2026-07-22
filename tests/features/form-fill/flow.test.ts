import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildPrefillValues,
	buildResponseJson,
	buildSubmissionMeta,
	countInteractiveQuestions,
	duplicateSubmissionStorageKey,
	hashString,
	isDuplicateSubmission,
	isFormUnavailable,
	moveListItem,
	normalizeSavedProgress,
	optionForShortcutKey,
	parseLabelList,
	parseMatrixAnswers,
	parseMatrixAxis,
	parseOptionList,
	parseRankingValue,
	parseSelectedOptions,
	progressStorageKey,
	progressForIndex,
	questionNumberAtIndex,
	resumeIndexForValues,
	toggleSelectedOption,
	validateField,
	yesNoValueForKey,
} from '../../../src/features/form-fill/flow'
import type { FormField } from '../../../src/types'

const fields: FormField[] = [
	{ id: 'intro', type: 'section', label: 'Intro', required: false },
	{ id: 'name', type: 'text', label: 'Your Name', required: true },
	{ id: 'email', type: 'email', label: 'Email Address', required: true },
	{ id: 'phone', type: 'phone', label: 'Phone', required: false },
]

test('question and progress helpers ignore display-only fields for numbering', () => {
	assert.equal(countInteractiveQuestions(fields), 3)
	assert.equal(questionNumberAtIndex(fields, 0), 0)
	assert.equal(questionNumberAtIndex(fields, 1), 1)
	assert.equal(progressForIndex(fields, 2), 50)
})

test('buildPrefillValues matches field ids and normalized labels', () => {
	const params = new URLSearchParams('name=Ada&email_address=ada%40example.com&embed=1&resume=abc')
	assert.deepEqual(buildPrefillValues(fields, params), {
		name: 'Ada',
		email: 'ada@example.com',
	})
})

test('option helpers parse configured lists and shortcut choices consistently', () => {
	assert.deepEqual(parseOptionList(' Yes, No, Maybe , ,'), ['Yes', 'No', 'Maybe'])
	assert.deepEqual(parseLabelList('Low, High, '), ['Low', 'High', ''])
	assert.deepEqual(parseSelectedOptions('Email, SMS, Push'), ['Email', 'SMS', 'Push'])
	assert.equal(toggleSelectedOption('Email,SMS', 'SMS'), 'Email')
	assert.equal(toggleSelectedOption('Email', 'Push'), 'Email,Push')
	assert.equal(optionForShortcutKey(['A', 'B'], '2'), 'B')
	assert.equal(optionForShortcutKey(['A', 'B'], '9'), null)
	assert.equal(yesNoValueForKey('Y'), 'yes')
	assert.equal(yesNoValueForKey('n'), 'no')
	assert.equal(yesNoValueForKey('x'), null)
})

test('ranking helpers tolerate invalid saved values', () => {
	assert.deepEqual(parseRankingValue('', ['A', 'B']), ['A', 'B'])
	assert.deepEqual(parseRankingValue('["B","A"]', ['A', 'B']), ['B', 'A'])
	assert.deepEqual(parseRankingValue('not json', ['A', 'B']), ['A', 'B'])
	assert.deepEqual(moveListItem(['A', 'B', 'C'], 0, 2), ['B', 'C', 'A'])
	assert.deepEqual(moveListItem(['A', 'B'], -1, 1), ['A', 'B'])
})

test('matrix helpers parse axes and ignore invalid answer payloads', () => {
	assert.deepEqual(parseMatrixAxis('Speed, Quality, '), ['Speed', 'Quality'])
	assert.deepEqual(parseMatrixAnswers('{"Speed":"Good","Quality":3}'), { Speed: 'Good' })
	assert.deepEqual(parseMatrixAnswers('[]'), {})
	assert.deepEqual(parseMatrixAnswers('not json'), {})
})

test('normalizeSavedProgress accepts only populated values', () => {
	assert.equal(normalizeSavedProgress({}), null)
	assert.deepEqual(normalizeSavedProgress({ values: { name: 'Ada' }, savedAt: 123, currentIndex: 2 }), {
		values: { name: 'Ada' },
		currentIndex: 2,
		savedAt: 123,
	})
})

test('storage and duplicate helpers create stable keys and submission fingerprints', () => {
	const responseJson = '{"name":"Ada"}'
	const hash = hashString(responseJson)

	assert.equal(progressStorageKey('form-1'), 'koraforms-progress-form-1')
	assert.equal(duplicateSubmissionStorageKey('form-1'), 'koraforms-dup-form-1')
	assert.equal(hashString(responseJson), hash)
	assert.equal(isDuplicateSubmission({ hash, time: 1_000 }, responseJson, 60_000), true)
	assert.equal(isDuplicateSubmission({ hash, time: 1_000 }, responseJson, 400_000), false)
	assert.equal(isDuplicateSubmission({ hash: hashString('different'), time: 1_000 }, responseJson, 60_000), false)
})

test('availability helper respects scheduled open and close times', () => {
	assert.equal(isFormUnavailable({}, 10_000), false)
	assert.equal(isFormUnavailable({ opensAt: 20_000 }, 10_000), true)
	assert.equal(isFormUnavailable({ opensAt: 5_000 }, 10_000), false)
	assert.equal(isFormUnavailable({ closesAt: 5_000 }, 10_000), true)
	assert.equal(isFormUnavailable({ closesAt: 20_000 }, 10_000), false)
})

test('resumeIndexForValues skips section breaks and resumes at first unanswered input', () => {
	assert.equal(resumeIndexForValues(fields, { name: 'Ada' }), 2)
	assert.equal(resumeIndexForValues(fields, { name: 'Ada', email: 'ada@example.com', phone: '1234567' }), 3)
})

test('validateField returns field-specific errors', () => {
	assert.deepEqual(validateField(fields[0]!, ''), { valid: true, error: '' })
	assert.deepEqual(validateField(fields[1]!, ''), { valid: false, error: 'This field is required' })
	assert.deepEqual(validateField(fields[2]!, 'bad'), { valid: false, error: 'Please enter a valid email address' })
	assert.deepEqual(validateField(fields[3]!, '123'), { valid: false, error: 'Please enter a valid phone number (at least 7 digits)' })
	assert.deepEqual(validateField(fields[3]!, '123-456-7890'), { valid: true, error: '' })
})

test('submission helpers build deterministic metadata and payloads', () => {
	const meta = buildSubmissionMeta(1_000, 31_000, {
		ua: 'Test UA',
		screen: '1200x800',
		lang: 'en-GB',
	})
	assert.deepEqual(meta, {
		startedAt: 1_000,
		completedAt: 31_000,
		duration: 30,
		ua: 'Test UA',
		screen: '1200x800',
		lang: 'en-GB',
	})
	assert.deepEqual(JSON.parse(buildResponseJson({ name: 'Ada' }, meta)), {
		name: 'Ada',
		_meta: meta,
	})
})
