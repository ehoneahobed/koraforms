import { parseFormFields, parseFormSettings, serializeFormFields, serializeFormSettings } from '../../domain/forms'
import { stripFormAccessSecrets } from '../../domain/formPassword'
import type { FormField, FormSettings } from '../../types'

export type JsonRecord = Record<string, unknown>

export type PublicFormSource = 'network' | 'local'
export type PublicSubmissionStatus = 'accepted' | 'queued'
export type ResponseSubmissionLocalStatus = 'submitted_locally' | 'syncing' | 'accepted' | 'rejected' | 'failed'

export const PUBLIC_OFFLINE_LIMITS = {
	maxPendingSubmissionsPerForm: 100,
	maxPendingSubmissionsTotal: 500,
	maxLocalBlobBytes: 250 * 1024 * 1024,
	maxLocalBlobBytesPerWrite: 10 * 1024 * 1024,
} as const

export class PublicOfflineLimitError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'PublicOfflineLimitError'
	}
}

export interface PublicFormVersionRecord {
	id?: string
	slug: string
	formId: string
	versionHash: string
	title: string
	description: string
	fields: string | FormField[]
	settings: string | FormSettings
	theme: string
	status: 'published' | 'revoked'
	cachedAt: number
	publishedAt: number
}

export interface ResponseSubmissionRecord {
	id?: string
	formId: string
	slug: string
	formVersionHash: string
	data: string | JsonRecord
	clientSubmissionId: string
	localStatus: ResponseSubmissionLocalStatus
	attempts: number
	lastError: string
	submittedAt: number
	updatedAt: number
}

export interface PublicFormProgressRecord {
	id?: string
	slug: string
	formId: string
	answers: string | JsonRecord
	currentIndex: number
	resumeId: string
	resumeUrl: string
	savedAt: number
	updatedAt: number
}

export interface FlushResult {
	synced: number
	failed: number
	rejected: number
	remaining: number
}

export interface PublicOfflineSubmissionIssue {
	id: string
	clientSubmissionId: string
	formId: string
	slug: string
	status: Extract<ResponseSubmissionLocalStatus, 'failed' | 'rejected'>
	attempts: number
	lastError: string
	updatedAt: number
}

export interface PublicOfflineFormDiagnostics {
	formId: string
	slug: string
	submitted_locally: number
	syncing: number
	accepted: number
	rejected: number
	failed: number
	progressCount: number
	lastActivityAt: number
}

export interface PublicStoreIssue {
	type: 'storage-fallback' | 'opfs-unavailable' | 'db-name-collision' | 'persistence-error' | 'quota-exceeded'
	message: string
	reason?: string
	dbName?: string
	from?: string
	to?: string
	blocking?: boolean
	seenAt: number
}

export interface PublicOfflineDiagnostics {
	generatedAt: number
	submissions: Record<ResponseSubmissionLocalStatus, number>
	pendingSubmissionCount: number
	savedProgressCount: number
	localBlobBytes: number
	localBlobCount: number
	recentIssues: PublicOfflineSubmissionIssue[]
	storeIssues: PublicStoreIssue[]
	forms: PublicOfflineFormDiagnostics[]
}

export type PublicOfflineReadinessStatus = 'ready' | 'pending' | 'unavailable'
export type PublicOfflineReadinessCheckId = 'form-version' | 'app-shell' | 'local-storage' | 'submission-queue'

export interface PublicOfflineReadinessCheck {
	id: PublicOfflineReadinessCheckId
	label: string
	status: PublicOfflineReadinessStatus
	detail: string
}

export interface PublicOfflineReadiness {
	ready: boolean
	formSource: PublicFormSource | null
	cachedVersionHash: string
	pendingSubmissionCount: number
	rejectedSubmissionCount: number
	localBlobBytes: number
	localBlobCount: number
	storeIssues: PublicStoreIssue[]
	checks: PublicOfflineReadinessCheck[]
}

export function stableHash(value: unknown): string {
	const json = JSON.stringify(value)
	let hash = 0
	for (let i = 0; i < json.length; i++) {
		hash = ((hash << 5) - hash) + json.charCodeAt(i)
		hash |= 0
	}
	return String(hash >>> 0)
}

export function isCacheablePublicForm(form: Record<string, unknown>): boolean {
	if ((form as { passwordProtected?: unknown }).passwordProtected) return false
	if (!form.id || !form.fields) return false
	return true
}

export function buildPublicOfflineReadiness(params: {
	hasCachedForm: boolean
	cachedVersionHash?: string
	formSource?: PublicFormSource | null
	appShellSupported: boolean
	appShellReady: boolean
	localDatabaseReady: boolean
	blobStorageReady: boolean
	pendingSubmissionCount: number
	rejectedSubmissionCount: number
	localBlobBytes: number
	localBlobCount: number
	storeIssues?: PublicStoreIssue[]
}): PublicOfflineReadiness {
	const storeIssue = params.storeIssues?.find(issue => issue.blocking !== false) ?? null
	const checks: PublicOfflineReadinessCheck[] = [
		{
			id: 'form-version',
			label: 'Form saved on this device',
			status: params.hasCachedForm ? 'ready' : 'pending',
			detail: params.hasCachedForm
				? 'This published version can open without a network connection.'
				: 'Open or prepare this form while online before field use.',
		},
		{
			id: 'app-shell',
			label: 'App shell cached',
			status: params.appShellReady ? 'ready' : params.appShellSupported ? 'pending' : 'unavailable',
			detail: params.appShellReady
				? 'The form runtime is available for offline reloads.'
				: params.appShellSupported
					? 'The browser is still preparing the offline app shell.'
					: 'This browser does not expose service worker offline caching.',
		},
		{
			id: 'local-storage',
			label: 'Attachment storage ready',
			status: storeIssue || !params.localDatabaseReady || !params.blobStorageReady ? 'unavailable' : 'ready',
			detail: storeIssue
				? storeIssue.type === 'opfs-unavailable'
					? `Kora storage fell back because OPFS is ${storeIssue.reason || 'unavailable'}. Use another browser or prepare while online.`
					: storeIssue.message
				: params.localDatabaseReady && params.blobStorageReady
				? params.localBlobCount > 0
					? `${params.localBlobCount} local file${params.localBlobCount === 1 ? '' : 's'} saved for sync.`
					: 'Files and signatures can be saved locally before sync.'
				: 'This device cannot currently persist offline files safely.',
		},
		{
			id: 'submission-queue',
			label: 'Submission queue clear',
			status: params.rejectedSubmissionCount > 0
				? 'unavailable'
				: params.pendingSubmissionCount > 0
					? 'pending'
					: 'ready',
			detail: params.rejectedSubmissionCount > 0
				? `${params.rejectedSubmissionCount} response${params.rejectedSubmissionCount === 1 ? '' : 's'} needs review.`
				: params.pendingSubmissionCount > 0
					? `${params.pendingSubmissionCount} response${params.pendingSubmissionCount === 1 ? '' : 's'} waiting to sync.`
					: 'No local submissions are waiting on this device.',
		},
	]

	return {
		ready: checks.every(check => check.status === 'ready'),
		formSource: params.formSource ?? null,
		cachedVersionHash: params.cachedVersionHash || '',
		pendingSubmissionCount: params.pendingSubmissionCount,
		rejectedSubmissionCount: params.rejectedSubmissionCount,
		localBlobBytes: params.localBlobBytes,
		localBlobCount: params.localBlobCount,
		storeIssues: params.storeIssues ?? [],
		checks,
	}
}

export function buildPublicFormVersionRecord(
	slug: string,
	form: Record<string, unknown>,
	now = Date.now(),
): PublicFormVersionRecord {
	const settings = stripFormAccessSecrets(parseFormSettings(form.settings))
	const fields = JSON.stringify(serializeFormFields(parseFormFields(form.fields)))
	const serializedSettings = JSON.stringify(serializeFormSettings(settings))
	const versionHash = stableHash({
		id: form.id,
		title: form.title,
		description: form.description,
		fields,
		settings: serializedSettings,
		theme: form.theme,
		status: form.status,
	})

	return {
		slug,
		formId: String(form.id || slug),
		versionHash,
		title: String(form.title || 'Untitled form'),
		description: String(form.description || ''),
		fields,
		settings: serializedSettings,
		theme: String(form.theme || 'red'),
		status: 'published',
		cachedAt: now,
		publishedAt: typeof form.createdAt === 'number' ? form.createdAt : now,
	}
}

export function publicFormRecordToForm(record: PublicFormVersionRecord): Record<string, unknown> {
	return {
		id: record.formId,
		slug: record.slug,
		title: record.title,
		description: record.description,
		fields: record.fields,
		settings: record.settings,
		theme: record.theme,
		status: record.status,
		createdAt: record.publishedAt,
	}
}

export function buildResponseSubmissionRecord(
	params: {
		formId: string
		slug?: string
		formVersionHash?: string
		data: string | JsonRecord
		clientSubmissionId?: string
		now?: number
	},
): ResponseSubmissionRecord {
	const now = params.now ?? Date.now()
	return {
		formId: params.formId,
		slug: params.slug || '',
		formVersionHash: params.formVersionHash || '',
		data: params.data,
		clientSubmissionId: params.clientSubmissionId || createSubmissionId(),
		localStatus: 'submitted_locally',
		attempts: 0,
		lastError: '',
		submittedAt: now,
		updatedAt: now,
	}
}

export function buildPublicFormProgressRecord(
	params: {
		slug: string
		formId: string
		values: Record<string, string>
		currentIndex: number
		resumeId?: string | null
		resumeUrl?: string
		now?: number
	},
): PublicFormProgressRecord {
	const now = params.now ?? Date.now()
	return {
		slug: params.slug,
		formId: params.formId,
		answers: JSON.stringify(params.values),
		currentIndex: params.currentIndex,
		resumeId: params.resumeId || '',
		resumeUrl: params.resumeUrl || '',
		savedAt: now,
		updatedAt: now,
	}
}

export function shouldQueueSubmission(error: unknown, online: boolean): boolean {
	if (!online) return true
	return error instanceof TypeError
}

export function isPermanentSubmissionError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false
	return (error as { permanent?: unknown }).permanent === true
}

export function createSubmissionId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID()
	}
	return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function assertPendingSubmissionLimit(params: {
	formPendingCount: number
	totalPendingCount: number
	formLimit?: number
	totalLimit?: number
}): void {
	const formLimit = params.formLimit ?? PUBLIC_OFFLINE_LIMITS.maxPendingSubmissionsPerForm
	const totalLimit = params.totalLimit ?? PUBLIC_OFFLINE_LIMITS.maxPendingSubmissionsTotal
	if (params.formPendingCount >= formLimit) {
		throw new PublicOfflineLimitError(
			`This form has ${formLimit} responses waiting to sync on this device. Please reconnect before adding more.`,
		)
	}
	if (params.totalPendingCount >= totalLimit) {
		throw new PublicOfflineLimitError(
			`This device has ${totalLimit} responses waiting to sync. Please reconnect before adding more.`,
		)
	}
}

export function assertLocalBlobStorageLimit(params: {
	currentBytes: number
	nextBlobBytes: number
	replacingBytes?: number
	maxTotalBytes?: number
	maxWriteBytes?: number
}): void {
	const maxWriteBytes = params.maxWriteBytes ?? PUBLIC_OFFLINE_LIMITS.maxLocalBlobBytesPerWrite
	const maxTotalBytes = params.maxTotalBytes ?? PUBLIC_OFFLINE_LIMITS.maxLocalBlobBytes
	const replacingBytes = Math.max(0, params.replacingBytes ?? 0)
	const projectedBytes = Math.max(0, params.currentBytes - replacingBytes) + params.nextBlobBytes
	if (params.nextBlobBytes > maxWriteBytes) {
		throw new PublicOfflineLimitError(
			`This attachment is too large for offline submission. Maximum size is ${formatBytes(maxWriteBytes)}.`,
		)
	}
	if (projectedBytes > maxTotalBytes) {
		throw new PublicOfflineLimitError(
			`Offline attachment storage is full on this device. Please reconnect or remove saved files before adding more.`,
		)
	}
}

function formatBytes(bytes: number): string {
	const mb = bytes / (1024 * 1024)
	if (Number.isInteger(mb)) return `${mb}MB`
	return `${mb.toFixed(1)}MB`
}
