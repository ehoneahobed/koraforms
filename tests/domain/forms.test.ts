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
	parseJsonRecord,
	parseResponseData,
	readJsonContainer,
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

test('parseFormSettings returns a copy of an object value', () => {
	const stored = { archived: true, publicResults: true }
	const parsed = parseFormSettings(stored)
	delete parsed.archived
	assert.equal(stored.archived, true)
})

// What builds before beta.13 left in json fields, as the beta.13 server and the
// local store now return them (see readJsonContainer).
const legacyFields = [{ id: 'field_1', type: 'text', label: 'Full Name', required: true }]
const once = JSON.stringify(legacyFields)
const twice = JSON.stringify(once)

test('json field readers unwrap legacy string encodings of the container', () => {
	for (const stored of [legacyFields, once, twice]) {
		assert.deepEqual(parseFormFields(stored), legacyFields)
	}
	const settings = { maxResponses: 50, closesAt: 1 }
	for (const stored of [settings, JSON.stringify(settings), JSON.stringify(JSON.stringify(settings))]) {
		assert.deepEqual(parseFormSettings(stored), settings)
	}
	const data = { name: 'Ada', _meta: { duration: 5 } }
	for (const stored of [data, JSON.stringify(data), JSON.stringify(JSON.stringify(data))]) {
		assert.deepEqual(parseResponseData(stored), { name: 'Ada' })
		assert.deepEqual(parseJsonRecord(stored), data)
	}
})

test('answers that look like JSON stay the respondent text', () => {
	const answer = JSON.stringify({ looks: 'like json' })
	const nested = JSON.stringify(JSON.stringify(['a', 'b']))
	const stored = JSON.stringify({ note: answer, list: nested, number: '42', quoted: '"hi"' })
	assert.deepEqual(parseResponseData(stored), { note: answer, list: nested, number: '42', quoted: '"hi"' })
	assert.deepEqual(parseResponseData(JSON.stringify(stored)), { note: answer, list: nested, number: '42', quoted: '"hi"' })
})

test('json field readers refuse non-containers and runaway encodings', () => {
	assert.deepEqual(parseFormFields('not json'), [])
	assert.deepEqual(parseFormFields('{"a":1}'), [])
	assert.deepEqual(parseFormSettings('[1,2]'), {})
	assert.deepEqual(parseFormSettings(JSON.stringify('plain text')), {})
	let deep: unknown = { a: 1 }
	for (let layer = 0; layer < 5; layer++) deep = JSON.stringify(deep)
	assert.equal(readJsonContainer(deep, 'object'), null)
})
