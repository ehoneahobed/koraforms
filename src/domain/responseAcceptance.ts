import type { FormSettings } from '../types'

export interface PublicResponseAcceptanceResult {
	accepted: boolean
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
			status: 403,
			error: settings.closedMessage || 'This form is no longer accepting responses.',
		}
	}

	if (settings.opensAt && now < settings.opensAt) {
		return {
			accepted: false,
			status: 403,
			error: 'This form is not yet open for responses.',
		}
	}

	const maxResponses = Number(settings.maxResponses || 0)
	if (Number.isFinite(maxResponses) && maxResponses > 0 && currentResponseCount >= maxResponses) {
		return {
			accepted: false,
			status: 403,
			error: settings.closedMessage || 'This form has reached its maximum number of responses.',
		}
	}

	return { accepted: true, status: 200, error: '' }
}
