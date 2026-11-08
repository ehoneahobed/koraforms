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

/** What the local operation log holds for one collection. */
export interface CollectionOperationSummary {
	total: number
	inserts: number
	updates: number
	deletes: number
	/** Serialized size of `data` plus `previousData` over every operation, in bytes. */
	payloadBytes: number
	/** The largest single operation payload, in bytes. */
	largestPayloadBytes: number
	/** Updates whose every changed field already held that value (a write that changed nothing). */
	noOpUpdates: number
	/** How many updates touched each field, so a hot field stands out. */
	updatesByField: Record<string, number>
}

export interface OperationSummary {
	total: number
	payloadBytes: number
	/** Wall-clock span of the log (ISO), and the busiest UTC day with its operation count. */
	firstAt: string | null
	lastAt: string | null
	busiestDay: { day: string; operations: number } | null
	byCollection: Record<string, CollectionOperationSummary>
}

/** The fields of an operation that the summary reads. */
export interface SummarizableOperation {
	collection: string
	type: string
	data: unknown
	previousData: unknown
	timestamp?: { wallTime: number }
}

function sameValue(a: unknown, b: unknown): boolean {
	try {
		return JSON.stringify(a) === JSON.stringify(b)
	} catch {
		return false
	}
}

function jsonSize(value: unknown): number {
	if (value === null || value === undefined) return 0
	try {
		return JSON.stringify(value).length
	} catch {
		return 0
	}
}

/**
 * Counts the operations a device holds, by collection and type, with their payload
 * sizes. Counts and sizes only: no values leave this function, so the result is
 * safe to copy into a bug report.
 */
export function summarizeOperations(operations: readonly SummarizableOperation[]): OperationSummary {
	const byCollection: Record<string, CollectionOperationSummary> = {}
	let payloadBytes = 0
	let first = Number.POSITIVE_INFINITY
	let last = Number.NEGATIVE_INFINITY
	const perDay = new Map<string, number>()
	for (const operation of operations) {
		const entry = byCollection[operation.collection] ?? {
			total: 0, inserts: 0, updates: 0, deletes: 0, payloadBytes: 0, largestPayloadBytes: 0,
			noOpUpdates: 0, updatesByField: {},
		}
		const wall = operation.timestamp?.wallTime
		if (typeof wall === 'number' && Number.isFinite(wall)) {
			first = Math.min(first, wall)
			last = Math.max(last, wall)
			const day = new Date(wall).toISOString().slice(0, 10)
			perDay.set(day, (perDay.get(day) ?? 0) + 1)
		}
		const size = jsonSize(operation.data) + jsonSize(operation.previousData)
		entry.total += 1
		if (operation.type === 'insert') entry.inserts += 1
		else if (operation.type === 'update') {
			entry.updates += 1
			const data = operation.data !== null && typeof operation.data === 'object' ? operation.data as Record<string, unknown> : {}
			const previous = operation.previousData !== null && typeof operation.previousData === 'object' ? operation.previousData as Record<string, unknown> : null
			const keys = Object.keys(data)
			for (const key of keys) entry.updatesByField[key] = (entry.updatesByField[key] ?? 0) + 1
			if (previous && keys.length > 0 && keys.every((key) => key in previous && sameValue(data[key], previous[key]))) entry.noOpUpdates += 1
		}
		else if (operation.type === 'delete') entry.deletes += 1
		entry.payloadBytes += size
		entry.largestPayloadBytes = Math.max(entry.largestPayloadBytes, size)
		byCollection[operation.collection] = entry
		payloadBytes += size
	}
	let busiestDay: OperationSummary['busiestDay'] = null
	for (const [day, count] of perDay) if (!busiestDay || count > busiestDay.operations) busiestDay = { day, operations: count }
	return {
		total: operations.length,
		payloadBytes,
		firstAt: Number.isFinite(first) ? new Date(first).toISOString() : null,
		lastAt: Number.isFinite(last) ? new Date(last).toISOString() : null,
		busiestDay,
		byCollection,
	}
}

function kib(bytes: number): string {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KiB`
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
	/** Present once the person pressed "Count operations"; null before that. */
	operations?: OperationSummary | null
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
	/** The local operation log by collection, or null until it was counted. */
	operations: OperationSummary | null
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
		operations: input.operations ?? null,
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
	if (report.operations) {
		add('Operations on this device', `${report.operations.total} (${kib(report.operations.payloadBytes)})`)
		if (report.operations.firstAt && report.operations.lastAt) {
			add('Log spans', `${report.operations.firstAt.slice(0, 10)} to ${report.operations.lastAt.slice(0, 10)}`)
		}
		if (report.operations.busiestDay) add('Busiest day', `${report.operations.busiestDay.day}: ${report.operations.busiestDay.operations} operations`)
		for (const [collection, entry] of Object.entries(report.operations.byCollection).sort((a, b) => b[1].total - a[1].total)) {
			add(`  ${collection}`, `${entry.total}: ${entry.inserts} new, ${entry.updates} edits, ${entry.deletes} deletes, ${entry.noOpUpdates} changed nothing, largest ${kib(entry.largestPayloadBytes)}`)
		}
	}
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
