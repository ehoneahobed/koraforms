import type { ResponseValidationIssue } from './responseValidation'

export type PublicResponseRejectionReason =
	| 'form_not_found'
	| 'payload_invalid'
	| 'response_not_accepted'

export interface PublicResponseRejectionLogInput {
	reason: PublicResponseRejectionReason
	code?: unknown
	status: number
	formId?: unknown
	resolvedFormId?: unknown
	slug?: unknown
	clientSubmissionId?: unknown
	responseBytes?: number
	error?: unknown
	issues?: ResponseValidationIssue[]
	now?: number
}

export interface PublicResponseRejectionLogEvent {
	event: 'public_response_rejected'
	reason: PublicResponseRejectionReason
	code: string
	status: number
	at: number
	formId: string
	resolvedFormId: string
	slug: string
	clientSubmissionIdPresent: boolean
	responseBytes: number
	error: string
	issues: ResponseValidationIssue[]
}

const MAX_LOG_TEXT_LENGTH = 160
const MAX_ISSUES = 20

export function buildPublicResponseRejectionLogEvent(input: PublicResponseRejectionLogInput): PublicResponseRejectionLogEvent {
	return {
		event: 'public_response_rejected',
		reason: input.reason,
		code: sanitizeLogText(input.code),
		status: input.status,
		at: input.now ?? Date.now(),
		formId: sanitizeLogText(input.formId),
		resolvedFormId: sanitizeLogText(input.resolvedFormId),
		slug: sanitizeLogText(input.slug),
		clientSubmissionIdPresent: typeof input.clientSubmissionId === 'string' && input.clientSubmissionId.trim().length > 0,
		responseBytes: Number.isFinite(input.responseBytes) && input.responseBytes && input.responseBytes > 0
			? Math.floor(input.responseBytes)
			: 0,
		error: sanitizeLogText(input.error),
		issues: sanitizeIssues(input.issues),
	}
}

function sanitizeIssues(issues: ResponseValidationIssue[] | undefined): ResponseValidationIssue[] {
	if (!Array.isArray(issues)) return []
	return issues.slice(0, MAX_ISSUES).map(issue => ({
		fieldId: sanitizeLogText(issue.fieldId),
		message: sanitizeLogText(issue.message),
	}))
}

function sanitizeLogText(value: unknown): string {
	if (typeof value !== 'string') return ''
	return value.trim().replace(/\s+/g, ' ').slice(0, MAX_LOG_TEXT_LENGTH)
}
