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
	offlinePendingSubmissions: number
	offlineSyncingSubmissions: number
	offlineFailedSubmissions: number
	offlineRejectedSubmissions: number
	offlineSavedProgress: number
	offlineLocalBlobCount: number
	offlineLocalBlobBytes: number
	offlineRecentIssueCount: number
	offlineFormsWithIssues: number
	offlineBlockingStoreIssues: number
	offlineRecoveryRequired: boolean
}

export interface OfflineFormHealthInput {
	formId?: string
	slug?: string
	submitted_locally?: number
	syncing?: number
	accepted?: number
	rejected?: number
	failed?: number
	progressCount?: number
	lastActivityAt?: number
}

export interface PublicRecoveryDiagnosticsInput {
	submissions?: Partial<Record<'submitted_locally' | 'syncing' | 'accepted' | 'rejected' | 'failed', number>>
	pendingSubmissionCount?: number
	savedProgressCount?: number
	localBlobBytes?: number
	localBlobCount?: number
	recentIssues?: readonly unknown[]
	storeIssues?: readonly { blocking?: boolean }[]
	forms?: readonly OfflineFormHealthInput[]
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
	publicRecovery?: PublicRecoveryDiagnosticsInput | null,
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

	const submittedLocally = Math.max(0, Number(publicRecovery?.submissions?.submitted_locally || 0))
	const syncing = Math.max(0, Number(publicRecovery?.submissions?.syncing || 0))
	const failed = Math.max(0, Number(publicRecovery?.submissions?.failed || 0))
	const rejected = Math.max(0, Number(publicRecovery?.submissions?.rejected || 0))
	const pendingSubmissionCount = Math.max(
		0,
		Number(publicRecovery?.pendingSubmissionCount ?? submittedLocally + syncing + failed),
	)
	const savedProgressCount = Math.max(0, Number(publicRecovery?.savedProgressCount || 0))
	const offlineFormsWithIssues = new Set(
		(publicRecovery?.forms || [])
			.filter(form => Number(form.failed || 0) > 0 || Number(form.rejected || 0) > 0)
			.map(form => String(form.formId || form.slug || ''))
			.filter(Boolean),
	).size
	const blockingStoreIssues = (publicRecovery?.storeIssues || []).filter(issue => issue.blocking !== false).length
	const recoveryRequired = failed + rejected + blockingStoreIssues > 0

	const tone: WorkspaceHealthTone =
		formsWithResponseCountDrift > 0 || recoveryRequired ? 'review'
		: stats.newResponses > 0 || pendingSubmissionCount > 0 || savedProgressCount > 0 ? 'active'
		: 'ready'

	const title =
		formsWithResponseCountDrift > 0 ? 'Workspace needs review'
		: recoveryRequired ? 'Offline responses need review'
		: pendingSubmissionCount > 0 ? 'Offline responses waiting'
		: savedProgressCount > 0 ? 'Saved respondent drafts'
		: tone === 'active' ? 'New responses ready'
		: 'Workspace ready'

	const description =
		formsWithResponseCountDrift > 0
			? 'Local response totals need reconciliation before release reporting.'
			: recoveryRequired
				? 'Some public submissions or local storage events need attention before reporting.'
			: pendingSubmissionCount > 0
				? 'Field submissions are preserved locally and will sync when connectivity returns.'
			: savedProgressCount > 0
				? 'Respondents have saved in-progress forms on this device.'
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
		offlinePendingSubmissions: pendingSubmissionCount,
		offlineSyncingSubmissions: syncing,
		offlineFailedSubmissions: failed,
		offlineRejectedSubmissions: rejected,
		offlineSavedProgress: savedProgressCount,
		offlineLocalBlobCount: Math.max(0, Number(publicRecovery?.localBlobCount || 0)),
		offlineLocalBlobBytes: Math.max(0, Number(publicRecovery?.localBlobBytes || 0)),
		offlineRecentIssueCount: publicRecovery?.recentIssues?.length || 0,
		offlineFormsWithIssues,
		offlineBlockingStoreIssues: blockingStoreIssues,
		offlineRecoveryRequired: recoveryRequired,
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
		fields: JSON.stringify(createFieldsFromTemplate(templateKey)),
		status: 'draft',
		ownerId,
		theme: 'red',
	}
}

export function buildDuplicateFormPayload(form: FormRecord, ownerId: string) {
	return {
		title: `Copy of ${String(form.title || 'Untitled Form')}`,
		description: String(form.description || ''),
		fields: typeof form.fields === 'string' ? form.fields : JSON.stringify(parseFormFields(form.fields)),
		status: 'draft',
		ownerId,
		theme: String(form.theme || 'blue'),
		settings: typeof form.settings === 'string' ? form.settings : JSON.stringify(parseFormSettings(form.settings)),
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
