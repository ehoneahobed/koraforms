import { useState } from 'react'
import { useSyncStatus } from '@korajs/react'
import { FileText, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { FormList } from './pages/FormList'
import { FormBuilder } from './pages/FormBuilder'
import { FormFill } from './pages/FormFill'
import { FormResponses } from './pages/FormResponses'

// Simple hash-based routing — no extra dependencies
type Route =
	| { page: 'list' }
	| { page: 'builder'; formId?: string }
	| { page: 'fill'; formId: string }
	| { page: 'responses'; formId: string }

function parseRoute(hash: string): Route {
	const parts = hash.replace('#', '').split('/')
	if (parts[0] === 'build') return { page: 'builder', formId: parts[1] }
	if (parts[0] === 'fill' && parts[1]) return { page: 'fill', formId: parts[1] }
	if (parts[0] === 'responses' && parts[1]) return { page: 'responses', formId: parts[1] }
	return { page: 'list' }
}

export function App() {
	const [hash, setHash] = useState(window.location.hash)
	const status = useSyncStatus()

	// Listen to hash changes
	useState(() => {
		const handler = () => setHash(window.location.hash)
		window.addEventListener('hashchange', handler)
		return () => window.removeEventListener('hashchange', handler)
	})

	const route = parseRoute(hash)

	const navigate = (path: string) => {
		window.location.hash = path
		setHash('#' + path)
	}

	return (
		<div className="min-h-screen bg-gray-950 text-gray-100">
			{/* Header */}
			<header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
				<div className="mx-auto max-w-4xl flex items-center justify-between px-4 py-3">
					<button
						onClick={() => navigate('')}
						className="flex items-center gap-2 hover:opacity-80 transition"
					>
						<FileText className="h-6 w-6 text-indigo-400" />
						<span className="text-lg font-bold">KoraForms</span>
					</button>
					<SyncBadge status={status} />
				</div>
			</header>

			{/* Content */}
			<main className="mx-auto max-w-4xl px-4 py-8">
				{route.page === 'list' && <FormList navigate={navigate} />}
				{route.page === 'builder' && (
					<FormBuilder formId={route.formId} navigate={navigate} />
				)}
				{route.page === 'fill' && <FormFill formId={route.formId} navigate={navigate} />}
				{route.page === 'responses' && (
					<FormResponses formId={route.formId} navigate={navigate} />
				)}
			</main>

			<footer className="py-8 text-center text-xs text-gray-700">
				KoraForms — works offline, syncs when connected. Powered by Kora.js
			</footer>
		</div>
	)
}

function SyncBadge({ status }: { status: { status: string; pendingOperations?: number } }) {
	const s = status.status
	const pending = status.pendingOperations ?? 0

	const config: Record<string, { icon: typeof Wifi; color: string; label: string }> = {
		connected: { icon: Wifi, color: 'text-emerald-400', label: 'Online' },
		syncing: { icon: Wifi, color: 'text-amber-400', label: 'Syncing' },
		synced: { icon: Wifi, color: 'text-emerald-400', label: 'Synced' },
		offline: { icon: WifiOff, color: 'text-gray-500', label: 'Offline' },
		error: { icon: AlertCircle, color: 'text-red-400', label: 'Error' },
	}

	const { icon: Icon, color, label } = config[s] ?? config.offline!

	return (
		<div className="flex items-center gap-2 rounded-full bg-gray-800 px-3 py-1.5 text-sm">
			<Icon className={`h-4 w-4 ${color}`} />
			<span className={color}>{label}</span>
			{pending > 0 && (
				<span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-400">
					{pending}
				</span>
			)}
		</div>
	)
}
