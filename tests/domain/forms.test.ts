import test from 'node:test'
import assert from 'node:assert/strict'
import {
	createFieldId,
	getInputFields,
	getPipeableFields,
	getResponseFields,
	isDisplayOnlyField,
	isResponseField,
	parseFormFields,
	parseFormSettings,
	parseResponseData,
	parseResponseMeta,
	safeJsonParse,
	serializeFormFields,
	serializeFormSettings,
} from '../../src/domain/forms'
import type { FormField } from '../../src/types'

const fields: FormField[] = [
	{ id: 'name', type: 'text', label: 'Name', required: true },
	{ id: 'intro', type: 'statement', label: 'Welcome', required: false },
	{ id: 'section', type: 'section', label: 'Part two', required: false },
	{ id: 'secret', type: 'hidden', label: 'Campaign', required: false },
	{ id: 'score', type: 'calculated', label: 'Score', required: false },
]

test('safeJsonParse returns fallback for invalid or non-string values', () => {
	assert.deepEqual(safeJsonParse('{bad', { ok: false }), { ok: false })
	assert.deepEqual(safeJsonParse(undefined, [] as unknown[]), [])
	assert.deepEqual(safeJsonParse('{"ok":true}', { ok: false }), { ok: true })
})

test('parseFormFields normalizes persisted fields and drops invalid values', () => {
	const parsed = parseFormFields(JSON.stringify([
		{ id: 'email', type: 'email', label: 'Email', required: true },
		{ id: 'bad', type: 'unsupported', label: 'Bad', required: true },
		{ type: 'text', label: 42, required: 'yes' },
		null,
	]))

	assert.equal(parsed.length, 2)
	assert.deepEqual(parsed[0], { id: 'email', type: 'email', label: 'Email', required: true })
	assert.equal(parsed[1]?.type, 'text')
	assert.equal(parsed[1]?.label, '')
	assert.equal(parsed[1]?.required, false)
	assert.match(parsed[1]?.id || '', /^field_/)
})

test('parseFormSettings returns a safe object fallback', () => {
	assert.deepEqual(parseFormSettings('{bad'), {})
	assert.deepEqual(parseFormSettings('[]'), {})
	assert.deepEqual(parseFormSettings('{"archived":true}'), { archived: true })
})

test('parseResponseData stringifies values and removes metadata', () => {
	assert.deepEqual(parseResponseData('{"name":"Ada","age":42,"empty":null,"_meta":{"duration":10}}'), {
		name: 'Ada',
		age: '42',
		empty: '',
	})
	assert.deepEqual(parseResponseData('{bad'), {})
})

test('parseResponseMeta returns metadata only when present', () => {
	assert.deepEqual(parseResponseMeta('{"name":"Ada","_meta":{"duration":10,"ua":"Safari"}}'), {
		duration: 10,
		ua: 'Safari',
	})
	assert.equal(parseResponseMeta('{"name":"Ada"}'), undefined)
})

test('field behavior helpers classify display, response, and pipeable fields', () => {
	assert.equal(isDisplayOnlyField(fields[0]!), false)
	assert.equal(isDisplayOnlyField(fields[1]!), true)
	assert.equal(isResponseField(fields[3]!), false)
	assert.deepEqual(getInputFields(fields).map(field => field.id), ['name', 'score'])
	assert.deepEqual(getResponseFields(fields).map(field => field.id), ['name', 'score'])
	assert.deepEqual(getPipeableFields(fields).map(field => field.id), ['name', 'score'])
})

test('serializers round-trip normalized values', () => {
	assert.deepEqual(parseFormFields(serializeFormFields(fields)), fields)
	assert.deepEqual(parseFormSettings(serializeFormSettings({ publicResults: true })), { publicResults: true })
})

test('createFieldId creates ids in the expected namespace', () => {
	assert.match(createFieldId(), /^field_/)
})
