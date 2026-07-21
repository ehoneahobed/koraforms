import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useSyncStatus, useMutation } from '@korajs/react'
import { app } from './kora'
import { AuthProvider, useAuthStatus } from '@korajs/auth/react'
import { useAuth } from '@korajs/auth/react'
import { authClient } from './auth'
import { setPageMeta } from './utils/meta'
import { BrandLoader } from './components/shared/BrandLoader'
import {
	Wifi,
	WifiOff,
	AlertCircle,
	Cloud,
	CloudOff,
	Moon,
	Sun,
	LogOut,
	User,
} from 'lucide-react'
import { Landing } from './pages/Landing'
import { FormList } from './pages/FormList'
import { FormBuilder } from './pages/FormBuilder'
import { FormResponses } from './pages/FormResponses'
import { SignIn } from './pages/SignIn'
import { SignUp } from './pages/SignUp'
import { Templates } from './pages/Templates'
import { HowItWorks } from './pages/HowItWorks'
import { Help } from './pages/Help'
import { Privacy } from './pages/Privacy'
import { Terms } from './pages/Terms'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { FORM_TEMPLATES } from './templates'

// ---------------------------------------------------------------------------
// Dark mode management
// ---------------------------------------------------------------------------

function useDarkMode() {
	const [dark, setDark] = useState(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem('koraforms-theme') === 'dark' ||
				(!localStorage.getItem('koraforms-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
		}
		return false
	})

	useEffect(() => {
		document.documentElement.classList.toggle('dark', dark)
		localStorage.setItem('koraforms-theme', dark ? 'dark' : 'light')
	}, [dark])

	return { dark, setDark }
}

// ---------------------------------------------------------------------------
// Navigation wrapper — adapts hash-style navigate calls to React Router
// ---------------------------------------------------------------------------

function useAppNavigate() {
	const nav = useNavigate()
	return (path: string) => {
		// Map old hash paths to new routes
		if (path === 'dashboard') return nav('/dashboard')
		if (path === 'templates') return nav('/templates')
		if (path === '' || path === '/') return nav('/')
		if (path === 'signin') return nav('/signin')
		if (path === 'signup') return nav('/signup')
		if (path.startsWith('build/')) return nav(`/forms/${path.slice(6)}/edit`)
		if (path.startsWith('build')) return nav('/forms/new/edit')
		if (path.startsWith('fill/')) return nav(`/f/${path.slice(5)}`)
		if (path.startsWith('responses/')) return nav(`/forms/${path.slice(10)}/responses`)
		nav(path)
	}
}

// ---------------------------------------------------------------------------
// Auth guard — redirects to signin if not authenticated
// ---------------------------------------------------------------------------

function RequireAuth({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, isLoading } = useAuthStatus()
	const location = useLocation()

	if (isLoading) {
		return <BrandLoader />
	}

	if (!isAuthenticated) {
		return <Navigate to="/signin" state={{ from: location }} replace />
	}

	return <>{children}</>
}

// ---------------------------------------------------------------------------
// Authenticated layout — header + content
// ---------------------------------------------------------------------------

function AuthenticatedLayout() {
	const { dark, setDark } = useDarkMode()
	const status = useSyncStatus()
	const { user, signOut } = useAuth()
	const navigate = useAppNavigate()
	const [showUserMenu, setShowUserMenu] = useState(false)

	return (
		<div className="min-h-screen bg-gray-50/50 dark:bg-surface-dark transition-colors duration-200">
			{/* Header */}
			<header className="sticky top-0 z-40 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800/60">
				<div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 h-12">
					<button
						onClick={() => navigate('dashboard')}
						className="flex items-center gap-2 hover:opacity-80 transition-all duration-200"
					>
						<img src="/logo-icon.png" alt="KoraForms" className="w-7 h-7 rounded-lg" />
						<span className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">KoraForms</span>
					</button>
					<div className="flex items-center gap-1">
						<SyncIndicator status={status} />
						<button
							onClick={() => setDark(!dark)}
							className="p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
							aria-label="Toggle theme"
						>
							{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
						</button>
						{/* User menu */}
						<div className="relative">
							<button
								onClick={() => setShowUserMenu(!showUserMenu)}
								className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
							>
								<div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
									<User className="h-3 w-3 text-brand-600 dark:text-brand-400" />
								</div>
							</button>
							{showUserMenu && (
								<>
									<div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
									<div className="absolute right-0 top-10 w-52 rounded-xl bg-white dark:bg-gray-800 shadow-lg shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700/50 py-1 z-50 animate-scale-in">
										<div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-700/50">
											<p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
												{user?.name || 'User'}
											</p>
											<p className="text-xs text-gray-400 truncate mt-0.5">
												{user?.email}
											</p>
										</div>
										<button
											onClick={async () => {
												setShowUserMenu(false)
												await signOut()
											}}
											className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-150"
										>
											<LogOut className="h-3.5 w-3.5" />
											Sign out
										</button>
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			</header>

			{/* Content */}
			<main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
				<div className="animate-fade-in">
					<AuthenticatedRoutes />
				</div>
			</main>
		</div>
	)
}

function AuthenticatedRoutes() {
	const navigate = useAppNavigate()
	const { user } = useAuth()

	return (
		<Routes>
			<Route path="/dashboard" element={<FormList navigate={navigate} userId={user?.id || ''} />} />
			<Route path="/templates" element={<Templates navigate={navigate} userId={user?.id || ''} />} />
			<Route path="/forms/:formId/edit" element={<FormBuilderPage navigate={navigate} userId={user?.id || ''} />} />
			<Route path="/forms/:formId/responses" element={<FormResponsesPage navigate={navigate} />} />
		</Routes>
	)
}

function FormBuilderPage({ navigate, userId }: { navigate: (path: string) => void; userId: string }) {
	const { formId } = useParams()
	const routerNav = useNavigate()
	const [searchParams] = useSearchParams()
	const { mutateAsync: createForm } = useMutation(
		(data: Record<string, unknown>) => app.forms.insert(data),
	)
	const creating = useRef(false)

	useEffect(() => {
		if (formId !== 'new' || creating.current) return
		creating.current = true

		const templateKey = searchParams.get('template')
		const template = templateKey ? FORM_TEMPLATES[templateKey] : null

		const data = {
			title: template?.title || 'Untitled Form',
			description: template?.description || '',
			fields: JSON.stringify(template?.fields || []),
			status: 'draft',
			ownerId: userId,
			theme: 'blue',
		}

		createForm(data).then((record) => {
			routerNav(`/forms/${record.id}/edit`, { replace: true })
		})
	}, [formId, searchParams, userId, createForm, routerNav])

	if (formId === 'new') {
		return (
			<div className="space-y-4 animate-fade-in">
				<div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
				<div className="h-24 bg-gray-100 dark:bg-gray-800/50 rounded-xl animate-pulse" />
				<div className="h-20 bg-gray-100 dark:bg-gray-800/50 rounded-xl animate-pulse" />
			</div>
		)
	}

	return <FormBuilder formId={formId} navigate={navigate} userId={userId} />
}

function FormResponsesPage({ navigate }: { navigate: (path: string) => void }) {
	const { formId } = useParams()
	return <FormResponses formId={formId!} navigate={navigate} />
}

// ---------------------------------------------------------------------------
// Public pages (no auth required)
// ---------------------------------------------------------------------------

function LandingPage() {
	const navigate = useAppNavigate()
	const { dark } = useDarkMode()

	useEffect(() => {
		setPageMeta({
			title: 'KoraForms — Build forms that work anywhere',
			description: 'Create beautiful forms and collect data even without internet. Responses save locally and sync automatically. Free.',
		})
	}, [])

	return (
		<div className={dark ? 'dark' : ''}>
			<Landing navigate={navigate} />
		</div>
	)
}

function SignInPage() {
	const navigate = useAppNavigate()
	const { isAuthenticated, isLoading } = useAuth()
	const location = useLocation()

	useEffect(() => {
		setPageMeta({ title: 'Sign In', description: 'Sign in to your KoraForms account.' })
	}, [])

	if (!isLoading && isAuthenticated) {
		const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'
		return <Navigate to={from} replace />
	}

	return <SignIn navigate={navigate} />
}

function SignUpPage() {
	const navigate = useAppNavigate()
	const { isAuthenticated, isLoading } = useAuth()

	useEffect(() => {
		setPageMeta({ title: 'Sign Up', description: 'Create a free KoraForms account. Build forms that work offline.' })
	}, [])

	if (!isLoading && isAuthenticated) {
		return <Navigate to="/dashboard" replace />
	}

	return <SignUp navigate={navigate} />
}

function HowItWorksPage() {
	const navigate = useAppNavigate()
	return <HowItWorks navigate={navigate} />
}

function HelpPage() {
	const navigate = useAppNavigate()
	return <Help navigate={navigate} />
}

function PrivacyPage() {
	const navigate = useAppNavigate()
	return <Privacy navigate={navigate} />
}

function TermsPage() {
	const navigate = useAppNavigate()
	return <Terms navigate={navigate} />
}

// ---------------------------------------------------------------------------
// Root app with auth provider and router
// ---------------------------------------------------------------------------

export function App() {
	return (
		<ErrorBoundary>
		<AuthProvider client={authClient} fallback={<BrandLoader />}>
				<Routes>
					{/* Public routes */}
					<Route path="/" element={<LandingPage />} />
					<Route path="/signin" element={<SignInPage />} />
					<Route path="/signup" element={<SignUpPage />} />
					<Route path="/how-it-works" element={<HowItWorksPage />} />
					<Route path="/help" element={<HelpPage />} />
					<Route path="/privacy" element={<PrivacyPage />} />
					<Route path="/terms" element={<TermsPage />} />

					{/* Authenticated routes */}
					<Route path="/*" element={
						<RequireAuth>
							<AuthenticatedLayout />
						</RequireAuth>
					} />
				</Routes>
		</AuthProvider>
		</ErrorBoundary>
	)
}

// ---------------------------------------------------------------------------
// Sync indicator
// ---------------------------------------------------------------------------

function SyncIndicator({ status }: { status: ReturnType<typeof useSyncStatus> }) {
	const s = status.status
	const pending = status.pendingOperations

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

	if (s === 'error' || s === 'schema-mismatch') {
		return (
			<div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-full px-2.5 py-1">
				<AlertCircle className="h-3 w-3" />
				<span>{s === 'schema-mismatch' ? 'Update needed' : 'Error'}</span>
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
