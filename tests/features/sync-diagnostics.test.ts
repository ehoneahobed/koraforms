import test from 'node:test'
import assert from 'node:assert/strict'
import type { SyncStatusInfo } from 'korajs'
import {
	buildSyncDiagnosticsReport,
	describeSyncDiagnostics,
	getSyncMilestones,
	markSyncMilestone,
	observeSyncMilestones,
	resetSyncMilestones,
	type SyncDiagnosticsInput,
} from '../../src/features/sync/diagnostics'

function status(overrides: Partial<SyncStatusInfo> = {}): SyncStatusInfo {
	return {
		status: 'syncing',
		reconnecting: false,
		pendingOperations: 0,
		lastSyncedAt: null,
		lastSuccessfulPush: null,
		lastSuccessfulPull: null,
		conflicts: 0,
		clockSkewMs: null,
		...overrides,
	}
}

function input(overrides: Partial<SyncDiagnosticsInput> = {}): SyncDiagnosticsInput {
	return {
		status: status(),
		engine: { state: 'syncing', schemaVersion: 21, hasInFlightBatch: false, deliveryGapRepeatCount: 0, nodeId: 'node-1' },
		rejectedOperations: 0,
		counts: { forms: 2, responses: 4 },
		milestones: {},
		environment: { online: true, build: 'production', serverVersion: null, userAgent: 'test', storageBackend: 'sqlite-wasm', sinceLoadMs: 12_345.6 },
		...overrides,
	}
}

test('the report says how far behind the server a device is, and zero when caught up', () => {
	const behind = buildSyncDiagnosticsReport(input({ status: status({ deliveryWatermark: 40, serverFrontier: 100 }) }))
	assert.equal(behind.deliveryLag, 60)
	const caughtUp = buildSyncDiagnosticsReport(input({ status: status({ deliveryWatermark: 100, serverFrontier: 100 }) }))
	assert.equal(caughtUp.deliveryLag, 0)
	const unknown = buildSyncDiagnosticsReport(input({ status: status({ deliveryWatermark: 5 }) }))
	assert.equal(unknown.deliveryLag, null)
})

test('a lag never goes negative when the frontier is stale', () => {
	const report = buildSyncDiagnosticsReport(input({ status: status({ deliveryWatermark: 10, serverFrontier: 4 }) }))
	assert.equal(report.deliveryLag, 0)
})

test('a blocked failure is reported by code, collection and retries only, never by message or record id', () => {
	const report = buildSyncDiagnosticsReport(input({
		status: status({
			blockedFailure: {
				operationId: 'op-secret',
				collection: 'forms',
				recordId: 'record-secret',
				code: 'DECRYPT_FAILED',
				message: 'title "Church Member Registration" could not be read',
				retriable: true,
				firstSeenAt: 1,
				retryCount: 3,
			},
		}),
	}))
	assert.equal(report.blockedFailure, 'DECRYPT_FAILED on forms, retriable, tried 3 times')
	const text = JSON.stringify(report)
	for (const secret of ['op-secret', 'record-secret', 'Church Member Registration']) {
		assert.equal(text.includes(secret), false, `${secret} must not be in the copied report`)
	}
})

test('rows put the things worth reading first on attention, and stay quiet when healthy', () => {
	const healthy = describeSyncDiagnostics(buildSyncDiagnosticsReport(input({
		status: status({ status: 'synced', deliveryWatermark: 9, serverFrontier: 9, initialSync: { complete: true, receivedBatches: 1, totalBatches: 1, progress: 1 } }),
	})))
	assert.deepEqual(healthy.filter(row => row.tone === 'attention'), [])

	const stuck = describeSyncDiagnostics(buildSyncDiagnosticsReport(input({
		status: status({
			pendingOperations: 3,
			deliveryWatermark: 0,
			serverFrontier: 500,
			initialSync: { complete: false, receivedBatches: 2, totalBatches: 10, progress: 0.2 },
		}),
		rejectedOperations: 1,
	})))
	const attention = stuck.filter(row => row.tone === 'attention').map(row => row.label)
	assert.deepEqual(attention, ['Download', 'Behind the server by', 'Waiting to upload', 'Refused by the server'])
	assert.match(stuck.find(row => row.label === 'Download')?.value ?? '', /batches 2 of 10, 20%/)
})

test('offline and non-durable storage are flagged', () => {
	const rows = describeSyncDiagnostics(buildSyncDiagnosticsReport(input({
		status: status({ status: 'offline', localDurability: 'degraded' }),
		environment: { online: false, build: 'production', serverVersion: '1.0.0', userAgent: 'test', storageBackend: 'indexeddb', sinceLoadMs: 1 },
	})))
	assert.equal(rows.find(row => row.label === 'Connection')?.tone, 'attention')
	assert.equal(rows.find(row => row.label === 'Storage')?.tone, 'attention')
	assert.match(rows.find(row => row.label === 'Build')?.value ?? '', /server 1\.0\.0/)
})

test('a milestone keeps the first time it was reached', () => {
	resetSyncMilestones()
	markSyncMilestone('first-synced', 1_200.4)
	markSyncMilestone('first-synced', 9_000)
	assert.deepEqual(getSyncMilestones(), { 'first-synced': 1_200 })
})

test('observing a status feed records milestones, including one already reached', () => {
	resetSyncMilestones()
	let listener: ((info: SyncStatusInfo) => void) | null = null
	let unsubscribed = false
	const stop = observeSyncMilestones({
		getStatus: () => status({ status: 'syncing' }),
		subscribeStatus: (next) => {
			listener = next
			return () => { unsubscribed = true }
		},
	})
	const afterStart = getSyncMilestones()
	assert.ok(afterStart['first-status'] !== undefined)
	assert.ok(afterStart['first-syncing'] !== undefined)
	assert.equal(afterStart['first-synced'], undefined)

	listener?.(status({ status: 'synced', initialSync: { complete: true, receivedBatches: 1, totalBatches: 1, progress: 1 } }))
	const afterSynced = getSyncMilestones()
	assert.ok(afterSynced['initial-sync-complete'] !== undefined)
	assert.ok(afterSynced['first-synced'] !== undefined)

	stop()
	assert.equal(unsubscribed, true)
	resetSyncMilestones()
})
