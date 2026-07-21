import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useSyncStatus, useMutation, useQuery } from '@korajs/react'
import { app } from './kora'
import { AuthProvider, useAuthStatus } from '@korajs/auth/react'
import { useAuth } from '@korajs/auth/react'
import { authClient } from './auth'
import { setPageMeta } from './utils/meta'
import { generateSlug } from './utils/slug'
import { BrandLoader, InlineLoader } from './components/shared/BrandLoader'
import { ShareModal } from './components/shared/ShareModal'
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
	FileText,
	LayoutTemplate,
	BarChart3,
	Settings as SettingsIcon,
	Menu,
	X,
	ChevronDown,
	ChevronRight,
	ChevronsUpDown,
	Eye,
	Share2,
	Send,
} from 'lucide-react'
import { Landing } from './pages/Landing'
import { SignIn } from './pages/SignIn'
import { SignUp } from './pages/SignUp'

// Lazy-loaded heavy pages — code-split into separate chunks
const FormList = lazy(() => import('./pages/FormList').then(m => ({ default: m.FormList })))
const FormBuilder = lazy(() => import('./pages/FormBuilder').then(m => ({ default: m.FormBuilder })))
const FormResponses = lazy(() => import('./pages/FormResponses').then(m => ({ default: m.FormResponses })))
const Templates = lazy(() => import('./pages/Templates').then(m => ({ default: m.Templates })))
const TemplateDetail = lazy(() => import('./pages/TemplateDetail').then(m => ({ default: m.TemplateDetail })))
const HowItWorks = lazy(() => import('./pages/HowItWorks').then(m => ({ default: m.HowItWorks })))
const Help = lazy(() => import('./pages/Help').then(m => ({ default: m.Help })))
const Privacy = lazy(() => import('./pages/Privacy').then(m => ({ default: m.Privacy })))
const Terms = lazy(() => import('./pages/Terms').then(m => ({ default: m.Terms })))
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
	const location = useLocation()
	const [showUserMenu, setShowUserMenu] = useState(false)
	const [sidebarOpen, setSidebarOpen] = useState(false)

	const navItems = [
		{ label: 'Forms', icon: FileText, path: '/dashboard' },
		{ label: 'Templates', icon: LayoutTemplate, path: '/templates' },
		{ label: 'Responses', icon: BarChart3, path: '/dashboard' },
		{ label: 'Settings', icon: SettingsIcon, path: '/dashboard' },
	]

	const isActive = (path: string, label: string) => {
		// For Forms, match /dashboard and /forms/*
		if (label === 'Forms') return location.pathname === '/dashboard' || location.pathname.startsWith('/forms/')
		// Templates is only active on exact /templates within authenticated context (unlikely but future-proof)
		if (label === 'Templates') return location.pathname === '/templates'
		return false
	}

	const sidebarContent = (
		<div className="flex flex-col h-full">
			{/* Logo */}
			<div className="px-5 pt-6 pb-4">
				<button
					onClick={() => { navigate('dashboard'); setSidebarOpen(false) }}
					className="flex items-center gap-2.5 hover:opacity-80 transition-all duration-200"
				>
					<img src="/logo-icon.png" alt="KoraForms" className="w-8 h-8 rounded-lg" />
					<span className="text-[16px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">KoraForms</span>
				</button>
			</div>

			{/* Workspace selector */}
			<div className="px-3 mb-1">
				<button
					className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-all duration-150 group"
					title="Switch workspace (coming soon)"
				>
					<div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
						<span className="text-[11px] font-bold text-white">
							{(user?.name || 'U').charAt(0).toUpperCase()}
						</span>
					</div>
					<div className="flex-1 min-w-0 text-left">
						<p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
							My Workspace
						</p>
						<p className="text-[11px] text-gray-400 dark:text-gray-500 truncate leading-tight">
							Personal
						</p>
					</div>
					<ChevronsUpDown className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 shrink-0" />
				</button>
			</div>

			<div className="mx-5 my-2 border-t border-gray-100 dark:border-gray-800/50" />

			{/* Navigation */}
			<nav className="flex-1 px-3 space-y-0.5">
				{navItems.map(({ label, icon: Icon, path }) => {
					const active = isActive(path, label)
					return (
						<button
							key={label}
							onClick={() => { navigate(path === '/dashboard' ? 'dashboard' : path.slice(1)); setSidebarOpen(false) }}
							className={`
								w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-all duration-150
								${active
									? 'bg-brand-50 dark:bg-brand-900/25 text-brand-700 dark:text-brand-400'
									: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200'
								}
							`}
						>
							<Icon className={`h-[18px] w-[18px] ${active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'}`} />
							{label}
						</button>
					)
				})}
			</nav>

			{/* Bottom section: user menu, dark mode, sync */}
			<div className="mt-auto border-t border-gray-100 dark:border-gray-800/50 px-3 pt-3 pb-4 space-y-1">
				{/* Dark mode toggle */}
				<button
					onClick={() => setDark(!dark)}
					className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-700 dark:hover:text-gray-200 transition-all duration-150"
					aria-label="Toggle theme"
				>
					{dark ? <Sun className="h-4 w-4 text-gray-400 dark:text-gray-500" /> : <Moon className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
					{dark ? 'Light mode' : 'Dark mode'}
				</button>

				{/* User menu */}
				<div className="relative">
					<button
						onClick={() => setShowUserMenu(!showUserMenu)}
						className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-700 dark:hover:text-gray-200 transition-all duration-150"
					>
						<div className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
							<User className="h-2.5 w-2.5 text-brand-600 dark:text-brand-400" />
						</div>
						<span className="truncate flex-1 text-left">{user?.name || 'User'}</span>
						<ChevronDown className="h-3 w-3 text-gray-300 dark:text-gray-600 shrink-0" />
					</button>
					{showUserMenu && (
						<>
							<div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
							<div className="absolute left-2 bottom-12 w-52 rounded-xl bg-white dark:bg-gray-800 shadow-lg shadow-gray-200/50 dark:shadow-black/40 border border-gray-100 dark:border-gray-700/50 py-1 z-50 animate-scale-in">
								<div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-700/50">
									<p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
										{user?.name || 'User'}
									</p>
									<p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
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

				<div className="mx-1 my-1 border-t border-gray-100 dark:border-gray-800/50" />

				{/* Sync status */}
				<SidebarSyncIndicator status={status} />
			</div>
		</div>
	)

	return (
		<div className="min-h-screen bg-gray-50/50 dark:bg-surface-dark transition-colors duration-200">
			{/* Mobile top bar */}
			<header className="sticky top-0 z-40 md:hidden bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800/60">
				<div className="flex items-center justify-between px-4 h-12">
					<button
						onClick={() => setSidebarOpen(true)}
						className="p-1.5 -ml-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150"
						aria-label="Open menu"
					>
						<Menu className="h-5 w-5" />
					</button>
					<button
						onClick={() => navigate('dashboard')}
						className="flex items-center gap-2 hover:opacity-80 transition-all duration-200"
					>
						<img src="/logo-icon.png" alt="KoraForms" className="w-6 h-6 rounded-md" />
						<span className="text-[14px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">KoraForms</span>
					</button>
					<div className="w-8" />
				</div>
			</header>

			{/* Mobile sidebar overlay */}
			{sidebarOpen && (
				<div className="fixed inset-0 z-50 md:hidden">
					<div
						className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm"
						onClick={() => setSidebarOpen(false)}
					/>
					<aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-white dark:bg-gray-900 shadow-2xl animate-slide-in-left">
						<button
							onClick={() => setSidebarOpen(false)}
							className="absolute top-4 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150"
							aria-label="Close menu"
						>
							<X className="h-5 w-5" />
						</button>
						{sidebarContent}
					</aside>
				</div>
			)}

			{/* Desktop sidebar */}
			<aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-[240px] bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800/60 z-30">
				{sidebarContent}
			</aside>

			{/* Main content area */}
			<main className="md:ml-[240px]">
				<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
					<div className="animate-fade-in">
						<AuthenticatedRoutes />
					</div>
				</div>
			</main>
		</div>
	)
}

function AuthenticatedRoutes() {
	const navigate = useAppNavigate()
	const { user } = useAuth()

	return (
		<Suspense fallback={<InlineLoader message="Loading..." />}>
			<Routes>
				<Route path="/dashboard" element={<FormList navigate={navigate} userId={user?.id || ''} />} />
				<Route path="/forms/new/edit" element={<FormBuilderPage navigate={navigate} userId={user?.id || ''} />} />
				<Route path="/forms/:formId" element={<FormPageShell navigate={navigate} userId={user?.id || ''} />}>
					<Route path="edit" element={<FormBuilderInner />} />
					<Route path="responses" element={<FormResponsesInner />} />
					<Route index element={<Navigate to="edit" replace />} />
				</Route>
			</Routes>
		</Suspense>
	)
}

// ---------------------------------------------------------------------------
// FormPageShell — shared layout for all form-level pages (Builder, Responses)
// ---------------------------------------------------------------------------

type FormShellTab = 'build' | 'responses' | 'url' | 'share' | 'settings'

function FormPageShell({ navigate, userId }: { navigate: (path: string) => void; userId: string }) {
	const { formId } = useParams()
	const location = useLocation()
	const routerNav = useNavigate()
	const syncStatus = useSyncStatus()
	const [activePanel, setActivePanel] = useState<'url' | 'share' | 'settings' | null>(null)
	const [showShareModal, setShowShareModal] = useState(false)

	// Load form data
	const allForms = useQuery(app.forms.where({}).orderBy('createdAt', 'desc'))
	const form = allForms.find((f) => f.id === formId)

	const { mutate: updateForm } = useMutation(
		(id: string, data: Record<string, unknown>) => app.forms.update(id, data),
	)

	const isPublished = form ? String(form.status) === 'published' : false
	const formTitle = form ? String(form.title || 'Untitled Form') : 'Loading...'

	// Determine active tab from URL
	const activeTab: FormShellTab = activePanel
		? activePanel
		: location.pathname.endsWith('/responses')
			? 'responses'
			: 'build'

	const handleTabClick = (tab: FormShellTab) => {
		if (tab === 'build') {
			setActivePanel(null)
			routerNav(`/forms/${formId}/edit`)
		} else if (tab === 'responses') {
			setActivePanel(null)
			routerNav(`/forms/${formId}/responses`)
		} else {
			setActivePanel(tab)
		}
	}

	// Publish handler
	const handlePublish = () => {
		if (!formId || !form) return
		const title = String(form.title || 'Untitled Form')
		const existingSlug = String(form.slug || '')
		const slug = existingSlug || generateSlug(title)
		updateForm(formId, {
			status: 'published',
			slug,
		})
		if (!existingSlug) {
			setShowShareModal(true)
		}
	}

	// Sync status text for the breadcrumb bar
	const syncText = (() => {
		const s = syncStatus.status
		if (s === 'syncing') return 'Syncing...'
		if (s === 'offline') return 'All changes saved locally'
		if (s === 'error' || s === 'schema-mismatch') return 'Sync error'
		return 'Synced just now'
	})()
	const syncDotColor = (() => {
		const s = syncStatus.status
		if (s === 'syncing') return 'bg-amber-400'
		if (s === 'offline') return 'bg-gray-400'
		if (s === 'error' || s === 'schema-mismatch') return 'bg-red-400'
		return 'bg-emerald-400'
	})()

	const tabs: { key: FormShellTab; label: string }[] = [
		{ key: 'build', label: 'Build' },
		{ key: 'responses', label: 'Responses' },
		{ key: 'url', label: 'URL' },
		{ key: 'share', label: 'Share' },
		{ key: 'settings', label: 'Settings' },
	]

	if (!formId) return null

	return (
		<div className="animate-fade-in">
			{/* Breadcrumb bar */}
			<div className="flex items-center justify-between mb-1">
				<div className="flex items-center gap-1.5 text-sm">
					<button
						onClick={() => navigate('dashboard')}
						className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors duration-150"
					>
						Forms
					</button>
					<ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
					<span className="text-gray-500 dark:text-gray-400 truncate max-w-[200px] sm:max-w-[300px]">
						{formTitle}
					</span>
				</div>
				<div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
					<span className={`w-1.5 h-1.5 rounded-full ${syncDotColor} shrink-0`} />
					<span className="hidden sm:inline">{syncText}</span>
				</div>
			</div>

			{/* Title row */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
				<div className="flex items-center gap-3 min-w-0">
					<h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
						{formTitle}
					</h1>
					{form && (
						<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
							isPublished
								? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
								: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
						}`}>
							{isPublished ? 'Published' : 'Draft'}
						</span>
					)}
				</div>
				<div className="flex items-center gap-2 shrink-0">
					{isPublished && (
						<button
							onClick={() => setShowShareModal(true)}
							className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-all duration-150 hover:bg-gray-50 dark:hover:bg-gray-700"
						>
							<Share2 className="h-3.5 w-3.5" />
							<span className="hidden sm:inline">Share</span>
						</button>
					)}
					<button
						onClick={() => routerNav(`/f/${String(form?.slug || formId)}`)}
						className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-all duration-150 hover:bg-gray-50 dark:hover:bg-gray-700"
					>
						<Eye className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Preview</span>
					</button>
					<button
						onClick={handlePublish}
						className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/25 transition-all duration-150 hover:bg-brand-500 active:scale-[0.98]"
					>
						<Send className="h-3.5 w-3.5" />
						{isPublished ? 'Publish changes' : 'Publish'}
					</button>
				</div>
			</div>

			{/* Tab navigation bar */}
			<div className="border-b border-gray-200 dark:border-gray-800 mb-6">
				<nav className="flex gap-0 -mb-px">
					{tabs.map((tab) => {
						const isActive = activeTab === tab.key
						return (
							<button
								key={tab.key}
								onClick={() => handleTabClick(tab.key)}
								className={`
									px-4 py-2.5 text-sm font-medium transition-all duration-150 border-b-2 whitespace-nowrap
									${isActive
										? 'border-brand-600 dark:border-brand-400 text-gray-900 dark:text-gray-100 font-semibold'
										: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
									}
								`}
							>
								{tab.label}
							</button>
						)
					})}
				</nav>
			</div>

			{/* Panel content for URL / Share / Settings tabs */}
			{activePanel === 'url' && (
				<div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5">
					<p className="text-sm text-gray-500 dark:text-gray-400">URL settings panel coming soon.</p>
				</div>
			)}
			{activePanel === 'share' && (
				<div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5">
					<p className="text-sm text-gray-500 dark:text-gray-400">Share settings panel coming soon.</p>
				</div>
			)}
			{activePanel === 'settings' && (
				<div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5">
					<p className="text-sm text-gray-500 dark:text-gray-400">Form settings panel coming soon.</p>
				</div>
			)}

			{/* Render child route content (FormBuilder or FormResponses) */}
			{!activePanel && (
				<Suspense fallback={<InlineLoader message="Loading..." />}>
					<Outlet context={{ navigate, userId, formId }} />
				</Suspense>
			)}

			{/* Share modal */}
			{showShareModal && form && (
				<ShareModal
					slug={String(form.slug || formId)}
					title={String(form.title || 'Untitled Form')}
					onClose={() => setShowShareModal(false)}
				/>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------
// Thin inner wrappers for child routes under FormPageShell
// ---------------------------------------------------------------------------

function FormBuilderInner() {
	const { formId } = useParams()
	const navigate = useAppNavigate()
	const { user } = useAuth()
	return <FormBuilder formId={formId} navigate={navigate} userId={user?.id || ''} />
}

function FormResponsesInner() {
	const { formId } = useParams()
	const navigate = useAppNavigate()
	return <FormResponses formId={formId!} navigate={navigate} />
}

// ---------------------------------------------------------------------------
// New form creation page — NOT nested under FormPageShell
// ---------------------------------------------------------------------------

function FormBuilderPage({ navigate, userId }: { navigate: (path: string) => void; userId: string }) {
	const routerNav = useNavigate()
	const [searchParams] = useSearchParams()
	const { mutateAsync: createForm } = useMutation(
		(data: Record<string, unknown>) => app.forms.insert(data),
	)
	const creating = useRef(false)

	useEffect(() => {
		if (creating.current) return
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
	}, [searchParams, userId, createForm, routerNav])

	return (
		<div className="space-y-4 animate-fade-in">
			<div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
			<div className="h-24 bg-gray-100 dark:bg-gray-800/50 rounded-xl animate-pulse" />
			<div className="h-20 bg-gray-100 dark:bg-gray-800/50 rounded-xl animate-pulse" />
		</div>
	)
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

function PublicTemplatesPage() {
	const navigate = useAppNavigate()
	const { isAuthenticated, user } = useAuth()
	const { dark } = useDarkMode()
	return (
		<div className={dark ? 'dark' : ''}>
			<div className="min-h-screen bg-gray-50/50 dark:bg-surface-dark">
				<div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
					<Templates navigate={navigate} userId={isAuthenticated ? (user?.id || '') : undefined} isPublic />
				</div>
			</div>
		</div>
	)
}

function TemplateDetailPage() {
	const { templateKey } = useParams()
	const navigate = useAppNavigate()
	return <TemplateDetail templateKey={templateKey!} navigate={navigate} />
}

// ---------------------------------------------------------------------------
// Root app with auth provider and router
// ---------------------------------------------------------------------------

export function App() {
	return (
		<ErrorBoundary>
		<AuthProvider client={authClient} fallback={<BrandLoader />}>
			<Suspense fallback={<InlineLoader message="Loading..." />}>
				<Routes>
					{/* Public routes */}
					<Route path="/" element={<LandingPage />} />
					<Route path="/signin" element={<SignInPage />} />
					<Route path="/signup" element={<SignUpPage />} />
					<Route path="/how-it-works" element={<HowItWorksPage />} />
					<Route path="/help" element={<HelpPage />} />
					<Route path="/privacy" element={<PrivacyPage />} />
					<Route path="/terms" element={<TermsPage />} />
					<Route path="/templates/:templateKey" element={<TemplateDetailPage />} />
					<Route path="/templates" element={<PublicTemplatesPage />} />

					{/* Authenticated routes */}
					<Route path="/*" element={
						<RequireAuth>
							<AuthenticatedLayout />
						</RequireAuth>
					} />
				</Routes>
			</Suspense>
		</AuthProvider>
		</ErrorBoundary>
	)
}

// ---------------------------------------------------------------------------
// Sidebar sync indicator — styled for sidebar placement
// ---------------------------------------------------------------------------

function SidebarSyncIndicator({ status }: { status: ReturnType<typeof useSyncStatus> }) {
	const s = status.status
	const pending = status.pendingOperations

	let icon: React.ReactNode
	let title: string
	let subtitle: string
	let dotColor: string

	if (s === 'offline') {
		icon = <CloudOff className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
		title = 'Saved locally'
		subtitle = pending > 0 ? `${pending} change${pending > 1 ? 's' : ''} pending` : 'No connection'
		dotColor = 'bg-gray-400'
	} else if (s === 'syncing') {
		icon = <Cloud className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
		title = 'Syncing...'
		subtitle = 'Saving changes'
		dotColor = 'bg-amber-400'
	} else if (s === 'error' || s === 'schema-mismatch') {
		icon = <AlertCircle className="h-3.5 w-3.5 text-red-500" />
		title = s === 'schema-mismatch' ? 'Update needed' : 'Sync error'
		subtitle = 'Check connection'
		dotColor = 'bg-red-400'
	} else {
		icon = <Wifi className="h-3.5 w-3.5 text-emerald-500" />
		title = 'Saved locally'
		subtitle = 'Synced just now'
		dotColor = 'bg-emerald-400'
	}

	return (
		<div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50/80 dark:bg-gray-800/40">
			<div className="flex items-center justify-center flex-shrink-0">
				{icon}
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-[12px] font-medium text-gray-700 dark:text-gray-300 leading-tight">{title}</p>
				<p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{subtitle}</p>
			</div>
			<div className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0`} />
		</div>
	)
}

// ---------------------------------------------------------------------------
// Sync indicator (header variant — kept for potential reuse)
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
