import test from 'node:test'
import assert from 'node:assert/strict'
import {
	activeFormShellTab,
	buildPublishPayload,
	buildStatusPayload,
	datetimeLocalToTimestamp,
	formShellTabPath,
	getPublicFormUrl,
	parseFormShellPanel,
	sanitizeSlug,
	timestampToDatetimeLocal,
	updateSettingsValue,
} from '../../../src/features/forms/shell'

test('form shell tab helpers resolve panels and route paths', () => {
	assert.equal(parseFormShellPanel('url'), 'url')
	assert.equal(parseFormShellPanel('responses'), null)
	assert.equal(activeFormShellTab('/forms/1/responses', null), 'responses')
	assert.equal(activeFormShellTab('/forms/1/edit', 'settings'), 'settings')
	assert.equal(formShellTabPath('abc', 'build'), '/forms/abc/edit')
	assert.equal(formShellTabPath('abc', 'responses'), '/forms/abc/responses')
	assert.equal(formShellTabPath('abc', 'share'), '/forms/abc/edit?panel=share')
})

test('public URL and slug helpers normalize user input', () => {
	assert.equal(getPublicFormUrl('rsvp', 'https://koraforms.test'), 'https://koraforms.test/f/rsvp')
	assert.equal(sanitizeSlug(' RSVP For Next Event! '), 'rsvp-for-next-event')
	assert.equal(sanitizeSlug('Already---clean'), 'already-clean')
})

test('datetime helpers round-trip local datetime input', () => {
	const timestamp = datetimeLocalToTimestamp('2026-07-21T14:30')
	assert.equal(typeof timestamp, 'number')
	assert.match(timestampToDatetimeLocal(timestamp), /^2026-07-21T14:30$/)
	assert.equal(datetimeLocalToTimestamp(''), undefined)
	assert.equal(timestampToDatetimeLocal(undefined), '')
})

test('publish and status payload helpers create slugs only when needed', () => {
	const slugFactory = (title: string) => sanitizeSlug(title)

	assert.deepEqual(buildPublishPayload('RSVP Night', '', slugFactory), {
		status: 'published',
		slug: 'rsvp-night',
		shouldOpenShare: true,
	})
	assert.deepEqual(buildPublishPayload('RSVP Night', 'custom', slugFactory), {
		status: 'published',
		slug: 'custom',
		shouldOpenShare: false,
	})
	assert.deepEqual(buildStatusPayload('draft', '', 'Title', slugFactory), { status: 'draft' })
	assert.deepEqual(buildStatusPayload('published', '', 'Title', slugFactory), { status: 'published', slug: 'title' })
	assert.deepEqual(buildStatusPayload('published', 'custom', 'Title', slugFactory), { status: 'published' })
})

test('settings update helper preserves existing options', () => {
	assert.deepEqual(updateSettingsValue({ publicResults: true }, 'maxResponses', 100), {
		publicResults: true,
		maxResponses: 100,
	})
})
