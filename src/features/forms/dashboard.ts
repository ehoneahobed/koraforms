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
	responseCount?: number
}

export interface ResponseRecord extends Record<string, unknown> {
	id?: string
	formId?: string
	data?: unknown
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
	newResponses: number
}

export type WorkspaceHealthTone = 'ready' | 'active' | 'review'

export interface WorkspaceHealthSnapshot {
	tone: WorkspaceHealthTone
	title: string
	description: string
	totalForms: number
	publishedForms: number
	draftForms: number
	totalResponses: number
	newResponses: number
	responseCountDrift: number
	formsWithResponseCountDrift: number
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

export interface WorkspaceBackupPayload {
	koraforms: true
	kind: 'workspace-backup'
	version: 1
	exportedAt: string
	summary: {
		forms: number
		responses: number
	}
	forms: Array<FormExportPayload & {
		id: string
		status: string
		slug: string
		createdAt: number | null
	}>
	responses: Array<{
		id: string
		formId: string
		submittedAt: number | null
		data: unknown
	}>
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
	let newResponses = 0

	for (const response of responses) {
		const formId = String(response.formId || '')
		if (!ownedFormIds.has(formId)) continue
		responseCountMap.set(formId, (responseCountMap.get(formId) || 0) + 1)
		totalResponses++
		const submittedAt = Number(response.submittedAt || 0)
		if (submittedAt > (lastSeen[formId] || 0)) {
			newResponseCountMap.set(formId, (newResponseCountMap.get(formId) || 0) + 1)
			newResponses++
		}
	}

	return { responseCountMap, newResponseCountMap, totalResponses, newResponses }
}

export function buildWorkspaceHealthSnapshot(
	forms: readonly FormRecord[],
	responses: readonly ResponseRecord[],
	lastSeen: Record<string, number>,
): WorkspaceHealthSnapshot {
	const groups = groupDashboardForms(forms)
	const stats = buildDashboardResponseStats(forms, responses, lastSeen)
	let responseCountDrift = 0
	let formsWithResponseCountDrift = 0

	for (const form of forms) {
		if (typeof form.responseCount !== 'number') continue
		const actual = stats.responseCountMap.get(String(form.id)) || 0
		const drift = Math.abs(form.responseCount - actual)
		if (drift > 0) {
			responseCountDrift += drift
			formsWithResponseCountDrift++
		}
	}

	const tone: WorkspaceHealthTone =
		formsWithResponseCountDrift > 0 ? 'review'
		: stats.newResponses > 0 ? 'active'
		: 'ready'

	const title =
		tone === 'review' ? 'Workspace needs review'
		: tone === 'active' ? 'New responses ready'
		: 'Workspace ready'

	const description =
		tone === 'review'
			? 'Local response totals need reconciliation before release reporting.'
			: tone === 'active'
				? 'New submissions are saved locally and ready to inspect.'
				: 'Forms and responses are available from this device.'

	return {
		tone,
		title,
		description,
		totalForms: forms.length,
		publishedForms: groups.published.length,
		draftForms: groups.drafts.length,
		totalResponses: stats.totalResponses,
		newResponses: stats.newResponses,
		responseCountDrift,
		formsWithResponseCountDrift,
	}
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

export function buildWorkspaceBackupPayload(
	forms: readonly FormRecord[],
	responses: readonly ResponseRecord[],
	now = new Date(),
): WorkspaceBackupPayload {
	const formIds = new Set(forms.map(form => String(form.id)))
	const backupResponses = responses
		.filter(response => formIds.has(String(response.formId || '')))
		.map(response => ({
			id: String(response.id || ''),
			formId: String(response.formId || ''),
			submittedAt: typeof response.submittedAt === 'number' ? response.submittedAt : null,
			data: response.data ?? null,
		}))

	return {
		koraforms: true,
		kind: 'workspace-backup',
		version: 1,
		exportedAt: now.toISOString(),
		summary: {
			forms: forms.length,
			responses: backupResponses.length,
		},
		forms: forms.map(form => ({
			...buildFormExportPayload(form),
			id: String(form.id),
			status: String(form.status || 'draft'),
			slug: String(form.slug || ''),
			createdAt: typeof form.createdAt === 'number' ? form.createdAt : null,
		})),
		responses: backupResponses,
	}
}

export function workspaceBackupFilename(now = new Date()): string {
	const stamp = now.toISOString().slice(0, 10)
	return `koraforms-workspace-backup-${stamp}.json`
}

export function publicFormIdentifier(form: FormRecord): string {
	return form.slug ? String(form.slug) : String(form.id)
}
