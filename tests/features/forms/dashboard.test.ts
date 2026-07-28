import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildDashboardResponseStats,
	buildDuplicateFormPayload,
	buildFormExportPayload,
	buildLastSeenMap,
	buildTemplateFormPayload,
	buildWorkspaceHealthSnapshot,
	buildWorkspaceBackupPayload,
	filterDashboardForms,
	formExportFilename,
	groupDashboardForms,
	isArchivedForm,
	publicFormIdentifier,
	serializeArchiveSettings,
	workspaceBackupFilename,
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
	assert.equal(stats.newResponses, 1)
	assert.equal(stats.responseCountMap.get('a'), 2)
	assert.equal(stats.newResponseCountMap.get('a'), 1)
})

test('workspace health summarizes local readiness and unseen response activity', () => {
	const health = buildWorkspaceHealthSnapshot(
		[
			{ id: 'a', title: 'RSVP', status: 'published', responseCount: 2, settings: '{}' },
			{ id: 'b', title: 'Survey', status: 'draft', responseCount: 0, settings: '{}' },
		],
		[
			{ id: 'r1', formId: 'a', submittedAt: 100 },
			{ id: 'r2', formId: 'a', submittedAt: 200 },
		],
		{ a: 150 },
	)

	assert.equal(health.tone, 'active')
	assert.equal(health.totalForms, 2)
	assert.equal(health.publishedForms, 1)
	assert.equal(health.draftForms, 1)
	assert.equal(health.totalResponses, 2)
	assert.equal(health.newResponses, 1)
	assert.equal(health.responseCountDrift, 0)
	assert.equal(health.offlinePendingSubmissions, 0)
	assert.equal(health.offlineRecoveryRequired, false)
})

test('workspace health flags response counter drift without treating missing counters as drift', () => {
	const health = buildWorkspaceHealthSnapshot(
		[
			{ id: 'a', title: 'RSVP', status: 'published', responseCount: 1, settings: '{}' },
			{ id: 'b', title: 'Legacy', status: 'published', settings: '{}' },
		],
		[
			{ id: 'r1', formId: 'a', submittedAt: 100 },
			{ id: 'r2', formId: 'a', submittedAt: 200 },
			{ id: 'r3', formId: 'b', submittedAt: 300 },
		],
		{ a: 300, b: 300 },
	)

	assert.equal(health.tone, 'review')
	assert.equal(health.responseCountDrift, 1)
	assert.equal(health.formsWithResponseCountDrift, 1)
})

test('workspace health surfaces public offline respondent recovery state', () => {
	const health = buildWorkspaceHealthSnapshot(
		[
			{ id: 'a', title: 'RSVP', status: 'published', responseCount: 0, settings: '{}' },
			{ id: 'b', title: 'Survey', status: 'published', responseCount: 0, settings: '{}' },
		],
		[],
		{},
		{
			submissions: {
				submitted_locally: 2,
				syncing: 1,
				accepted: 4,
				failed: 1,
				rejected: 1,
			},
			pendingSubmissionCount: 4,
			savedProgressCount: 3,
			localBlobBytes: 42_000,
			localBlobCount: 2,
			recentIssues: [{ id: 'issue-1' }],
			storeIssues: [{ blocking: true }, { blocking: false }],
			forms: [
				{ formId: 'a', slug: 'rsvp', failed: 1, rejected: 0, progressCount: 2 },
				{ formId: 'b', slug: 'survey', failed: 0, rejected: 1, progressCount: 1 },
			],
		},
	)

	assert.equal(health.tone, 'review')
	assert.equal(health.title, 'Offline responses need review')
	assert.equal(health.offlinePendingSubmissions, 4)
	assert.equal(health.offlineSyncingSubmissions, 1)
	assert.equal(health.offlineFailedSubmissions, 1)
	assert.equal(health.offlineRejectedSubmissions, 1)
	assert.equal(health.offlineSavedProgress, 3)
	assert.equal(health.offlineLocalBlobBytes, 42_000)
	assert.equal(health.offlineLocalBlobCount, 2)
	assert.equal(health.offlineRecentIssueCount, 1)
	assert.equal(health.offlineFormsWithIssues, 2)
	assert.equal(health.offlineBlockingStoreIssues, 1)
	assert.equal(health.offlineRecoveryRequired, true)
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

test('workspace backup payload exports local forms and owned responses', () => {
	const now = new Date('2026-07-23T10:00:00.000Z')
	const backup = buildWorkspaceBackupPayload(
		[
			{
				id: 'a',
				title: 'RSVP',
				description: 'Event',
				fields: '[{"id":"name","type":"text","label":"Name","required":true}]',
				settings: '{"publicResults":true}',
				status: 'published',
				slug: 'rsvp',
				createdAt: 100,
				accessPassword: 'secret:v1:hash',
			},
		],
		[
			{ id: 'r1', formId: 'a', data: '{"name":"Ada"}', submittedAt: 200 },
			{ id: 'r2', formId: 'missing', data: '{"name":"Grace"}', submittedAt: 300 },
		],
		now,
	)

	assert.equal(backup.kind, 'workspace-backup')
	assert.equal(backup.exportedAt, '2026-07-23T10:00:00.000Z')
	assert.deepEqual(backup.summary, { forms: 1, responses: 1 })
	assert.equal(backup.forms[0]?.id, 'a')
	assert.equal(backup.forms[0]?.settings.publicResults, true)
	assert.equal(JSON.stringify(backup).includes('secret:v1:hash'), false)
	assert.deepEqual(backup.responses, [
		{ id: 'r1', formId: 'a', submittedAt: 200, data: '{"name":"Ada"}' },
	])
	assert.equal(workspaceBackupFilename(now), 'koraforms-workspace-backup-2026-07-23.json')
})
