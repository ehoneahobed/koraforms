import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildFieldAnalyses,
	buildSmartFieldSuggestions,
	fieldHealthBarClass,
	fieldInsightTone,
	filledCountForAnalysis,
} from '../../../src/features/responses/analytics'
import type { FormField } from '../../../src/types'

const fields: FormField[] = [
	{ id: 'name', type: 'text', label: 'Name', required: true },
	{ id: 'choice', type: 'radio', label: 'Choice', required: false },
	{ id: 'tags', type: 'checkbox', label: 'Tags', required: false },
	{ id: 'score', type: 'number', label: 'Score', required: false },
	{ id: 'intro', type: 'statement', label: 'Intro', required: false },
]

const allData = [
	{ name: 'Ada', choice: 'Yes', tags: 'A, B', score: '10' },
	{ name: 'Grace', choice: 'No', tags: 'A', score: '20' },
	{ name: '', choice: 'Yes', tags: '', score: '' },
]

test('buildFieldAnalyses creates text, categorical, checkbox, and numeric analyses', () => {
	const analyses = buildFieldAnalyses(fields, allData, allData.length)
	assert.deepEqual(analyses.map(analysis => analysis.field.id), ['name', 'choice', 'tags', 'score'])

	const text = analyses[0]
	assert.equal(text?.type, 'text')
	if (text?.type === 'text') {
		assert.equal(text.total, 2)
		assert.equal(text.fillRate, 67)
		assert.equal(text.uniqueCount, 2)
	}

	const choice = analyses[1]
	assert.equal(choice?.type, 'categorical')
	if (choice?.type === 'categorical') {
		assert.deepEqual(choice.counts, [['Yes', 2], ['No', 1]])
	}

	const tags = analyses[2]
	assert.equal(tags?.type, 'categorical')
	if (tags?.type === 'categorical') {
		assert.deepEqual(tags.counts, [['A', 2], ['B', 1]])
	}

	const score = analyses[3]
	assert.equal(score?.type, 'numeric')
	if (score?.type === 'numeric') {
		assert.equal(score.sum, 30)
		assert.equal(score.avg, 15)
		assert.equal(score.median, 15)
		assert.equal(filledCountForAnalysis(score), 2)
	}
})

test('field insight tone helpers classify fill rates', () => {
	assert.equal(fieldInsightTone(95), 'good')
	assert.equal(fieldInsightTone(80), 'watch')
	assert.equal(fieldInsightTone(20), 'review')
	assert.match(fieldHealthBarClass(95), /emerald/)
	assert.match(fieldHealthBarClass(80), /amber/)
	assert.match(fieldHealthBarClass(20), /brand/)
})

test('smart field suggestions flag low-fill required fields, unused optional fields, and repeated text', () => {
	const suggestionFields: FormField[] = [
		{ id: 'required', type: 'text', label: 'Required detail', required: true },
		{ id: 'optional', type: 'text', label: 'Optional note', required: false },
		{ id: 'department', type: 'text', label: 'Department', required: false },
	]
	const data = [
		{ required: 'A', optional: '', department: 'Sales' },
		{ required: 'B', optional: '', department: 'Sales' },
		{ required: '', optional: '', department: 'Marketing' },
		{ required: '', optional: '', department: 'Marketing' },
		{ required: '', optional: '', department: 'Sales' },
		{ required: '', optional: '', department: 'Marketing' },
		{ required: '', optional: '', department: 'Sales' },
		{ required: '', optional: '', department: 'Marketing' },
	]
	const analyses = buildFieldAnalyses(suggestionFields, data, data.length)
	const suggestions = buildSmartFieldSuggestions(analyses, data.length)

	assert.ok(suggestions.some(suggestion => suggestion.id === 'required:required-low-fill' && suggestion.severity === 'high'))
	assert.ok(suggestions.some(suggestion => suggestion.id === 'optional:optional-unused'))
	assert.ok(suggestions.some(suggestion => suggestion.id === 'department:text-to-choice'))
})
