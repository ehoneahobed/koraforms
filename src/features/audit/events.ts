export type AuditActorType = 'user' | 'system' | 'public'

export type AuditEventType =
	| 'form_created'
	| 'form_updated'
	| 'form_published'
	| 'form_closed'
	| 'form_reopened'
	| 'form_archived'
	| 'form_restored'
	| 'form_duplicated'
	| 'form_deleted'
	| 'template_used'
	| 'theme_changed'
	| 'settings_updated'
	| 'password_updated'
	| 'password_cleared'
	| 'responses_exported'
	| 'responses_deleted'

export interface AuditEventInput {
	formId: string
	actorId?: string
	actorType?: AuditActorType
	eventType: AuditEventType
	summary: string
	metadata?: Record<string, unknown>
	createdAt?: number
}

export interface AuditEventRecord {
	formId: string
	actorId: string
	actorType: AuditActorType
	eventType: AuditEventType
	summary: string
	metadata: Record<string, unknown>
	createdAt: number
}

interface AuditEventCollection {
	insert(record: AuditEventRecord): Promise<unknown>
}

const REDACTED = '[redacted]'
const SENSITIVE_KEY_PATTERN = /password|secret|token|credential|authorization|cookie|accesspassword|payload|answers|data|response/i
const MAX_METADATA_DEPTH = 4
const MAX_METADATA_KEYS = 60
const MAX_STRING_LENGTH = 240

export function buildAuditEventRecord(input: AuditEventInput, now = Date.now()): AuditEventRecord {
	return {
		formId: String(input.formId || ''),
		actorId: String(input.actorId || ''),
		actorType: input.actorType || 'user',
		eventType: input.eventType,
		summary: String(input.summary || '').slice(0, 240),
		metadata: sanitizeAuditMetadata(input.metadata || {}),
		createdAt: input.createdAt ?? now,
	}
}

export async function recordAuditEvent(collection: AuditEventCollection, input: AuditEventInput): Promise<void> {
	const record = buildAuditEventRecord(input)
	if (!record.formId || !record.summary) return
	try {
		await collection.insert(record)
	} catch (error) {
		console.warn('Audit event could not be recorded', error)
	}
}

export function sanitizeAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
	const sanitized = sanitizeValue(metadata, 0)
	return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
		? sanitized as Record<string, unknown>
		: {}
}

function sanitizeValue(value: unknown, depth: number): unknown {
	if (depth >= MAX_METADATA_DEPTH) return '[truncated]'
	if (value == null) return value
	if (typeof value === 'string') return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value
	if (typeof value === 'number' || typeof value === 'boolean') return value
	if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeValue(item, depth + 1))
	if (typeof value !== 'object') return String(value)

	const output: Record<string, unknown> = {}
	let count = 0
	for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
		if (count >= MAX_METADATA_KEYS) {
			output._truncated = true
			break
		}
		if (SENSITIVE_KEY_PATTERN.test(key)) {
			output[key] = REDACTED
		} else {
			output[key] = sanitizeValue(nested, depth + 1)
		}
		count += 1
	}
	return output
}
