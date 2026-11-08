import type { SyncStatusInfo } from 'korajs'

/**
 * Sync milestones, measured in milliseconds since the page started loading
 * (`performance.now()`), so "how long until my forms arrived on this device"
 * is a number a creator can copy into a bug report.
 */
export const SYNC_MILESTONES = [
	'ready',
	'first-status',
	'first-syncing',
	'initial-sync-complete',
	'first-synced',
] as const
export type SyncMilestone = typeof SYNC_MILESTONES[number]

const marks = new Map<SyncMilestone, number>()

/** Records a milestone once; later calls for the same milestone are ignored. */
export function markSyncMilestone(name: SyncMilestone, at: number = performance.now()): void {
	if (!marks.has(name)) marks.set(name, Math.round(at))
}

/** The milestones reached so far, in declaration order. */
export function getSyncMilestones(): Partial<Record<SyncMilestone, number>> {
	const out: Partial<Record<SyncMilestone, number>> = {}
	for (const name of SYNC_MILESTONES) {
		const at = marks.get(name)
		if (at !== undefined) out[name] = at
	}
	return out
}

/** Test seam: forget every milestone. */
export function resetSyncMilestones(): void {
	marks.clear()
}

/** Turns one status snapshot into milestones. Pure apart from the shared marks. */
export function recordMilestonesFromStatus(info: SyncStatusInfo, at: number = performance.now()): void {
	markSyncMilestone('first-status', at)
	if (info.status === 'syncing') markSyncMilestone('first-syncing', at)
	if (info.initialSync?.complete) markSyncMilestone('initial-sync-complete', at)
	if (info.status === 'synced') markSyncMilestone('first-synced', at)
}

/**
 * Starts recording milestones from a status feed. Returns the unsubscribe.
 * Reads the current status first, so a status reached before this was called
 * is not missed.
 */
export function observeSyncMilestones(feed: {
	getStatus: () => SyncStatusInfo
	subscribeStatus: (listener: (status: SyncStatusInfo) => void) => () => void
}): () => void {
	recordMilestonesFromStatus(feed.getStatus())
	return feed.subscribeStatus((info) => recordMilestonesFromStatus(info))
}

export interface SyncDiagnosticsInput {
	status: SyncStatusInfo
	/** `app.sync.exportDiagnostics()`, when sync is configured. */
	engine: {
		state: string
		schemaVersion: number
		hasInFlightBatch: boolean
		deliveryGapRepeatCount: number
		nodeId: string
	} | null
	rejectedOperations: number
	counts: { forms: number; responses: number }
	milestones: Partial<Record<SyncMilestone, number>>
	environment: {
		online: boolean
		build: string
		userAgent: string
		storageBackend: string | null
		/** The sync server's reported version, when it could be read. */
		serverVersion: string | null
		/** Milliseconds since the page started loading. */
		sinceLoadMs: number
	}
}

export interface SyncDiagnosticsReport {
	generatedAt: string
	build: string
	serverVersion: string | null
	status: string
	phase: string | null
	reason: string | null
	reconnecting: boolean
	online: boolean
	storageBackend: string | null
	localDurability: string
	engineState: string | null
	schemaVersion: number | null
	nodeId: string | null
	serverProtocolVersion: number | null
	protocolDeprecated: boolean
	clockSkewMs: number | null
	pendingOperations: number
	heldOperations: number
	inFlightUploadOperations: number
	hasInFlightBatch: boolean
	hasInFlightDeliveryBatch: boolean
	rejectedOperations: number
	deliveryWatermark: number | null
	serverFrontier: number | null
	deliveryLag: number | null
	deliveryGapRepeatCount: number
	initialSync: { complete: boolean; receivedBatches: number; totalBatches: number | null; progressPercent: number | null } | null
	blockedFailure: string | null
	lastSyncedAt: string | null
	lastSuccessfulPull: string | null
	lastSuccessfulPush: string | null
	localForms: number
	localResponses: number
	sinceLoadMs: number
	milestonesMs: Partial<Record<SyncMilestone, number>>
	userAgent: string
}

function iso(timestamp: number | null | undefined): string | null {
	return typeof timestamp === 'number' ? new Date(timestamp).toISOString() : null
}

function describeBlockedFailure(failure: SyncStatusInfo['blockedFailure']): string | null {
	if (!failure) return null
	// Code, collection and retry count only: the failure's message and record id
	// can carry form content, so they stay out of anything that gets copied.
	return `${failure.code} on ${failure.collection}, ${failure.retriable ? 'retriable' : 'permanent'}, tried ${failure.retryCount} times`
}

/**
 * Builds the copyable report. It holds states, counts, timings and ids of this
 * device only: no form content, no emails, no tokens, no record ids.
 */
export function buildSyncDiagnosticsReport(input: SyncDiagnosticsInput, now: number = Date.now()): SyncDiagnosticsReport {
	const { status, engine } = input
	const watermark = status.deliveryWatermark ?? null
	const frontier = status.serverFrontier ?? null
	const initial = status.initialSync
	return {
		generatedAt: new Date(now).toISOString(),
		build: input.environment.build,
		serverVersion: input.environment.serverVersion,
		status: status.status,
		phase: status.phase ?? null,
		reason: status.reason ?? null,
		reconnecting: status.reconnecting,
		online: input.environment.online,
		storageBackend: input.environment.storageBackend,
		localDurability: status.localDurability ?? 'durable',
		engineState: engine?.state ?? null,
		schemaVersion: engine?.schemaVersion ?? null,
		nodeId: engine?.nodeId ?? null,
		serverProtocolVersion: status.serverProtocolVersion ?? null,
		protocolDeprecated: status.protocolDeprecated === true,
		clockSkewMs: status.clockSkewMs,
		pendingOperations: status.pendingOperations,
		heldOperations: status.heldOperations ?? 0,
		inFlightUploadOperations: status.inFlightUploadOperations ?? 0,
		hasInFlightBatch: engine?.hasInFlightBatch ?? false,
		hasInFlightDeliveryBatch: status.hasInFlightDeliveryBatch ?? false,
		rejectedOperations: input.rejectedOperations,
		deliveryWatermark: watermark,
		serverFrontier: frontier,
		// How far this device is behind what the server has for it; 0 means caught up.
		deliveryLag: watermark !== null && frontier !== null ? Math.max(0, frontier - watermark) : null,
		deliveryGapRepeatCount: engine?.deliveryGapRepeatCount ?? 0,
		initialSync: initial
			? {
				complete: initial.complete,
				receivedBatches: initial.receivedBatches,
				totalBatches: initial.totalBatches,
				progressPercent: initial.progress === null ? null : Math.round(initial.progress * 100),
			}
			: null,
		blockedFailure: describeBlockedFailure(status.blockedFailure),
		lastSyncedAt: iso(status.lastSyncedAt),
		lastSuccessfulPull: iso(status.lastSuccessfulPull),
		lastSuccessfulPush: iso(status.lastSuccessfulPush),
		localForms: input.counts.forms,
		localResponses: input.counts.responses,
		sinceLoadMs: Math.round(input.environment.sinceLoadMs),
		milestonesMs: input.milestones,
		userAgent: input.environment.userAgent,
	}
}

export interface SyncDiagnosticsRow {
	label: string
	value: string
	/** `attention` rows are the ones worth reading first when sync looks stuck. */
	tone: 'normal' | 'attention'
}

function seconds(ms: number | undefined): string {
	return ms === undefined ? 'not yet' : `${(ms / 1000).toFixed(1)}s after load`
}

/** The rows the Settings panel shows, in reading order. */
export function describeSyncDiagnostics(report: SyncDiagnosticsReport): SyncDiagnosticsRow[] {
	const rows: SyncDiagnosticsRow[] = []
	const add = (label: string, value: string, tone: SyncDiagnosticsRow['tone'] = 'normal') => {
		rows.push({ label, value, tone })
	}
	const initial = report.initialSync
	add('Status', `${report.status}${report.phase ? ` (${report.phase})` : ''}${report.reason ? `: ${report.reason}` : ''}`)
	add('Connection', report.online ? (report.reconnecting ? 'online, reconnecting' : 'online') : 'offline', report.online ? 'normal' : 'attention')
	if (initial) {
		const batches = initial.totalBatches === null ? `${initial.receivedBatches} so far` : `${initial.receivedBatches} of ${initial.totalBatches}`
		add('Download', initial.complete ? 'complete' : `in progress, batches ${batches}${initial.progressPercent === null ? '' : `, ${initial.progressPercent}%`}`, initial.complete ? 'normal' : 'attention')
	}
	if (report.deliveryLag !== null) add('Behind the server by', `${report.deliveryLag} operations`, report.deliveryLag > 0 ? 'attention' : 'normal')
	if (report.blockedFailure) add('Blocked on', report.blockedFailure, 'attention')
	add('Waiting to upload', String(report.pendingOperations), report.pendingOperations > 0 ? 'attention' : 'normal')
	if (report.heldOperations > 0) add('Held for another user', String(report.heldOperations), 'attention')
	if (report.rejectedOperations > 0) add('Refused by the server', String(report.rejectedOperations), 'attention')
	if (report.deliveryGapRepeatCount > 0) add('Repeated delivery gaps', String(report.deliveryGapRepeatCount), 'attention')
	add('On this device', `${report.localForms} forms, ${report.localResponses} responses`)
	add('Storage', `${report.storageBackend ?? 'unknown'}, ${report.localDurability}`, report.localDurability === 'durable' ? 'normal' : 'attention')
	add('Last download', report.lastSuccessfulPull ?? 'never')
	add('Last upload', report.lastSuccessfulPush ?? 'never')
	if (report.clockSkewMs !== null && Math.abs(report.clockSkewMs) > 5_000) {
		add('Clock', `${Math.round(report.clockSkewMs / 1000)}s off the server`, 'attention')
	}
	if (report.protocolDeprecated) add('Server protocol', `v${report.serverProtocolVersion ?? '?'} (deprecated)`, 'attention')
	add('Sync ready', seconds(report.milestonesMs.ready))
	add('First sync status', seconds(report.milestonesMs['first-status']))
	add('Download complete', seconds(report.milestonesMs['initial-sync-complete']))
	add('Fully synced', seconds(report.milestonesMs['first-synced']))
	add('Build', report.serverVersion ? `${report.build}, server ${report.serverVersion}` : report.build)
	return rows
}
