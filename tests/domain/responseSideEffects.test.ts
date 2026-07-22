import test from 'node:test'
import assert from 'node:assert/strict'
import {
	buildEmailNotificationPayload,
	buildSideEffectDeliveryJobs,
	buildWebhookPayload,
	escapeHtml,
	isPublicWebhookIpAddress,
	isDeliverableWebhookUrl,
	normalizeWebhookConfigs,
	normalizeWebhookHeaders,
} from '../../src/domain/responseSideEffects'

const form = {
	id: 'form<script>',
	title: 'RSVP <script>alert(1)</script>',
	slug: 'rsvp',
}

const fieldsMap = {
	name: { label: 'Your <Name>', type: 'text' },
	message: { label: 'Message', type: 'textarea' },
}

test('escapeHtml escapes text and attribute-sensitive characters', () => {
	assert.equal(
		escapeHtml(`<script>"x" & 'y'</script>`),
		'&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;',
	)
})

test('email notification HTML escapes form titles, labels, values, and URLs', () => {
	const payload = buildEmailNotificationPayload(
		form,
		JSON.stringify({
			name: '<img src=x onerror=alert(1)>',
			message: 'Fish & chips',
			_meta: { duration: 12 },
		}),
		fieldsMap,
		'https://forms.korajs.dev/',
	)

	assert.equal(payload.subject, 'New response: RSVP <script>alert(1)</script>')
	assert.equal(payload.text, 'Your <Name>: <img src=x onerror=alert(1)>\nMessage: Fish & chips')
	assert.match(payload.html, /RSVP &lt;script&gt;alert\(1\)&lt;\/script&gt;/)
	assert.match(payload.html, /Your &lt;Name&gt;/)
	assert.match(payload.html, /&lt;img src=x onerror=alert\(1\)&gt;/)
	assert.match(payload.html, /Fish &amp; chips/)
	assert.doesNotMatch(payload.html, /<img src=x/)
	assert.doesNotMatch(payload.html, /<script>alert/)
	assert.match(payload.html, /\/forms\/form%3Cscript%3E\/responses/)
})

test('webhook payload preserves structured response data for integrations', () => {
	const payload = buildWebhookPayload(
		{ id: 'form-1', title: 'RSVP', slug: 'rsvp' },
		JSON.stringify({ name: 'Ada', message: 'Hello' }),
		fieldsMap,
		123,
	)

	assert.deepEqual(payload, {
		event: 'response.created',
		form: { id: 'form-1', title: 'RSVP', slug: 'rsvp' },
		response: {
			submittedAt: 123,
			data: { name: 'Ada', message: 'Hello' },
			fields: fieldsMap,
		},
	})
})

test('webhook URL gating accepts only HTTPS public destinations', () => {
	assert.equal(isDeliverableWebhookUrl('https://example.com/hook'), true)
	assert.equal(isDeliverableWebhookUrl('http://example.com/hook'), false)
	assert.equal(isDeliverableWebhookUrl('https://localhost/hook'), false)
	assert.equal(isDeliverableWebhookUrl('https://127.0.0.1/hook'), false)
	assert.equal(isDeliverableWebhookUrl('https://10.0.0.1/hook'), false)
	assert.equal(isDeliverableWebhookUrl('https://172.16.0.1/hook'), false)
	assert.equal(isDeliverableWebhookUrl('https://192.168.0.1/hook'), false)
	assert.equal(isDeliverableWebhookUrl('https://service/hook'), false)
	assert.equal(isDeliverableWebhookUrl('mailto:test@example.com'), false)
	assert.equal(isDeliverableWebhookUrl('javascript:alert(1)'), false)
	assert.equal(isDeliverableWebhookUrl('not-a-url'), false)
})

test('webhook IP gating rejects private and reserved resolved addresses', () => {
	assert.equal(isPublicWebhookIpAddress('8.8.8.8'), true)
	assert.equal(isPublicWebhookIpAddress('1.1.1.1'), true)
	assert.equal(isPublicWebhookIpAddress('10.0.0.1'), false)
	assert.equal(isPublicWebhookIpAddress('127.0.0.1'), false)
	assert.equal(isPublicWebhookIpAddress('169.254.169.254'), false)
	assert.equal(isPublicWebhookIpAddress('::1'), false)
	assert.equal(isPublicWebhookIpAddress('fc00::1'), false)
})

test('webhook normalization caps active hooks and strips unsafe headers', () => {
	const hooks = normalizeWebhookConfigs([
		{ url: 'https://example.com/1', headers: { 'X-Test': 'yes', Host: 'evil.test' } },
		{ url: 'https://example.com/2', method: 'PUT' },
		{ url: 'https://example.com/3' },
		{ url: 'https://example.com/4' },
		{ url: 'https://example.com/5' },
		{ url: 'https://example.com/6' },
		{ url: 'https://localhost/internal' },
	])

	assert.equal(hooks.length, 5)
	assert.deepEqual(hooks[0], {
		url: 'https://example.com/1',
		method: 'POST',
		active: undefined,
		headers: { 'X-Test': 'yes' },
	})
	assert.equal(hooks[1]?.method, 'PUT')
	assert.equal(hooks.some(hook => hook.url.includes('localhost')), false)
})

test('webhook header normalization enforces count and byte limits', () => {
	const headers: Record<string, string> = {}
	for (let index = 0; index < 30; index++) {
		headers[`X-Test-${index}`] = 'ok'
	}
	headers.Authorization = 'secret'
	headers['Bad Header'] = 'bad'
	headers['X-Huge'] = 'x'.repeat(2000)

	const normalized = normalizeWebhookHeaders(headers)
	assert.equal(Object.keys(normalized).length, 20)
	assert.equal('Authorization' in normalized, false)
	assert.equal('Bad Header' in normalized, false)
	assert.equal('X-Huge' in normalized, false)
})

test('side-effect delivery jobs include only deliverable configured targets', () => {
	const jobs = buildSideEffectDeliveryJobs(
		{
			notifyEmail: 'owner@example.com',
			webhooks: [
				{ url: 'https://example.com/hook', method: 'PUT', headers: { 'X-Test': 'yes' } },
				{ url: 'javascript:alert(1)' },
				{ url: 'https://example.com/inactive', active: false },
			],
		},
		{ id: 'form-1', title: 'RSVP', slug: 'rsvp' },
		JSON.stringify({ name: 'Ada' }),
		fieldsMap,
		'https://forms.korajs.dev',
		123,
	)

	assert.equal(jobs.length, 2)
	assert.equal(jobs[0]?.type, 'webhook')
	assert.equal(jobs[0]?.target, 'https://example.com/hook')
	assert.deepEqual(jobs[0]?.payload.webhook, { url: 'https://example.com/hook', method: 'PUT', active: undefined, headers: { 'X-Test': 'yes' } })
	assert.deepEqual(jobs[0]?.payload.body, {
		event: 'response.created',
		form: { id: 'form-1', title: 'RSVP', slug: 'rsvp' },
		response: {
			submittedAt: 123,
			data: { name: 'Ada' },
			fields: fieldsMap,
		},
	})
	assert.equal(jobs[1]?.type, 'email')
	assert.equal(jobs[1]?.target, 'owner@example.com')
	assert.equal(typeof jobs[1]?.payload.html, 'string')
})
