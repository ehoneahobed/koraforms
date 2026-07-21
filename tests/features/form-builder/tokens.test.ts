import test from 'node:test'
import assert from 'node:assert/strict'
import {
	fieldDisplayName,
	parseTokenSegments,
	serializeTokenSegments,
	stripTrailingFieldLabel,
} from '../../../src/features/form-builder/tokens'
import type { FormField } from '../../../src/types'

const fields: FormField[] = [
	{ id: 'name', type: 'text', label: 'Your Name', required: true },
	{ id: 'guests', type: 'number', label: '', required: false },
]

test('token parser preserves text and field references as separate segments', () => {
	assert.deepEqual(parseTokenSegments('Hello {{Your Name}} and {{Question 2}}'), [
		{ type: 'text', value: 'Hello ' },
		{ type: 'token', value: 'Your Name' },
		{ type: 'text', value: ' and ' },
		{ type: 'token', value: 'Question 2' },
		{ type: 'text', value: '' },
	])
})

test('token serializer round-trips edited segments', () => {
	assert.equal(serializeTokenSegments([
		{ type: 'text', value: 'Can ' },
		{ type: 'token', value: 'Your Name' },
		{ type: 'text', value: ' attend?' },
	]), 'Can {{Your Name}} attend?')
})

test('fieldDisplayName falls back to question number for unnamed fields', () => {
	assert.equal(fieldDisplayName(fields[0]!, fields), 'Your Name')
	assert.equal(fieldDisplayName(fields[1]!, fields), 'Question 2')
})

test('stripTrailingFieldLabel removes only the duplicated typed source label', () => {
	assert.equal(stripTrailingFieldLabel('Apart from your name Your Name', 'Your Name'), 'Apart from your name ')
	assert.equal(stripTrailingFieldLabel('Your special name', 'Your Name'), 'Your special name')
	assert.equal(stripTrailingFieldLabel('Question (1)', 'Question (1)'), '')
})
