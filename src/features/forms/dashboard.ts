import { parseFormFields, parseFormSettings, serializeFormSettings } from '../../domain/forms'
import { createFieldsFromTemplate, FORM_TEMPLATES } from '../../templates'
import type { FormField, FormSettings } from '../../types'

export type DashboardFilter = 'all' | 'published' | 'draft' | 'archived'

export interface FormRecord extends Record<string, unknown> {
	id: string
	title?: string
	description?: string
	fields?: string | FormField[]
	settings?: string | FormSettings
	status?: string
	ownerId?: string
	theme?: string
	slug?: string
	createdAt?: number
}

export interface ResponseRecord extends Record<string, unknown> {
	id?: string
	formId?: string
	submittedAt?: number
}

export interface DashboardFormGroups<T extends FormRecord> {
	activeForms: T[]
	archivedForms: T[]
	published: T[]
	drafts: T[]
}

export interface DashboardResponseStats {
	responseCountMap: Map<string, number>
	newResponseCountMap: Map<string, number>
	totalResponses: number
}

export interface FormExportPayload {
	koraforms: true
	version: 1
	title: string
	description: string
	fields: ReturnType<typeof parseFormFields>
	theme: string
	settings: ReturnType<typeof parseFormSettings>
}

export function isArchivedForm(form: Pick<FormRecord, 'settings'>): boolean {
	return parseFormSettings(form.settings).archived === true
}

export function serializeArchiveSettings(settings: unknown, archived: boolean): FormSettings {
	const next = parseFormSettings(settings)
	if (archived) next.archived = true
	else delete next.archived
	return serializeFormSettings(next)
}

export function groupDashboardForms<T extends FormRecord>(forms: readonly T[]): DashboardFormGroups<T> {
	const activeForms: T[] = []
	const archivedForms: T[] = []
	for (const form of forms) {
		if (isArchivedForm(form)) archivedForms.push(form)
		else activeForms.push(form)
	}
	return {
		activeForms,
		archivedForms,
		published: activeForms.filter(form => String(form.status) === 'published'),
		drafts: activeForms.filter(form => String(form.status) !== 'published'),
	}
}

export function filterDashboardForms<T extends FormRecord>(
	groups: DashboardFormGroups<T>,
	filter: DashboardFilter,
	searchQuery: string,
): T[] {
	const filteredForms =
		filter === 'published' ? groups.published
		: filter === 'draft' ? groups.drafts
		: filter === 'archived' ? groups.archivedForms
		: groups.activeForms

	const query = searchQuery.trim().toLowerCase()
	if (!query) return filteredForms

	return filteredForms.filter(form =>
		String(form.title || '').toLowerCase().includes(query) ||
		String(form.description || '').toLowerCase().includes(query),
	)
}

export function buildDashboardResponseStats(
	forms: readonly FormRecord[],
	responses: readonly ResponseRecord[],
	lastSeen: Record<string, number>,
): DashboardResponseStats {
	const ownedFormIds = new Set(forms.map(form => String(form.id)))
	const responseCountMap = new Map<string, number>()
	const newResponseCountMap = new Map<string, number>()
	let totalResponses = 0

	for (const response of responses) {
		const formId = String(response.formId || '')
		if (!ownedFormIds.has(formId)) continue
		responseCountMap.set(formId, (responseCountMap.get(formId) || 0) + 1)
		totalResponses++
		const submittedAt = Number(response.submittedAt || 0)
		if (submittedAt > (lastSeen[formId] || 0)) {
			newResponseCountMap.set(formId, (newResponseCountMap.get(formId) || 0) + 1)
		}
	}

	return { responseCountMap, newResponseCountMap, totalResponses }
}

export function buildLastSeenMap(formIds: readonly string[], previous: Record<string, number>, now: number): Record<string, number> {
	const next: Record<string, number> = { ...previous }
	for (const formId of formIds) next[formId] = now
	return next
}

export function buildTemplateFormPayload(templateKey: string, ownerId: string) {
	const template = FORM_TEMPLATES[templateKey]
	if (!template) return null
	return {
		title: template.title || 'Untitled Form',
		description: template.description,
		fields: createFieldsFromTemplate(templateKey),
		status: 'draft',
		ownerId,
		theme: 'red',
	}
}

export function buildDuplicateFormPayload(form: FormRecord, ownerId: string) {
	return {
		title: `Copy of ${String(form.title || 'Untitled Form')}`,
		description: String(form.description || ''),
		fields: parseFormFields(form.fields),
		status: 'draft',
		ownerId,
		theme: String(form.theme || 'blue'),
		settings: parseFormSettings(form.settings),
	}
}

export function buildFormExportPayload(form: FormRecord): FormExportPayload {
	return {
		koraforms: true,
		version: 1,
		title: String(form.title || 'Untitled Form'),
		description: String(form.description || ''),
		fields: parseFormFields(form.fields),
		theme: String(form.theme || 'blue'),
		settings: parseFormSettings(form.settings),
	}
}

export function formExportFilename(title: unknown): string {
	const normalized = String(title || 'form').replace(/[^a-z0-9]/gi, '-').toLowerCase()
	return `${normalized}.koraform.json`
}

export function publicFormIdentifier(form: FormRecord): string {
	return form.slug ? String(form.slug) : String(form.id)
}
