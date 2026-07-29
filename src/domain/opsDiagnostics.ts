export type DeliveryStatus = 'pending' | 'delivering' | 'delivered' | 'failed'
export type DeliveryType = 'webhook' | 'email'
export type AnalyticsEventStatus = 'pending' | 'syncing' | 'accepted' | 'failed'
export type AnalyticsEventType = 'viewed_form' | 'started_form' | 'answered_question' | 'saved_progress' | 'submitted_form'

export interface OpsDiagnosticsFormRecord {
	status?: unknown
}

export interface OpsDiagnosticsResponseRecord {
	clientSubmissionId?: unknown
}

export interface OpsDiagnosticsResumeLinkRecord {
	status?: unknown
}

export interface OpsDiagnosticsDeliveryRecord {
	id?: unknown
	responseId?: unknown
	formId?: unknown
	type?: unknown
	status?: unknown
	attempts?: unknown
	lastError?: unknown
	target?: unknown
	updatedAt?: unknown
	nextAttemptAt?: unknown
}

export interface OpsDiagnosticsAnalyticsEventRecord {
	type?: unknown
	syncStatus?: unknown
}

export interface OpsDiagnosticsInput {
	forms: OpsDiagnosticsFormRecord[]
	responses: OpsDiagnosticsResponseRecord[]
	resumeLinks: OpsDiagnosticsResumeLinkRecord[]
	sideEffects: OpsDiagnosticsDeliveryRecord[]
	analyticsEvents?: OpsDiagnosticsAnalyticsEventRecord[]
}

export type OpsDiagnostics = {
	generatedAt: number
	forms: {
		total: number
		published: number
		draft: number
		closed: number
	}
	responses: {
		accepted: number
		withClientSubmissionId: number
	}
	resumeLinks: {
		active: number
		expired: number
		revoked: number
	}
	analyticsEvents: {
		total: number
		byStatus: Record<AnalyticsEventStatus, number>
		byType: Record<AnalyticsEventType, number>
	}
	sideEffects: {
		total: number
		byStatus: Record<DeliveryStatus, number>
		byType: Record<DeliveryType, number>
		recentFailures: Array<{
			id: string
			responseId: string
			formId: string
			type: DeliveryType
			status: 'failed'
			attempts: number
			lastError: string
			targetHost: string
			updatedAt: number
			nextAttemptAt: number
		}>
	}
}

export function buildOpsDiagnosticsSnapshot(input: OpsDiagnosticsInput, now = Date.now()): OpsDiagnostics {
	const analyticsEvents = input.analyticsEvents || []
	return {
		generatedAt: now,
		forms: {
			total: input.forms.length,
			published: input.forms.filter(form => form.status === 'published').length,
			draft: input.forms.filter(form => form.status === 'draft').length,
			closed: input.forms.filter(form => form.status === 'closed').length,
		},
		responses: {
			accepted: input.responses.length,
			withClientSubmissionId: input.responses.filter(response => typeof response.clientSubmissionId === 'string' && response.clientSubmissionId.length > 0).length,
		},
		resumeLinks: {
			active: input.resumeLinks.filter(link => link.status === 'active').length,
			expired: input.resumeLinks.filter(link => link.status === 'expired').length,
			revoked: input.resumeLinks.filter(link => link.status === 'revoked').length,
		},
		analyticsEvents: {
			total: analyticsEvents.length,
			byStatus: countBy(analyticsEvents, 'syncStatus', ['pending', 'syncing', 'accepted', 'failed']),
			byType: countBy(analyticsEvents, 'type', ['viewed_form', 'started_form', 'answered_question', 'saved_progress', 'submitted_form']),
		},
		sideEffects: {
			total: input.sideEffects.length,
			byStatus: countBy(input.sideEffects, 'status', ['pending', 'delivering', 'delivered', 'failed']),
			byType: countBy(input.sideEffects, 'type', ['webhook', 'email']),
			recentFailures: input.sideEffects
				.filter(isFailedDeliveryRecord)
				.sort((a, b) => toNumber(b.updatedAt) - toNumber(a.updatedAt))
				.slice(0, 10)
				.map(delivery => ({
					id: toString(delivery.id),
					responseId: toString(delivery.responseId),
					formId: toString(delivery.formId),
					type: delivery.type,
					status: 'failed',
					attempts: toNumber(delivery.attempts),
					lastError: toString(delivery.lastError).slice(0, 300),
					targetHost: safeTargetHost(toString(delivery.target)),
					updatedAt: toNumber(delivery.updatedAt),
					nextAttemptAt: toNumber(delivery.nextAttemptAt),
				})),
		},
	}
}

function isFailedDeliveryRecord(record: OpsDiagnosticsDeliveryRecord): record is OpsDiagnosticsDeliveryRecord & { status: 'failed'; type: DeliveryType } {
	return record.status === 'failed' && (record.type === 'webhook' || record.type === 'email')
}

function countBy<T, K extends keyof T, V extends string>(
	records: T[],
	key: K,
	values: readonly V[],
): Record<V, number> {
	const result = Object.fromEntries(values.map(value => [value, 0])) as Record<V, number>
	for (const record of records) {
		const value = record[key]
		if (typeof value === 'string' && value in result) result[value as V] += 1
	}
	return result
}

function safeTargetHost(target: string): string {
	try {
		return new URL(target).host
	} catch {
		return ''
	}
}

function toString(value: unknown): string {
	return typeof value === 'string' ? value : ''
}

function toNumber(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
