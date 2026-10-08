import test from 'node:test'
import assert from 'node:assert/strict'
import { formLinkPreview, previewTargetFor } from '../../src/domain/linkPreview'

const BASE = 'https://forms.example'
const published = { id: 'f1', title: 'Pump 3 handover', description: 'Check the seals before restart.', slug: 'pump-3', status: 'published' }
const never = () => false
const always = () => true

test('previewTargetFor names the form of /f/<key> and /f/<key>/results only', () => {
	assert.deepEqual(previewTargetFor('/f/pump-3'), { key: 'pump-3', page: 'form' })
	assert.deepEqual(previewTargetFor('/f/pump-3/'), { key: 'pump-3', page: 'form' })
	assert.deepEqual(previewTargetFor('/f/pump-3/results'), { key: 'pump-3', page: 'results' })
	assert.deepEqual(previewTargetFor('/f/caf%C3%A9'), { key: 'café', page: 'form' })
	for (const path of ['/', '/dashboard', '/f', '/f/', '/f/a/b', '/forms/x', '/f/%E0%A4%A']) {
		assert.equal(previewTargetFor(path), null, path)
	}
})

test('a published form previews with its own title, description and canonical url', () => {
	assert.deepEqual(formLinkPreview(published, { key: 'pump-3', page: 'form' }, `${BASE}/`, never), {
		title: 'Pump 3 handover',
		description: 'Check the seals before restart.',
		url: 'https://forms.example/f/pump-3',
		type: 'website',
		siteName: 'KoraForms',
	})
})

test('drafts, closed and missing forms are never described', () => {
	for (const status of ['draft', 'closed', undefined]) {
		assert.equal(formLinkPreview({ ...published, status }, { key: 'pump-3', page: 'form' }, BASE, always), null)
	}
	assert.equal(formLinkPreview(null, { key: 'x', page: 'form' }, BASE, always), null)
})

test('results pages preview only when the form shares its results', () => {
	assert.equal(formLinkPreview(published, { key: 'pump-3', page: 'results' }, BASE, never), null)
	const preview = formLinkPreview(published, { key: 'pump-3', page: 'results' }, BASE, always)
	assert.equal(preview?.title, 'Results: Pump 3 handover')
	assert.equal(preview?.url, 'https://forms.example/f/pump-3/results')
})

test('long descriptions are cut at a word; empty ones get an honest fallback', () => {
	const long = formLinkPreview({ ...published, description: 'word '.repeat(100) }, { key: 'pump-3', page: 'form' }, BASE, never)
	assert.ok((long?.description.length ?? 0) <= 160)
	assert.ok(long?.description.endsWith('…'))
	const empty = formLinkPreview({ ...published, description: '   ' }, { key: 'pump-3', page: 'form' }, BASE, never)
	assert.match(empty?.description ?? '', /keeps working without internet/)
	const untitled = formLinkPreview({ ...published, title: '' }, { key: 'pump-3', page: 'form' }, BASE, never)
	assert.equal(untitled?.title, 'Untitled form')
})

test('a form without a slug is not previewed (the public API resolves slugs only)', () => {
	assert.equal(formLinkPreview({ ...published, slug: '' }, { key: 'f1', page: 'form' }, BASE, never), null)
})

test('rich-text titles and descriptions preview as plain text, entities decoded', () => {
	const preview = formLinkPreview(
		{ ...published, title: '<p><strong>Tom &amp; Jerry</strong> survey</p>', description: '<p>Rate&nbsp;us: <em>&lt;1 min&gt;</em> &#8212; thanks</p>' },
		{ key: 'pump-3', page: 'form' },
		BASE,
		never,
	)
	assert.equal(preview?.title, 'Tom & Jerry survey')
	assert.equal(preview?.description, 'Rate us: <1 min> \u2014 thanks')
	const empty = formLinkPreview({ ...published, title: '<p></p>', description: '<p><br></p>' }, { key: 'pump-3', page: 'form' }, BASE, never)
	assert.equal(empty?.title, 'Untitled form')
	assert.match(empty?.description ?? '', /keeps working without internet/)
})
