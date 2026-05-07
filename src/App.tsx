import { useState, useEffect } from 'react'
import { useSyncStatus } from '@korajs/react'
import {
	FileText,
	Wifi,
	WifiOff,
	AlertCircle,
	Cloud,
	CloudOff,
	Moon,
	Sun,
} from 'lucide-react'
import { FormList } from './pages/FormList'
import { FormBuilder } from './pages/FormBuilder'
import { FormFill } from './pages/FormFill'
import { FormResponses } from './pages/FormResponses'

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
	const [dark, setDark] = useState(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem('koraforms-theme') === 'dark' ||
				(!localStorage.getItem('koraforms-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
		}
		return false
	})
	const status = useSyncStatus()

	useEffect(() => {
		const handler = () => setHash(window.location.hash)
		window.addEventListener('hashchange', handler)
		return () => window.removeEventListener('hashchange', handler)
	}, [])

	useEffect(() => {
		document.documentElement.classList.toggle('dark', dark)
		localStorage.setItem('koraforms-theme', dark ? 'dark' : 'light')
	}, [dark])

	const route = parseRoute(hash)

	const navigate = (path: string) => {
		window.location.hash = path
		setHash('#' + path)
	}

	// Form fill page gets a clean, distraction-free layout
	if (route.page === 'fill') {
		return (
			<div className="min-h-screen bg-white dark:bg-surface-dark">
				<FormFill formId={route.formId} navigate={navigate} />
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-surface dark:bg-surface-dark transition-colors duration-200">
			{/* Header */}
			<header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl">
				<div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 h-14">
					<button
						onClick={() => navigate('')}
						className="flex items-center gap-2.5 hover:opacity-80 transition-smooth"
					>
						<div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
							<FileText className="h-4 w-4 text-white" />
						</div>
						<span className="text-lg font-semibold tracking-tight">KoraForms</span>
					</button>
					<div className="flex items-center gap-2">
						<SyncIndicator status={status} />
						<button
							onClick={() => setDark(!dark)}
							className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth"
							aria-label="Toggle theme"
						>
							{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
						</button>
					</div>
				</div>
			</header>

			{/* Content */}
			<main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
				<div className="animate-fade-in">
					{route.page === 'list' && <FormList navigate={navigate} />}
					{route.page === 'builder' && (
						<FormBuilder formId={route.formId} navigate={navigate} />
					)}
					{route.page === 'responses' && (
						<FormResponses formId={route.formId} navigate={navigate} />
					)}
				</div>
			</main>
		</div>
	)
}

function SyncIndicator({ status }: { status: { status: string; pendingOperations?: number } }) {
	const s = status.status
	const pending = status.pendingOperations ?? 0

	if (s === 'offline') {
		return (
			<div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2.5 py-1">
				<CloudOff className="h-3 w-3" />
				<span>Offline</span>
				{pending > 0 && (
					<span className="ml-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full px-1.5 text-[10px] font-medium">
						{pending}
					</span>
				)}
			</div>
		)
	}

	if (s === 'syncing') {
		return (
			<div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-50 dark:bg-amber-900/20 rounded-full px-2.5 py-1">
				<Cloud className="h-3 w-3 animate-pulse" />
				<span>Syncing</span>
			</div>
		)
	}

	if (s === 'error') {
		return (
			<div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-full px-2.5 py-1">
				<AlertCircle className="h-3 w-3" />
				<span>Error</span>
			</div>
		)
	}

	// connected / synced
	return (
		<div className="flex items-center gap-1.5 text-xs text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 rounded-full px-2.5 py-1">
			<Wifi className="h-3 w-3" />
			<span>Synced</span>
		</div>
	)
}
