import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useSyncStatus } from '@korajs/react'
import { Bug } from 'lucide-react'
import { app } from '../kora'
import { setPageMeta } from '../utils/meta'
import { downloadJsonFile } from '../utils/download'
import { readJsonFromStorage } from '../utils/storage'
import { recordAuditEvent } from '../features/audit/events'
import {
	buildOwnerNotificationsInbox,
	buildRestoredFormPayload,
	buildRestoredResponsePayload,
	buildWorkspaceBackupPayload,
	buildWorkspaceHealthSnapshot,
	parseWorkspaceRestorePlan,
	workspaceBackupFilename,
	type FormRecord,
	type ResponseRecord,
} from '../features/forms/dashboard'
import { getPublicOfflineDiagnostics, type PublicOfflineDiagnostics } from '../features/form-fill/offlineRuntime'
import { OwnerInboxPanel, WorkspaceHealthPanel } from '../components/forms/WorkspaceDiagnosticsPanels'

interface Props {
	navigate: (path: string) => void
	userId: string
}

/**
 * Workspace settings / diagnostics — sync health, owner inbox, backup/restore.
 * Kept off the main Forms dashboard so day-to-day work stays uncluttered.
 */
export function WorkspaceSettings({ navigate, userId }: Props) {
	useEffect(() => {
		setPageMeta({
			title: 'Settings',
			description: 'Workspace diagnostics, sync health, and backup tools.',
		})
	}, [])

	const allForms = useQuery(
		userId
			? app.forms.where({ ownerId: userId }).orderBy('createdAt', 'desc')
			: app.forms.where({}).orderBy('createdAt', 'desc'),
	)
	const allResponses = useQuery(app.responses.where({}).orderBy('submittedAt', 'desc'))
	const allSideEffectDeliveries = useQuery(app.side_effect_deliveries.where({}).orderBy('updatedAt', 'desc'))
	const allAuditEvents = useQuery(app.audit_events.where({}).orderBy('createdAt', 'desc'))
	const syncStatus = useSyncStatus()
	const { mutateAsync: createForm } = useMutation(
		(data: Record<string, unknown>) => app.forms.insert(data),
	)
	const { mutateAsync: createResponse } = useMutation(
		(data: Record<string, unknown>) => app.responses.insert(data),
	)

	const [publicOfflineDiagnostics, setPublicOfflineDiagnostics] = useState<PublicOfflineDiagnostics | null>(null)
	const [restoreStatus, setRestoreStatus] = useState<{ tone: 'success' | 'error' | 'muted'; message: string } | null>(null)
	const restoreInputRef = useRef<HTMLInputElement | null>(null)

	const lastSeenKey = 'koraforms-last-seen'
	const lastSeen = useMemo(
		() => readJsonFromStorage<Record<string, number>>(lastSeenKey, {}),
		[allForms.length, allResponses.length],
	)

	const refreshPublicOfflineDiagnostics = useCallback(() => {
		getPublicOfflineDiagnostics()
			.then(setPublicOfflineDiagnostics)
			.catch(() => setPublicOfflineDiagnostics(null))
	}, [])

	useEffect(() => {
		refreshPublicOfflineDiagnostics()
		const interval = window.setInterval(refreshPublicOfflineDiagnostics, 15_000)
		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible') refreshPublicOfflineDiagnostics()
		}
		window.addEventListener('online', refreshPublicOfflineDiagnostics)
		document.addEventListener('visibilitychange', onVisibilityChange)
		return () => {
			window.clearInterval(interval)
			window.removeEventListener('online', refreshPublicOfflineDiagnostics)
			document.removeEventListener('visibilitychange', onVisibilityChange)
		}
	}, [refreshPublicOfflineDiagnostics])

	const workspaceHealth = useMemo(
		() => buildWorkspaceHealthSnapshot(allForms, allResponses, lastSeen, publicOfflineDiagnostics),
		[allForms, allResponses, lastSeen, publicOfflineDiagnostics],
	)
	const ownerInbox = useMemo(() => (
		buildOwnerNotificationsInbox({
			forms: allForms,
			responses: allResponses,
			lastSeen,
			sideEffectDeliveries: allSideEffectDeliveries,
			auditEvents: allAuditEvents,
			limit: 5,
		})
	), [allAuditEvents, allForms, allResponses, allSideEffectDeliveries, lastSeen])

	const handleBackupWorkspace = () => {
		const now = new Date()
		const data = buildWorkspaceBackupPayload(
			allForms as unknown as FormRecord[],
			allResponses as unknown as ResponseRecord[],
			now,
		)
		downloadJsonFile(data, workspaceBackupFilename(now))
	}

	const handleRestoreWorkspaceFile = async (file: File | null) => {
		if (!file) return
		setRestoreStatus({ tone: 'muted', message: 'Reading backup...' })
		try {
			const text = await file.text()
			const plan = parseWorkspaceRestorePlan(JSON.parse(text) as unknown)
			if (plan.forms.length === 0) {
				setRestoreStatus({ tone: 'error', message: 'This backup does not contain any forms.' })
				return
			}

			const formIdMap = new Map<string, string>()
			for (const form of plan.forms) {
				const restored = await createForm(buildRestoredFormPayload(form, userId))
				formIdMap.set(form.id, String(restored.id))
				void recordAuditEvent(app.audit_events, {
					formId: String(restored.id),
					actorId: userId,
					eventType: 'form_restored',
					summary: 'Restored form from workspace backup',
					metadata: {
						sourceFormId: form.id,
						sourceSlug: form.originalSlug,
						sourceStatus: form.originalStatus,
						backupExportedAt: plan.exportedAt,
					},
				})
			}

			for (const response of plan.responses) {
				const restoredFormId = formIdMap.get(response.formId)
				if (!restoredFormId) continue
				await createResponse(buildRestoredResponsePayload(response, restoredFormId))
			}

			setRestoreStatus({
				tone: 'success',
				message: `Restored ${plan.forms.length} form${plan.forms.length === 1 ? '' : 's'} and ${plan.responses.length} response${plan.responses.length === 1 ? '' : 's'} as draft copies.`,
			})
		} catch (error) {
			setRestoreStatus({
				tone: 'error',
				message: error instanceof Error ? error.message : 'Could not restore this backup.',
			})
		} finally {
			if (restoreInputRef.current) restoreInputRef.current.value = ''
		}
	}

	return (
		<div className="mx-auto w-full max-w-[1220px] min-w-0 overflow-x-hidden">
			<div className="mb-6 flex items-start gap-3">
				<div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
					<Bug className="h-5 w-5" />
				</div>
				<div>
					<h1 className="text-[40px] leading-none font-bold text-slate-950 dark:text-gray-100 tracking-[-0.02em]">
						Settings
					</h1>
					<p className="mt-3 text-[16px] text-slate-500 dark:text-gray-400">
						Diagnostics and recovery tools — open this when something looks wrong.
					</p>
				</div>
			</div>

			<section className="mb-8">
				<h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
					Workspace health
				</h2>
				<WorkspaceHealthPanel
					health={workspaceHealth}
					syncStatus={syncStatus.status}
					onBackup={handleBackupWorkspace}
					onRestore={() => restoreInputRef.current?.click()}
				/>
				<input
					ref={restoreInputRef}
					type="file"
					accept=".json,application/json"
					className="hidden"
					onChange={(event) => {
						handleRestoreWorkspaceFile(event.target.files?.[0] || null).catch(() => {})
					}}
				/>
				{restoreStatus && (
					<div className={`mb-5 rounded-2xl border px-4 py-3 text-[13px] font-medium ${
						restoreStatus.tone === 'success'
							? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300'
							: restoreStatus.tone === 'error'
								? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300'
								: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-gray-300'
					}`}>
						{restoreStatus.message}
					</div>
				)}
			</section>

			<section>
				<h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
					Owner inbox
				</h2>
				<OwnerInboxPanel
					items={ownerInbox}
					onOpen={(item) => {
						if (item.action === 'responses') navigate(`responses/${item.formId}`)
						else if (item.action === 'settings') navigate(`/forms/${item.formId}/edit?panel=settings`)
						else navigate(`build/${item.formId}`)
					}}
				/>
			</section>
		</div>
	)
}
