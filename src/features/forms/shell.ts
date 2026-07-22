import type { FormSettings } from '../../types'
import { generateSlug } from '../../utils/slug'

export type FormShellTab = 'build' | 'responses' | 'url' | 'share' | 'settings'
export type FormShellPanel = Extract<FormShellTab, 'url' | 'share' | 'settings'>

export function parseFormShellPanel(value: string | null | undefined): FormShellPanel | null {
	return value === 'url' || value === 'share' || value === 'settings' ? value : null
}

export function activeFormShellTab(pathname: string, panel: FormShellPanel | null): FormShellTab {
	if (panel) return panel
	return pathname.endsWith('/responses') ? 'responses' : 'build'
}

export function formShellTabPath(formId: string, tab: FormShellTab): string {
	if (tab === 'build') return `/forms/${formId}/edit`
	if (tab === 'responses') return `/forms/${formId}/responses`
	return `/forms/${formId}/edit?panel=${tab}`
}

export function getPublicFormUrl(identifier: string, origin = getBrowserOrigin()): string {
	return `${origin}/f/${identifier}`
}

export function sanitizeSlug(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
}

export function timestampToDatetimeLocal(timestamp: number | undefined): string {
	if (!timestamp) return ''
	const date = new Date(timestamp)
	const offset = date.getTimezoneOffset()
	const local = new Date(date.getTime() - offset * 60000)
	return local.toISOString().slice(0, 16)
}

export function datetimeLocalToTimestamp(value: string): number | undefined {
	if (!value) return undefined
	return new Date(value).getTime()
}

type SlugFactory = (title: string) => string

export function buildPublishPayload(
	title: string,
	existingSlug: string,
	slugFactory: SlugFactory = generateSlug,
): { status: 'published'; slug: string; shouldOpenShare: boolean } {
	return {
		status: 'published',
		slug: existingSlug || slugFactory(title || 'Untitled Form'),
		shouldOpenShare: !existingSlug,
	}
}

export function buildStatusPayload(
	status: string,
	currentSlug: string,
	title: string,
	slugFactory: SlugFactory = generateSlug,
): Record<string, unknown> {
	const payload: Record<string, unknown> = { status }
	if (status === 'published' && !currentSlug) {
		payload.slug = slugFactory(title || 'Untitled Form')
	}
	return payload
}

export function updateSettingsValue<Key extends keyof FormSettings>(
	settings: FormSettings,
	key: Key,
	value: FormSettings[Key],
): FormSettings {
	return { ...settings, [key]: value }
}

function getBrowserOrigin(): string {
	return typeof window === 'undefined' ? '' : window.location.origin
}
