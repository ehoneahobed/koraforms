import test from 'node:test'
import assert from 'node:assert/strict'
import {
	addFieldOfType,
	buildFormExportData,
	createBuilderField,
	duplicateFieldAt,
	filterFieldTypes,
	formExportFilename,
	insertField,
	moveFieldAt,
	parseImportedFormFile,
	removeFieldAt,
	updateFieldAt,
} from '../../../src/features/form-builder/fields'
import type { FormField } from '../../../src/types'

const baseFields: FormField[] = [
	{ id: 'name', type: 'text', label: 'Name', required: true },
	{ id: 'email', type: 'email', label: 'Email', required: true },
	{ id: 'guests', type: 'number', label: 'Guests', required: false },
]

test('createBuilderField applies defaults for option and matrix fields', () => {
	assert.deepEqual(createBuilderField('text', () => 'field_1'), {
		id: 'field_1',
		type: 'text',
		label: '',
		required: false,
	})
	assert.deepEqual(createBuilderField('radio', () => 'field_2'), {
		id: 'field_2',
		type: 'radio',
		label: '',
		required: false,
		options: 'Option 1, Option 2, Option 3',
	})
	assert.deepEqual(createBuilderField('matrix', () => 'field_3'), {
		id: 'field_3',
		type: 'matrix',
		label: '',
		required: false,
		matrixRows: 'Quality, Service, Price',
		matrixColumns: 'Poor, Fair, Good, Excellent',
	})
})

test('insertField appends or inserts after the requested field', () => {
	const field = { id: 'phone', type: 'phone', label: 'Phone', required: false } satisfies FormField

	assert.deepEqual(insertField(baseFields, field, null).map(item => item.id), ['name', 'email', 'guests', 'phone'])
	assert.deepEqual(insertField(baseFields, field, 0).map(item => item.id), ['name', 'phone', 'email', 'guests'])
	assert.deepEqual(insertField(baseFields, field, 99).map(item => item.id), ['name', 'email', 'guests', 'phone'])
})

test('addFieldOfType returns the inserted field for caller focus state', () => {
	const result = addFieldOfType(baseFields, 'select', 1, () => 'meal')

	assert.equal(result.field.id, 'meal')
	assert.equal(result.field.options, 'Option 1, Option 2, Option 3')
	assert.deepEqual(result.fields.map(field => field.id), ['name', 'email', 'meal', 'guests'])
})

test('update, remove, duplicate, and move field operations are immutable', () => {
	const updated = updateFieldAt(baseFields, 1, { label: 'Work email' })
	assert.equal(updated[1]?.label, 'Work email')
	assert.equal(baseFields[1]?.label, 'Email')
	assert.equal(updateFieldAt(baseFields, -1, { label: 'Bad' }), baseFields)

	assert.deepEqual(removeFieldAt(baseFields, 1).map(field => field.id), ['name', 'guests'])
	assert.equal(removeFieldAt(baseFields, 99), baseFields)

	const duplicated = duplicateFieldAt(baseFields, 0, () => 'name_copy')
	assert.deepEqual(duplicated.fields.map(field => field.id), ['name', 'name_copy', 'email', 'guests'])
	assert.equal(duplicated.field?.label, 'Name (copy)')
	assert.equal(duplicateFieldAt(baseFields, 99).field, null)

	assert.deepEqual(moveFieldAt(baseFields, 0, 2).map(field => field.id), ['email', 'guests', 'name'])
	assert.equal(moveFieldAt(baseFields, 0, 99), baseFields)
})

test('filterFieldTypes searches by label or type value', () => {
	assert.deepEqual(filterFieldTypes('phone').map(field => field.value), ['phone'])
	assert.deepEqual(filterFieldTypes('long').map(field => field.value), ['textarea'])
	assert.equal(filterFieldTypes('').length > 10, true)
})

test('form export helpers create stable payloads and filenames', () => {
	assert.deepEqual(buildFormExportData('', 'Desc', baseFields, 'red', { publicResults: true }), {
		koraforms: true,
		version: 1,
		title: 'Untitled Form',
		description: 'Desc',
		fields: baseFields,
		theme: 'red',
		settings: { publicResults: true },
	})
	assert.equal(formExportFilename('RSVP For Next Event!'), 'rsvp-for-next-event-.koraform.json')
	assert.equal(formExportFilename(''), 'form.koraform.json')
})

test('parseImportedFormFile validates KoraForms files and normalizes fields', () => {
	assert.equal(parseImportedFormFile('{"title":"No marker"}'), null)

	const parsed = parseImportedFormFile(JSON.stringify({
		koraforms: true,
		title: 'Imported',
		description: 'Copied form',
		fields: [
			{ id: 'name', type: 'text', label: 'Name', required: true },
			{ id: 'bad', type: 'unsupported', label: 'Bad', required: true },
		],
		theme: 'emerald',
		settings: { publicResults: true },
	}))

	assert.deepEqual(parsed, {
		title: 'Imported',
		description: 'Copied form',
		fields: [{ id: 'name', type: 'text', label: 'Name', required: true }],
		theme: 'emerald',
		settings: { publicResults: true },
	})
})
