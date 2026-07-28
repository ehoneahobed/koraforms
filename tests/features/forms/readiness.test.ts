import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPublicFormReadiness } from '../../../src/features/forms/readiness'
import type { FormField } from '../../../src/types'

const fields: FormField[] = [
	{ id: 'name', type: 'text', label: 'Your Name', required: true },
	{ id: 'intro', type: 'section', label: 'Intro', required: false },
]

test('public form readiness marks a complete published form as ready', () => {
	const readiness = buildPublicFormReadiness({
		title: 'RSVP',
		status: 'published',
		slug: 'rsvp',
		fields,
		settings: {},
		hasPassword: false,
		now: new Date('2026-01-01T12:00:00Z').getTime(),
	})

	assert.equal(readiness.status, 'ready')
	assert.equal(readiness.score, 100)
	assert.equal(readiness.blockedCount, 0)
	assert.equal(readiness.warningCount, 0)
	assert.ok(readiness.checks.some(check => check.id === 'integrations' && check.status === 'ready'))
})

test('public form readiness blocks forms that cannot collect answers safely', () => {
	const readiness = buildPublicFormReadiness({
		title: '',
		status: 'published',
		slug: '',
		fields: [{ id: 'intro', type: 'section', label: 'Intro', required: false }],
		settings: {
			opensAt: new Date('2026-01-02T12:00:00Z').getTime(),
			closesAt: new Date('2026-01-01T12:00:00Z').getTime(),
			webhooks: [{ url: 'http://localhost/hook', active: true }],
		},
		hasPassword: false,
		now: new Date('2026-01-01T12:00:00Z').getTime(),
	})

	assert.equal(readiness.status, 'blocked')
	assert.ok(readiness.checks.some(check => check.id === 'fields' && check.status === 'blocked'))
	assert.ok(readiness.checks.some(check => check.id === 'schedule' && check.status === 'blocked'))
	assert.ok(readiness.checks.some(check => check.id === 'integrations' && check.status === 'blocked'))
})

test('public form readiness warns for choices that reduce field-use confidence', () => {
	const readiness = buildPublicFormReadiness({
		title: 'Anonymous survey',
		status: 'draft',
		slug: '',
		fields: [{ id: 'feedback', type: 'textarea', label: 'Feedback', required: false }],
		settings: {},
		hasPassword: true,
		now: new Date('2026-01-01T12:00:00Z').getTime(),
	})

	assert.equal(readiness.status, 'warning')
	assert.ok(readiness.checks.some(check => check.id === 'required-fields' && check.status === 'warning'))
	assert.ok(readiness.checks.some(check => check.id === 'offline' && check.status === 'warning'))
	assert.ok(readiness.checks.some(check => check.id === 'integrations' && check.status === 'ready'))
})
