import { publicApp } from '../../publicKora'

export type PublicFormAnalyticsEventType =
	| 'viewed_form'
	| 'started_form'
	| 'answered_question'
	| 'saved_progress'
	| 'submitted_form'

export interface PublicFormAnalyticsEventInput {
	formId: string
	slug: string
	formVersionHash?: string
	sessionId: string
	type: PublicFormAnalyticsEventType
	fieldId?: string
	questionIndex?: number
	answeredCount?: number
	visibleQuestionCount?: number
	metadata?: Record<string, unknown>
	occurredAt?: number
}

interface PublicFormAnalyticsEventRecord extends Required<Omit<PublicFormAnalyticsEventInput, 'metadata' | 'occurredAt'>> {
	id?: string
	clientEventId: string
	visitorKey: string
	metadata: Record<string, unknown>
	syncStatus: 'pending' | 'syncing' | 'accepted' | 'failed'
	occurredAt: number
	updatedAt: number
}

interface AnalyticsFlushResponse {
	success?: boolean
	acceptedIds?: unknown
	duplicateIds?: unknown
	rejectedIds?: unknown
}

const VISITOR_STORAGE_KEY = 'koraforms-public-analytics-visitor-id'
const MAX_ANALYTICS_BATCH_SIZE = 50

export function createAnalyticsSessionId(): string {
	return createClientId('session')
}

export async function recordPublicFormAnalyticsEvent(input: PublicFormAnalyticsEventInput): Promise<void> {
	const now = input.occurredAt ?? Date.now()
	const formId = input.formId.trim()
	const slug = input.slug.trim()
	const sessionId = input.sessionId.trim()
	if (!formId || !slug || !sessionId) return
	await publicApp.ready
	const record: PublicFormAnalyticsEventRecord = {
		formId,
		slug,
		formVersionHash: input.formVersionHash || '',
		clientEventId: createClientId('event'),
		sessionId,
		visitorKey: await visitorKeyForForm(formId),
		type: input.type,
		fieldId: input.fieldId || '',
		questionIndex: input.questionIndex ?? -1,
		answeredCount: input.answeredCount ?? 0,
		visibleQuestionCount: input.visibleQuestionCount ?? 0,
		metadata: input.metadata || {},
		syncStatus: 'pending',
		occurredAt: now,
		updatedAt: now,
	}
	await publicApp.form_analytics_events.insert(record)
}

export async function flushPublicFormAnalyticsEvents(): Promise<{ synced: number; failed: number; remaining: number }> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		return { synced: 0, failed: 0, remaining: await countPendingAnalyticsEvents() }
	}
	await publicApp.ready
	const records = await publicApp.form_analytics_events
		.where({ syncStatus: 'pending' })
		.orderBy('occurredAt', 'asc')
		.limit(MAX_ANALYTICS_BATCH_SIZE)
		.exec() as PublicFormAnalyticsEventRecord[]

	if (records.length === 0) return { synced: 0, failed: 0, remaining: 0 }

	for (const record of records) {
		const recordId = String(record.id || '')
		if (recordId) {
			await publicApp.form_analytics_events.update(recordId, {
				syncStatus: 'syncing',
				updatedAt: Date.now(),
			}).catch(() => {})
		}
	}

	try {
		const response = await fetch('/api/public/analytics-events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				events: records.map(toTransportEvent),
			}),
		})
		if (!response.ok) throw new Error('Analytics flush failed')
		const result = await response.json().catch(() => ({})) as AnalyticsFlushResponse
		const accepted = new Set([...stringArray(result.acceptedIds), ...stringArray(result.duplicateIds)])
		const rejected = new Set(stringArray(result.rejectedIds))
		let synced = 0
		let failed = 0
		for (const record of records) {
			const eventId = record.clientEventId
			const recordId = String(record.id || '')
			if (!eventId || !recordId) continue
			if (accepted.has(eventId)) {
				await publicApp.form_analytics_events.delete(recordId).catch(async () => {
					await publicApp.form_analytics_events.update(recordId, { syncStatus: 'accepted', updatedAt: Date.now() }).catch(() => {})
				})
				synced += 1
			} else if (rejected.has(eventId)) {
				await publicApp.form_analytics_events.update(recordId, { syncStatus: 'failed', updatedAt: Date.now() }).catch(() => {})
				failed += 1
			} else {
				await publicApp.form_analytics_events.update(recordId, { syncStatus: 'pending', updatedAt: Date.now() }).catch(() => {})
			}
		}
		return { synced, failed, remaining: await countPendingAnalyticsEvents() }
	} catch {
		for (const record of records) {
			const recordId = String(record.id || '')
			if (recordId) {
				await publicApp.form_analytics_events.update(recordId, {
					syncStatus: 'pending',
					updatedAt: Date.now(),
				}).catch(() => {})
			}
		}
		return { synced: 0, failed: records.length, remaining: await countPendingAnalyticsEvents() }
	}
}

async function countPendingAnalyticsEvents(): Promise<number> {
	await publicApp.ready
	const pending = await publicApp.form_analytics_events.where({ syncStatus: 'pending' }).count()
	const syncing = await publicApp.form_analytics_events.where({ syncStatus: 'syncing' }).count()
	return pending + syncing
}

function toTransportEvent(record: PublicFormAnalyticsEventRecord): Record<string, unknown> {
	return {
		formId: record.formId,
		slug: record.slug,
		formVersionHash: record.formVersionHash,
		clientEventId: record.clientEventId,
		sessionId: record.sessionId,
		visitorKey: record.visitorKey,
		type: record.type,
		fieldId: record.fieldId,
		questionIndex: record.questionIndex,
		answeredCount: record.answeredCount,
		visibleQuestionCount: record.visibleQuestionCount,
		metadata: record.metadata,
		occurredAt: record.occurredAt,
	}
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

async function visitorKeyForForm(formId: string): Promise<string> {
	const visitorId = readOrCreateVisitorId()
	return sha256Hex(`${formId}:${visitorId}`)
}

function readOrCreateVisitorId(): string {
	if (typeof window === 'undefined') return createClientId('visitor')
	try {
		const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY)
		if (existing) return existing
		const visitorId = createClientId('visitor')
		window.localStorage.setItem(VISITOR_STORAGE_KEY, visitorId)
		return visitorId
	} catch {
		return createClientId('visitor')
	}
}

function createClientId(prefix: string): string {
	const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
	return `${prefix}_${random}`
}

async function sha256Hex(value: string): Promise<string> {
	if (typeof crypto === 'undefined' || !crypto.subtle) return `local_${hashString(value).toString(16)}`
	const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
	return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function hashString(value: string): number {
	let hash = 5381
	for (let index = 0; index < value.length; index++) {
		hash = ((hash << 5) + hash) ^ value.charCodeAt(index)
	}
	return hash >>> 0
}
