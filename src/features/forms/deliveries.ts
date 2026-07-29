export type SideEffectDeliveryType = 'webhook' | 'email'
export type SideEffectDeliveryStatus = 'pending' | 'delivering' | 'delivered' | 'failed'

export interface DeliveryStatusItem {
	id: string
	type: SideEffectDeliveryType
	status: SideEffectDeliveryStatus
	targetLabel: string
	attempts: number
	lastError: string
	nextAttemptAt: number
	updatedAt: number
}

export interface DeliveryStatusSummary {
	total: number
	pending: number
	delivering: number
	delivered: number
	failed: number
	latest: DeliveryStatusItem[]
}

const KNOWN_STATUSES = new Set<SideEffectDeliveryStatus>(['pending', 'delivering', 'delivered', 'failed'])
const KNOWN_TYPES = new Set<SideEffectDeliveryType>(['webhook', 'email'])

export function buildDeliveryStatusSummary(
	deliveries: readonly Record<string, unknown>[],
	options: {
		type?: SideEffectDeliveryType
		limit?: number
	} = {},
): DeliveryStatusSummary {
	const limit = Math.max(1, Math.min(20, Math.floor(options.limit ?? 5)))
	const items = deliveries
		.map(toDeliveryStatusItem)
		.filter((item): item is DeliveryStatusItem => Boolean(item))
		.filter(item => !options.type || item.type === options.type)
		.sort((a, b) => b.updatedAt - a.updatedAt)

	return {
		total: items.length,
		pending: items.filter(item => item.status === 'pending').length,
		delivering: items.filter(item => item.status === 'delivering').length,
		delivered: items.filter(item => item.status === 'delivered').length,
		failed: items.filter(item => item.status === 'failed').length,
		latest: items.slice(0, limit),
	}
}

function toDeliveryStatusItem(record: Record<string, unknown>): DeliveryStatusItem | null {
	const type = toDeliveryType(record.type)
	const status = toDeliveryStatus(record.status)
	if (!type || !status) return null
	return {
		id: toBoundedString(record.id, 160) || `${type}-${toNumber(record.updatedAt)}`,
		type,
		status,
		targetLabel: formatDeliveryTarget(type, record.target),
		attempts: toNumber(record.attempts),
		lastError: toBoundedString(record.lastError, 180),
		nextAttemptAt: toNumber(record.nextAttemptAt),
		updatedAt: toNumber(record.updatedAt),
	}
}

function toDeliveryType(value: unknown): SideEffectDeliveryType | null {
	return typeof value === 'string' && KNOWN_TYPES.has(value as SideEffectDeliveryType)
		? value as SideEffectDeliveryType
		: null
}

function toDeliveryStatus(value: unknown): SideEffectDeliveryStatus | null {
	return typeof value === 'string' && KNOWN_STATUSES.has(value as SideEffectDeliveryStatus)
		? value as SideEffectDeliveryStatus
		: null
}

function formatDeliveryTarget(type: SideEffectDeliveryType, value: unknown): string {
	const raw = toBoundedString(value, 240)
	if (!raw) return type === 'email' ? 'Email recipient' : 'Webhook endpoint'
	if (type === 'email') return raw
	try {
		const url = new URL(raw)
		return url.host
	} catch {
		return 'Webhook endpoint'
	}
}

function toNumber(value: unknown): number {
	const number = Number(value || 0)
	return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

function toBoundedString(value: unknown, maxLength: number): string {
	return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

