import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildDashboardResponseStats,
	buildDuplicateFormPayload,
	buildFormExportPayload,
	buildLastSeenMap,
	buildTemplateFormPayload,
	filterDashboardForms,
	formExportFilename,
	groupDashboardForms,
	isArchivedForm,
	publicFormIdentifier,
	serializeArchiveSettings,
	type FormRecord,
} from '../../../src/features/forms/dashboard'

const forms: FormRecord[] = [
	{ id: 'a', title: 'RSVP', description: 'Event form', status: 'published', settings: '{}' },
	{ id: 'b', title: 'Draft survey', description: 'Customer research', status: 'draft', settings: '{}' },
	{ id: 'c', title: 'Old contact', description: 'Archived', status: 'published', settings: '{"archived":true}' },
]

test('archive helpers preserve settings while toggling archive state', () => {
	assert.equal(isArchivedForm(forms[2]!), true)
	assert.equal(isArchivedForm(forms[0]!), false)
	assert.deepEqual(serializeArchiveSettings('{"publicResults":true}', true), {
		publicResults: true,
		archived: true,
	})
	assert.deepEqual(serializeArchiveSettings('{"archived":true,"publicResults":true}', false), {
		publicResults: true,
	})
})

test('dashboard form grouping and filtering separate active, archived, published, and draft forms', () => {
	const groups = groupDashboardForms(forms)
	assert.deepEqual(groups.activeForms.map(form => form.id), ['a', 'b'])
	assert.deepEqual(groups.archivedForms.map(form => form.id), ['c'])
	assert.deepEqual(groups.published.map(form => form.id), ['a'])
	assert.deepEqual(groups.drafts.map(form => form.id), ['b'])
	assert.deepEqual(filterDashboardForms(groups, 'all', 'event').map(form => form.id), ['a'])
	assert.deepEqual(filterDashboardForms(groups, 'archived', '').map(form => form.id), ['c'])
})

test('dashboard response stats count only owned forms and mark unseen responses', () => {
	const stats = buildDashboardResponseStats(forms, [
		{ id: 'r1', formId: 'a', submittedAt: 100 },
		{ id: 'r2', formId: 'a', submittedAt: 200 },
		{ id: 'r3', formId: 'missing', submittedAt: 300 },
	], { a: 150 })
	assert.equal(stats.totalResponses, 2)
	assert.equal(stats.responseCountMap.get('a'), 2)
	assert.equal(stats.newResponseCountMap.get('a'), 1)
})

test('last seen helper updates current form ids without dropping existing keys', () => {
	assert.deepEqual(buildLastSeenMap(['a', 'b'], { old: 1 }, 123), {
		old: 1,
		a: 123,
		b: 123,
	})
})

test('dashboard payload helpers build template, duplicate, export, and public link data', () => {
	const templatePayload = buildTemplateFormPayload('rsvp', 'user-1')
	assert.equal(templatePayload?.ownerId, 'user-1')
	assert.equal(templatePayload?.theme, 'red')
	assert.equal(buildTemplateFormPayload('missing-template', 'user-1'), null)

	const duplicatePayload = buildDuplicateFormPayload({ id: 'a', title: 'RSVP', fields: '[{}]' }, 'user-1')
	assert.equal(duplicatePayload.title, 'Copy of RSVP')
	assert.equal(duplicatePayload.ownerId, 'user-1')
	assert.equal(duplicatePayload.theme, 'blue')

	const exportPayload = buildFormExportPayload({
		id: 'a',
		title: 'RSVP',
		description: 'Event',
		fields: '[{"id":"name","type":"text","label":"Name","required":true}]',
		settings: '{"publicResults":true}',
		theme: 'red',
	})
	assert.equal(exportPayload.koraforms, true)
	assert.equal(exportPayload.fields[0]?.id, 'name')
	assert.equal(exportPayload.settings.publicResults, true)
	assert.equal(formExportFilename('RSVP / Event'), 'rsvp---event.koraform.json')
	assert.equal(publicFormIdentifier({ id: 'form-id', slug: 'custom-slug' }), 'custom-slug')
	assert.equal(publicFormIdentifier({ id: 'form-id' }), 'form-id')
})
