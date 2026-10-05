import { useSyncExternalStore } from 'react'
import { AlertCircle, AlertTriangle, X } from 'lucide-react'
import type { KoraNoticeStore } from '../../features/sync/notices'

/**
 * Store and sync states a creator must act on. Rendered outside KoraProvider:
 * `store:storage-blocked` fires while `app.ready` is still waiting, when the
 * provider would otherwise show only its loader.
 */
export function KoraNotices({ store }: { store: KoraNoticeStore }) {
	const notices = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)

	if (notices.length === 0) return null

	return (
		<div className="fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-3 pointer-events-none" aria-live="polite">
			{notices.map(notice => (
				<div
					key={notice.id}
					role={notice.tone === 'error' ? 'alert' : 'status'}
					className={`pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
						notice.tone === 'error'
							? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950 dark:text-red-100'
							: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-100'
					}`}
				>
					{notice.tone === 'error'
						? <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
						: <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
					<div className="min-w-0 flex-1">
						<p className="font-medium">{notice.title}</p>
						<p className="mt-0.5 break-words opacity-90">{notice.message}</p>
					</div>
					{notice.dismissible && (
						<button
							type="button"
							onClick={() => store.dismiss(notice.id)}
							className="rounded-md p-1 opacity-70 hover:opacity-100"
							aria-label="Dismiss"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>
			))}
		</div>
	)
}
