import { safeJsonParse } from './forms'

export interface ResponseSideEffectForm {
	id: string
	title: string
	slug: string
}

export interface ResponseSideEffectField {
	label: string
	type: string
}

export interface EmailNotificationPayload {
	subject: string
	html: string
	text: string
	viewUrl: string
}

export interface WebhookConfigInput {
	url: string
	method?: 'POST' | 'PUT'
	headers?: Record<string, string>
	active?: boolean
}

export const SIDE_EFFECT_LIMITS = {
	maxWebhooksPerForm: 5,
	maxWebhookHeaders: 20,
	maxWebhookHeaderBytes: 4096,
	maxWebhookHeaderNameLength: 80,
	maxWebhookHeaderValueLength: 1024,
} as const

export interface SideEffectDeliveryJob {
	type: 'webhook' | 'email'
	target: string
	payload: unknown
}

export function buildSideEffectDeliveryJobs(
	settings: {
		webhooks?: WebhookConfigInput[]
		notifyEmail?: string
	},
	form: ResponseSideEffectForm,
	responseData: string,
	fieldsMap: Record<string, ResponseSideEffectField>,
	baseUrl: string,
	submittedAt = Date.now(),
): SideEffectDeliveryJob[] {
	const jobs: SideEffectDeliveryJob[] = []
	for (const hook of normalizeWebhookConfigs(settings.webhooks || [])) {
		jobs.push({
			type: 'webhook',
			target: hook.url,
			payload: {
				webhook: hook,
				body: buildWebhookPayload(form, responseData, fieldsMap, submittedAt),
			},
		})
	}
	if (settings.notifyEmail) {
		jobs.push({
			type: 'email',
			target: settings.notifyEmail,
			payload: buildEmailNotificationPayload(form, responseData, fieldsMap, baseUrl),
		})
	}
	return jobs
}

export function normalizeWebhookConfigs(webhooks: WebhookConfigInput[]): WebhookConfigInput[] {
	const normalized: WebhookConfigInput[] = []
	for (const hook of webhooks) {
		if (normalized.length >= SIDE_EFFECT_LIMITS.maxWebhooksPerForm) break
		const next = normalizeWebhookConfig(hook)
		if (next) normalized.push(next)
	}
	return normalized
}

export function normalizeWebhookConfig(hook: Partial<WebhookConfigInput> | null | undefined): WebhookConfigInput | null {
	if (!hook || hook.active === false || typeof hook.url !== 'string' || !isDeliverableWebhookUrl(hook.url)) return null
	return {
		url: hook.url,
		method: hook.method === 'PUT' ? 'PUT' : 'POST',
		active: hook.active,
		headers: normalizeWebhookHeaders(hook.headers || {}),
	}
}

export function normalizeWebhookHeaders(headers: Record<string, string>): Record<string, string> {
	const normalized: Record<string, string> = {}
	let totalBytes = 0
	for (const [rawName, rawValue] of Object.entries(headers)) {
		if (Object.keys(normalized).length >= SIDE_EFFECT_LIMITS.maxWebhookHeaders) break
		const name = rawName.trim()
		const value = String(rawValue ?? '').trim()
		if (!isAllowedWebhookHeaderName(name)) continue
		if (value.length > SIDE_EFFECT_LIMITS.maxWebhookHeaderValueLength) continue
		const nextBytes = byteLength(name) + byteLength(value)
		if (totalBytes + nextBytes > SIDE_EFFECT_LIMITS.maxWebhookHeaderBytes) break
		normalized[name] = value
		totalBytes += nextBytes
	}
	return normalized
}

export function buildEmailNotificationPayload(
	form: ResponseSideEffectForm,
	responseData: string,
	fieldsMap: Record<string, ResponseSideEffectField>,
	baseUrl: string,
): EmailNotificationPayload {
	const entries = responseEntries(responseData, fieldsMap)
	const viewUrl = `${baseUrl.replace(/\/$/, '')}/forms/${encodeURIComponent(form.id)}/responses`
	const safeTitle = escapeHtml(form.title)
	const rows = entries.map(entry => `
		<div style="margin:0 0 10px">
			<span style="color:#6b7280;font-size:12px;display:block">${escapeHtml(entry.label)}</span>
			<span style="color:#111827;font-size:14px;line-height:1.45">${escapeHtml(entry.value)}</span>
		</div>
	`).join('')

	return {
		subject: `New response: ${form.title}`,
		viewUrl,
		text: entries.map(entry => `${entry.label}: ${entry.value}`).join('\n'),
		html: `
			<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px">
				<h2 style="color:#111827;font-size:18px;margin:0 0 4px">New response received</h2>
				<p style="color:#6b7280;font-size:14px;margin:0 0 20px">${safeTitle}</p>
				<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 20px">
					${rows || '<p style="color:#6b7280;font-size:14px;margin:0">No response fields were submitted.</p>'}
				</div>
				<a href="${escapeAttribute(viewUrl)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500">View all responses</a>
				<p style="color:#9ca3af;font-size:11px;margin:20px 0 0">Sent by KoraForms</p>
			</div>
		`,
	}
}

export function buildWebhookPayload(
	form: ResponseSideEffectForm,
	responseData: string,
	fieldsMap: Record<string, ResponseSideEffectField>,
	submittedAt = Date.now(),
): Record<string, unknown> {
	return {
		event: 'response.created',
		form,
		response: {
			submittedAt,
			data: safeJsonParse<Record<string, unknown>>(responseData, {}),
			fields: fieldsMap,
		},
	}
}

export function isDeliverableWebhookUrl(value: string): boolean {
	try {
		const url = new URL(value)
		return url.protocol === 'https:' && isPublicWebhookHostname(url.hostname)
	} catch {
		return false
	}
}

export function isPublicWebhookHostname(hostname: string): boolean {
	const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase()
	if (!normalized || normalized === 'localhost' || normalized.endsWith('.localhost')) return false
	if (normalized === '0.0.0.0' || normalized === '::' || normalized === '::1') return false
	if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) return isPublicIPv4(normalized)
	if (normalized.includes(':')) return isPublicIPv6(normalized)
	return normalized.includes('.')
}

export function isPublicWebhookIpAddress(address: string): boolean {
	const normalized = address.replace(/^\[|\]$/g, '').toLowerCase()
	if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) return isPublicIPv4(normalized)
	if (normalized.includes(':')) return isPublicIPv6(normalized)
	return false
}

function isPublicIPv4(address: string): boolean {
	const parts = address.split('.').map(part => Number(part))
	if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false
	const [a = 0, b = 0] = parts
	if (a === 0 || a === 10 || a === 127) return false
	if (a === 100 && b >= 64 && b <= 127) return false
	if (a === 169 && b === 254) return false
	if (a === 172 && b >= 16 && b <= 31) return false
	if (a === 192 && b === 168) return false
	if (a === 198 && (b === 18 || b === 19)) return false
	if (a >= 224) return false
	return true
}

function isPublicIPv6(address: string): boolean {
	if (address === '::' || address === '::1') return false
	if (address.startsWith('fc') || address.startsWith('fd')) return false
	if (address.startsWith('fe8') || address.startsWith('fe9') || address.startsWith('fea') || address.startsWith('feb')) return false
	if (address.startsWith('ff')) return false
	if (address.startsWith('::ffff:')) {
		return isPublicIPv4(address.slice('::ffff:'.length))
	}
	return true
}

export function escapeHtml(value: unknown): string {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

function escapeAttribute(value: unknown): string {
	return escapeHtml(value).replace(/`/g, '&#96;')
}

function responseEntries(
	responseData: string,
	fieldsMap: Record<string, ResponseSideEffectField>,
): Array<{ label: string; value: string }> {
	const data = safeJsonParse<Record<string, unknown>>(responseData, {})
	const entries: Array<{ label: string; value: string }> = []
	for (const [fieldId, value] of Object.entries(data)) {
		if (fieldId === '_meta') continue
		const info = fieldsMap[fieldId]
		entries.push({
			label: info?.label || fieldId,
			value: String(value ?? ''),
		})
	}
	return entries
}

function isAllowedWebhookHeaderName(name: string): boolean {
	if (!name || name.length > SIDE_EFFECT_LIMITS.maxWebhookHeaderNameLength) return false
	if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) return false
	const forbidden = new Set([
		'authorization',
		'connection',
		'content-length',
		'content-type',
		'cookie',
		'host',
		'proxy-authorization',
		'te',
		'trailer',
		'transfer-encoding',
		'upgrade',
	])
	return !forbidden.has(name.toLowerCase())
}

function byteLength(value: string): number {
	if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length
	return value.length
}
