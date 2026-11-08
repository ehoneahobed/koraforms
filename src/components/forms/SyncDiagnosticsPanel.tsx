import { Activity, Check, Copy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSyncStatus } from '@korajs/react'
import { app } from '../../kora'
import {
	buildSyncDiagnosticsReport,
	describeSyncDiagnostics,
	getSyncMilestones,
	summarizeOperations,
	type OperationSummary,
	type SyncDiagnosticsReport,
} from '../../features/sync/diagnostics'

const REFRESH_MS = 2_000

async function readServerVersion(): Promise<string | null> {
	try {
		const controller = new AbortController()
		const timer = window.setTimeout(() => controller.abort(), 3_000)
		const response = await fetch('/health', { signal: controller.signal, cache: 'no-store' })
		window.clearTimeout(timer)
		if (!response.ok) return null
		const body = (await response.json()) as { version?: unknown }
		return typeof body.version === 'string' ? body.version : null
	} catch {
		return null
	}
}

async function readRejectedCount(): Promise<number> {
	try {
		return (await app.sync?.getRejectedOperations())?.length ?? 0
	} catch {
		return 0
	}
}

/**
 * Sync diagnostics for Settings: what this device's sync is doing right now and
 * how long it took to get here, with a copy button that produces a report with
 * no form content in it. Reads the local store and the sync engine only.
 */
export function SyncDiagnosticsPanel({ localForms, localResponses }: { localForms: number; localResponses: number }) {
	const status = useSyncStatus()
	const [tick, setTick] = useState(0)
	const [rejected, setRejected] = useState(0)
	const [serverVersion, setServerVersion] = useState<string | null>(null)
	const [operations, setOperations] = useState<OperationSummary | null>(null)
	const [counting, setCounting] = useState(false)
	const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

	useEffect(() => {
		let cancelled = false
		void readServerVersion().then((version) => { if (!cancelled) setServerVersion(version) })
		const interval = window.setInterval(() => {
			setTick((value) => value + 1)
			void readRejectedCount().then((count) => { if (!cancelled) setRejected(count) })
		}, REFRESH_MS)
		void readRejectedCount().then((count) => { if (!cancelled) setRejected(count) })
		return () => {
			cancelled = true
			window.clearInterval(interval)
		}
	}, [])

	// Reads the whole local operation log once, on request: it can be large, so it is
	// never part of the 2 second refresh.
	const countOperations = useCallback(async () => {
		setCounting(true)
		try {
			await app.ready
			setOperations(summarizeOperations(await app.getStore().getAllOperations()))
		} catch (error) {
			console.error('[koraforms] Counting local operations failed', error)
		} finally {
			setCounting(false)
		}
	}, [])

	const report: SyncDiagnosticsReport = useMemo(() => {
		void tick
		const engine = app.sync?.exportDiagnostics() ?? null
		let storageBackend: string | null = null
		try {
			const info = app.storeInfo()
			storageBackend = `${info.persistence}${info.durable ? '' : ' (not durable)'}`
		} catch {
			storageBackend = null
		}
		return buildSyncDiagnosticsReport({
			status,
			engine: engine
				? {
					state: engine.state,
					schemaVersion: engine.schemaVersion,
					hasInFlightBatch: engine.hasInFlightBatch,
					deliveryGapRepeatCount: engine.deliveryGapRepeatCount,
					nodeId: engine.nodeId,
				}
				: null,
			rejectedOperations: rejected,
			counts: { forms: localForms, responses: localResponses },
			operations,
			milestones: getSyncMilestones(),
			environment: {
				online: navigator.onLine,
				build: import.meta.env.MODE,
				serverVersion,
				userAgent: navigator.userAgent,
				storageBackend,
				sinceLoadMs: performance.now(),
			},
		})
	}, [status, tick, rejected, serverVersion, localForms, localResponses, operations])

	const rows = useMemo(() => describeSyncDiagnostics(report), [report])

	const copy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
			setCopyState('copied')
		} catch {
			setCopyState('failed')
		}
		window.setTimeout(() => setCopyState('idle'), 2_500)
	}, [report])

	return (
		<section
			className="mb-5 rounded-2xl border border-slate-200 bg-white/70 px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/65"
			aria-label="Sync diagnostics"
		>
			<div className="mb-3 flex items-start justify-between gap-4">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
						<Activity className="h-4 w-4" />
					</div>
					<p className="text-[13px] text-slate-500 dark:text-gray-400">
						What sync is doing on this device. Copy it when something looks stuck: it holds counts and timings, never form content.
					</p>
				</div>
				<div className="flex shrink-0 gap-2">
				<button
					type="button"
					disabled={counting}
					onClick={() => { void countOperations() }}
					className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
				>
					{counting ? 'Counting...' : 'Count operations'}
				</button>
				<button
					type="button"
					onClick={() => { void copy() }}
					className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
				>
					{copyState === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
					{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy unavailable' : 'Copy diagnostics'}
				</button>
				</div>
			</div>
			<dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2" data-testid="sync-diagnostics">
				{rows.map((row) => (
					<div key={row.label} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 dark:border-slate-800/70">
						<dt className="shrink-0 text-[13px] text-slate-500 dark:text-gray-400">{row.label}</dt>
						<dd className={`min-w-0 truncate text-right text-[13px] font-medium ${row.tone === 'attention' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-gray-100'}`}>
							{row.value}
						</dd>
					</div>
				))}
			</dl>
		</section>
	)
}
