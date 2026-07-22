import test from 'node:test'
import assert from 'node:assert/strict'
import {
	parseResponsesSubTab,
	reconcileSelectedResponseIds,
	responsesSubTabFromSearch,
	toggleSelectedResponseId,
	toggleVisibleResponseSelection,
	updateResponsesSubTabUrl,
} from '../../../src/features/responses/navigation'

test('response tab helpers parse valid tabs and fall back to inbox', () => {
	assert.equal(parseResponsesSubTab('analytics'), 'analytics')
	assert.equal(parseResponsesSubTab('unknown'), 'all')
	assert.equal(parseResponsesSubTab(null), 'all')
	assert.equal(responsesSubTabFromSearch('?tab=insights'), 'insights')
	assert.equal(responsesSubTabFromSearch('?tab=bad'), 'all')
})

test('response tab URL helper writes only non-default tabs', () => {
	assert.equal(
		updateResponsesSubTabUrl('https://example.com/forms/1/responses?tab=analytics&foo=bar#top', 'all'),
		'/forms/1/responses?foo=bar#top',
	)
	assert.equal(
		updateResponsesSubTabUrl('https://example.com/forms/1/responses?foo=bar#top', 'todo'),
		'/forms/1/responses?foo=bar&tab=todo#top',
	)
})

test('selection helpers toggle rows and visible pages without dropping hidden selections', () => {
	const selected = new Set(['a', 'hidden'])

	assert.deepEqual(Array.from(toggleSelectedResponseId(selected, 'a')).sort(), ['hidden'])
	assert.deepEqual(Array.from(toggleSelectedResponseId(selected, 'b')).sort(), ['a', 'b', 'hidden'])
	assert.deepEqual(Array.from(toggleVisibleResponseSelection(selected, ['a', 'b'])).sort(), ['a', 'b', 'hidden'])
	assert.deepEqual(Array.from(toggleVisibleResponseSelection(new Set(['a', 'b', 'hidden']), ['a', 'b'])).sort(), ['hidden'])
})

test('reconcileSelectedResponseIds keeps only still-visible response ids', () => {
	const original = new Set(['a', 'b'])
	const empty = new Set<string>()
	assert.equal(reconcileSelectedResponseIds(empty, ['a']), empty)
	assert.deepEqual(Array.from(reconcileSelectedResponseIds(original, ['b', 'c'])), ['b'])
	assert.equal(reconcileSelectedResponseIds(original, ['a', 'b', 'c']), original)
})
