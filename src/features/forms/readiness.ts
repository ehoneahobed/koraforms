import { isResponseField } from '../../domain/forms'
import { staticFieldLabel } from '../responses/utils'
import type { FormField, FormSettings } from '../../types'

export type ReadinessCheckStatus = 'ready' | 'warning' | 'blocked'

export interface ReadinessCheck {
	id: string
	label: string
	status: ReadinessCheckStatus
	detail: string
}

export interface PublicFormReadiness {
	status: ReadinessCheckStatus
	score: number
	summary: string
	checks: ReadinessCheck[]
	blockedCount: number
	warningCount: number
}

export function buildPublicFormReadiness(params: {
	title: string
	status: string
	slug: string
	fields: readonly FormField[]
	settings: FormSettings
	hasPassword: boolean
	now?: number
}): PublicFormReadiness {
	const now = params.now ?? Date.now()
	const responseFields = params.fields.filter(isResponseField)
	const requiredFields = responseFields.filter(field => field.required)
	const webhooks = params.settings.webhooks || []
	const activeWebhooks = webhooks.filter(hook => hook.active !== false)
	const invalidWebhooks = activeWebhooks.filter(hook => !String(hook.url || '').startsWith('https://'))
	const opensAt = Number(params.settings.opensAt || 0)
	const closesAt = Number(params.settings.closesAt || 0)

	const checks: ReadinessCheck[] = [
		{
			id: 'identity',
			label: 'Public identity',
			status: params.title.trim() && (params.slug.trim() || params.status !== 'published') ? 'ready' : 'blocked',
			detail: params.title.trim()
				? params.slug.trim() || params.status !== 'published'
					? 'The form has a clear title and can generate a public link.'
					: 'Published forms need a stable public slug.'
				: 'Add a clear title before sharing this form.',
		},
		{
			id: 'fields',
			label: 'Questions',
			status: responseFields.length > 0 ? 'ready' : 'blocked',
			detail: responseFields.length > 0
				? `${responseFields.length} answerable field${responseFields.length === 1 ? '' : 's'} will collect responses.`
				: 'Add at least one answerable field before publishing.',
		},
		{
			id: 'required-fields',
			label: 'Required path',
			status: requiredFields.length > 0 ? 'ready' : 'warning',
			detail: requiredFields.length > 0
				? `${requiredFields.length} required field${requiredFields.length === 1 ? '' : 's'} define completion.`
				: 'No field is required, so completion analytics may be less meaningful.',
		},
		{
			id: 'schedule',
			label: 'Schedule',
			status: opensAt > 0 && closesAt > 0 && closesAt <= opensAt ? 'blocked' : closesAt > 0 && closesAt < now ? 'warning' : 'ready',
			detail: opensAt > 0 && closesAt > 0 && closesAt <= opensAt
				? 'The close time must be after the open time.'
				: closesAt > 0 && closesAt < now
					? 'This form is already past its close time.'
					: 'Open and close times will not block valid submissions.',
		},
		{
			id: 'offline',
			label: 'Offline readiness',
			status: params.hasPassword ? 'warning' : 'ready',
			detail: params.hasPassword
				? 'Password-protected forms are secure, but field teams should prepare them online before offline use.'
				: 'Respondents can cache the form and submit later when offline.',
		},
		{
			id: 'limits',
			label: 'Response limit',
			status: Number(params.settings.maxResponses || 0) < 0 ? 'blocked' : 'ready',
			detail: Number(params.settings.maxResponses || 0) > 0
				? `The form will stop after ${Number(params.settings.maxResponses)} accepted response${Number(params.settings.maxResponses) === 1 ? '' : 's'}.`
				: 'No hard response limit is set.',
		},
		{
			id: 'integrations',
			label: 'Integrations',
			status: invalidWebhooks.length > 0 ? 'blocked' : 'ready',
			detail: invalidWebhooks.length > 0
				? 'Active webhooks must use HTTPS public URLs.'
				: activeWebhooks.length > 0
					? `${activeWebhooks.length} active webhook${activeWebhooks.length === 1 ? '' : 's'} will receive submissions.`
					: 'Webhooks are optional. Responses will still be stored locally and synced.',
		},
		{
			id: 'first-question',
			label: 'First question',
			status: responseFields[0] ? 'ready' : 'blocked',
			detail: responseFields[0]
				? `Respondents start with "${staticFieldLabel(responseFields[0])}".`
				: 'The public form needs an answerable starting field.',
		},
	]

	const blockedCount = checks.filter(check => check.status === 'blocked').length
	const warningCount = checks.filter(check => check.status === 'warning').length
	const status: ReadinessCheckStatus = blockedCount > 0 ? 'blocked' : warningCount > 0 ? 'warning' : 'ready'
	const score = Math.round((checks.filter(check => check.status === 'ready').length / checks.length) * 100)
	return {
		status,
		score,
		summary: status === 'blocked'
			? 'Fix blocked items before sharing this form publicly.'
			: status === 'warning'
				? 'The form can be shared, but review the warnings for a stronger field experience.'
				: 'This form is ready for public and offline use.',
		checks,
		blockedCount,
		warningCount,
	}
}
