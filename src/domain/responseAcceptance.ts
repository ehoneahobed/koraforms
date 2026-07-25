import type { FormSettings } from '../types'

export type PublicResponseAdmissionCode =
	| 'accepted'
	| 'form_closed'
	| 'form_not_open'
	| 'max_responses_reached'

export type PublicResponseLimitPolicy = 'strict'

export interface PublicResponseAcceptanceResult {
	accepted: boolean
	code: PublicResponseAdmissionCode
	limitPolicy: PublicResponseLimitPolicy
	status: number
	error: string
}

export function evaluatePublicResponseAcceptance(
	settings: FormSettings,
	currentResponseCount: number,
	now = Date.now(),
): PublicResponseAcceptanceResult {
	if (settings.closesAt && now > settings.closesAt) {
		return {
			accepted: false,
			code: 'form_closed',
			limitPolicy: 'strict',
			status: 403,
			error: settings.closedMessage || 'This form is no longer accepting responses.',
		}
	}

	if (settings.opensAt && now < settings.opensAt) {
		return {
			accepted: false,
			code: 'form_not_open',
			limitPolicy: 'strict',
			status: 403,
			error: 'This form is not yet open for responses.',
		}
	}

	const maxResponses = Number(settings.maxResponses || 0)
	if (Number.isFinite(maxResponses) && maxResponses > 0 && currentResponseCount >= maxResponses) {
		return {
			accepted: false,
			code: 'max_responses_reached',
			limitPolicy: 'strict',
			status: 403,
			error: settings.closedMessage || 'This form has reached its maximum number of responses.',
		}
	}

	return { accepted: true, code: 'accepted', limitPolicy: 'strict', status: 200, error: '' }
}
