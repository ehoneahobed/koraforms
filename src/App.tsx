import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
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
	ChevronsUpDown,
	Eye,
	Share2,
	Send,
	Copy,
	ExternalLink,
	Link as LinkIcon,
	Code,
	Globe,
	Ban,
	Lock,
	Calendar,
	Check,
	QrCode,
	Download,
} from 'lucide-react'
import QRCode from 'qrcode'
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
import { copyToClipboard } from './utils/clipboard'
import { THEME_PRESETS } from './themes'
import type { FormSettings as FormSettingsType } from './types'

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
			<div className="px-8 pt-8 pb-6">
				<button
					onClick={() => { navigate('dashboard'); setSidebarOpen(false) }}
					className="flex items-center gap-2.5 hover:opacity-80 transition-all duration-200"
				>
					<img src="/logo-icon.png" alt="KoraForms" className="w-9 h-9 rounded-xl" />
					<span className="text-[19px] font-bold tracking-tight text-slate-950 dark:text-white">Kora<span className="text-brand-600">forms</span></span>
				</button>
			</div>

			{/* Workspace selector */}
			<div className="px-6 mb-6">
				<button
					className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 transition-all duration-150 group shadow-sm"
					title="Switch workspace (coming soon)"
				>
					<div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shrink-0 shadow-sm shadow-brand-600/20">
						<span className="text-[11px] font-bold text-white">
							{(user?.name || 'U').charAt(0).toUpperCase()}
						</span>
					</div>
					<div className="flex-1 min-w-0 text-left">
						<p className="text-[13px] font-semibold text-slate-950 dark:text-gray-100 truncate leading-tight">
							My Workspace
						</p>
						<p className="text-[11px] text-gray-400 dark:text-gray-500 truncate leading-tight">
							Personal
						</p>
					</div>
					<ChevronsUpDown className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 shrink-0" />
				</button>
			</div>

			{/* Navigation */}
			<nav className="flex-1 px-4 space-y-2">
				{navItems.map(({ label, icon: Icon, path }) => {
					const active = isActive(path, label)
					return (
						<button
							key={label}
							onClick={() => { navigate(path === '/dashboard' ? 'dashboard' : path.slice(1)); setSidebarOpen(false) }}
							className={`
								w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[15px] font-medium transition-all duration-150
								${active
									? 'bg-brand-50 dark:bg-brand-900/25 text-brand-700 dark:text-brand-400'
									: 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/60 hover:text-slate-950 dark:hover:text-gray-200'
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
			<div className="mt-auto px-6 pt-3 pb-7 space-y-2">
				{/* Dark mode toggle */}
				<button
					onClick={() => setDark(!dark)}
					className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/60 hover:text-slate-700 dark:hover:text-gray-200 transition-all duration-150"
					aria-label="Toggle theme"
				>
					{dark ? <Sun className="h-4 w-4 text-gray-400 dark:text-gray-500" /> : <Moon className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
					{dark ? 'Light mode' : 'Dark mode'}
				</button>

				{/* User menu */}
				<div className="relative">
					<button
						onClick={() => setShowUserMenu(!showUserMenu)}
						className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/60 hover:text-slate-700 dark:hover:text-gray-200 transition-all duration-150"
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

				<div className="mx-1 my-2 border-t border-slate-200/70 dark:border-gray-800/50" />

				{/* Sync status */}
				<SidebarSyncIndicator status={status} />
			</div>
		</div>
	)

	return (
		<div className="min-h-screen overflow-x-hidden bg-surface dark:bg-surface-dark transition-colors duration-200">
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
			<aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-[264px] bg-white/92 dark:bg-gray-950 border-r border-slate-200 dark:border-gray-800/60 z-30">
				{sidebarContent}
			</aside>

			{/* Main content area */}
			<main className="min-w-0 overflow-x-hidden md:ml-[264px]">
				<div className="mx-auto w-full max-w-[1440px] box-border px-4 sm:px-8 lg:px-10 py-8 sm:py-10">
					<div className="min-w-0 animate-fade-in">
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
	const [publishFeedback, setPublishFeedback] = useState<'idle' | 'saving' | 'saved'>('idle')

	// Load form data
	const allForms = useQuery(app.forms.where({}).orderBy('createdAt', 'desc'))
	const form = allForms.find((f) => f.id === formId)

	const { mutate: updateForm } = useMutation(
		(id: string, data: Record<string, unknown>) => app.forms.update(id, data),
	)

	const isPublished = form ? String(form.status) === 'published' : false
	const formTitle = form ? String(form.title || 'Untitled Form') : 'Loading...'
	const slug = form ? String(form.slug || '') : ''
	const formTheme = form ? String(form.theme || 'red') : 'red'
	const formSettings = useMemo<FormSettingsType>(() => {
		if (!form) return {}
		try {
			return JSON.parse(String(form.settings || '{}')) as FormSettingsType
		} catch {
			return {}
		}
	}, [form])
	const formUrl = getPublicFormUrl(slug || formId || '')

	const updateSettings = (next: FormSettingsType) => {
		if (!formId) return
		updateForm(formId, { settings: JSON.stringify(next) })
	}

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
		setPublishFeedback('saving')
		const title = String(form.title || 'Untitled Form')
		const existingSlug = String(form.slug || '')
		const slug = existingSlug || generateSlug(title)
		updateForm(formId, {
			status: 'published',
			slug,
		})
		window.setTimeout(() => {
			setPublishFeedback('saved')
			window.setTimeout(() => setPublishFeedback('idle'), 1800)
		}, 300)
		if (!existingSlug) {
			setShowShareModal(true)
		}
	}

	const handleSlugChange = (nextSlug: string) => {
		if (!formId) return
		const sanitized = sanitizeSlug(nextSlug)
		if (!sanitized) return
		updateForm(formId, { slug: sanitized })
	}

	const handleStatusChange = (status: string) => {
		if (!formId || !form) return
		const next: Record<string, unknown> = { status }
		if (status === 'published' && !slug) {
			next.slug = generateSlug(formTitle)
		}
		updateForm(formId, next)
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
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-1.5 text-sm">
					<button
						onClick={() => navigate('dashboard')}
						className="text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 font-medium transition-colors duration-150"
					>
						Forms
					</button>
					<span className="text-slate-300 dark:text-slate-700">/</span>
					<span className="text-gray-500 dark:text-gray-400 truncate max-w-[200px] sm:max-w-[300px]">
						{formTitle}
					</span>
				</div>
				<div className="hidden lg:flex items-center gap-2 text-[13px] text-slate-500 dark:text-gray-500">
					<span className={`w-1.5 h-1.5 rounded-full ${syncDotColor} shrink-0`} />
					<span>{syncText}</span>
				</div>
			</div>

			{/* Title row */}
			<div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5 mb-6">
				<div className="flex items-center gap-3 min-w-0">
					<h1 className="text-3xl font-bold text-slate-950 dark:text-gray-100 tracking-[-0.01em] truncate">
						{formTitle}
					</h1>
					{form && (
						<span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium shrink-0 ${
							isPublished
								? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
								: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
						}`}>
							{isPublished ? 'Published' : 'Draft'}
						</span>
					)}
				</div>
				<div className="flex items-center gap-3 shrink-0">
					{isPublished && (
						<button
							onClick={() => setShowShareModal(true)}
							className="inline-flex items-center gap-2 kf-control px-5 py-3 text-[15px] font-semibold"
						>
							<Share2 className="h-4 w-4" />
							<span className="hidden sm:inline">Share</span>
						</button>
					)}
					<button
						onClick={() => routerNav(`/f/${String(form?.slug || formId)}`)}
						className="inline-flex items-center gap-2 kf-control px-5 py-3 text-[15px] font-semibold"
					>
						<Eye className="h-4 w-4" />
						<span className="hidden sm:inline">Preview</span>
					</button>
					<button
						onClick={handlePublish}
						disabled={publishFeedback === 'saving'}
						className="inline-flex min-w-[168px] items-center justify-center gap-2 kf-primary px-6 py-3 text-[15px] font-semibold disabled:cursor-wait disabled:opacity-85"
					>
						{publishFeedback === 'saved' ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
						{publishFeedback === 'saving' ? 'Publishing...' : publishFeedback === 'saved' ? 'Published' : isPublished ? 'Publish changes' : 'Publish'}
					</button>
				</div>
			</div>

			{/* Tab navigation bar */}
			<div className="border-b border-slate-200 dark:border-gray-800 mb-0">
				<nav className="flex gap-8 -mb-px">
					{tabs.map((tab) => {
						const isActive = activeTab === tab.key
						return (
							<button
								key={tab.key}
								onClick={() => handleTabClick(tab.key)}
								className={`
									px-1 py-3 text-[15px] font-medium transition-all duration-150 border-b-2 whitespace-nowrap
									${isActive
										? 'border-brand-600 dark:border-brand-400 text-brand-600 dark:text-brand-400 font-semibold'
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
			{activePanel === 'url' && form && (
				<FormUrlPanel
					formId={formId}
					title={formTitle}
					status={String(form.status || 'draft')}
					slug={slug}
					formUrl={formUrl}
					onSlugChange={handleSlugChange}
					onPublish={handlePublish}
				/>
			)}
			{activePanel === 'share' && form && (
				<FormSharePanel
					title={formTitle}
					isPublished={isPublished}
					slug={slug || formId}
					formUrl={formUrl}
					resultsUrl={`${formUrl}/results`}
					publicResults={!!formSettings.publicResults}
					onPublish={handlePublish}
				/>
			)}
			{activePanel === 'settings' && form && (
				<FormSettingsPanel
					status={String(form.status || 'draft')}
					theme={formTheme}
					settings={formSettings}
					onStatusChange={handleStatusChange}
					onThemeChange={(theme) => updateForm(formId, { theme })}
					onSettingsChange={updateSettings}
				/>
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

function getPublicFormUrl(identifier: string) {
	const origin = typeof window === 'undefined' ? '' : window.location.origin
	return `${origin}/f/${identifier}`
}

function sanitizeSlug(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
}

function timestampToDatetimeLocal(ts: number | undefined): string {
	if (!ts) return ''
	const d = new Date(ts)
	const offset = d.getTimezoneOffset()
	const local = new Date(d.getTime() - offset * 60000)
	return local.toISOString().slice(0, 16)
}

function datetimeLocalToTimestamp(value: string): number | undefined {
	if (!value) return undefined
	return new Date(value).getTime()
}

function FormUrlPanel({
	formId,
	title,
	status,
	slug,
	formUrl,
	onSlugChange,
	onPublish,
}: {
	formId: string
	title: string
	status: string
	slug: string
	formUrl: string
	onSlugChange: (slug: string) => void
	onPublish: () => void
}) {
	const [draftSlug, setDraftSlug] = useState(slug || generateSlug(title))
	const [copied, setCopied] = useState(false)
	const isPublished = status === 'published'

	useEffect(() => {
		setDraftSlug(slug || generateSlug(title))
	}, [slug, title])

	const saveSlug = () => {
		const sanitized = sanitizeSlug(draftSlug || formId)
		setDraftSlug(sanitized)
		onSlugChange(sanitized)
	}

	const copyUrl = () => {
		copyToClipboard(formUrl)
		setCopied(true)
		setTimeout(() => setCopied(false), 1600)
	}

	return (
		<section className="py-8 animate-fade-in">
			<div className="mx-auto max-w-4xl space-y-6">
				<div>
					<h2 className="text-[22px] font-semibold tracking-tight text-slate-950 dark:text-gray-100">Public URL</h2>
					<p className="mt-1 text-[14px] text-slate-500 dark:text-gray-400">Choose the public address people use to open this form.</p>
				</div>

				<div className="kf-panel p-6">
					<div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0 flex-1">
							<div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-600 dark:text-gray-300">
								<LinkIcon className="h-4 w-4 text-slate-400" />
								Form link
							</div>
							<div className="flex min-w-0 items-center rounded-xl border border-slate-200 bg-slate-50 dark:border-gray-800 dark:bg-gray-900">
								<span className="hidden shrink-0 pl-4 pr-1 text-[13px] text-slate-400 sm:inline">
									{typeof window === 'undefined' ? '' : window.location.origin}/f/
								</span>
								<input
									value={draftSlug}
									onChange={(event) => setDraftSlug(event.target.value)}
									onBlur={saveSlug}
									className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-300 dark:text-gray-100 sm:px-1"
									placeholder="form-url"
								/>
							</div>
							<p className="mt-2 truncate text-[12px] text-slate-400 dark:text-gray-500">{formUrl}</p>
						</div>
						<div className="flex shrink-0 flex-wrap gap-2">
							<button onClick={copyUrl} className="inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
								{copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
								{copied ? 'Copied' : 'Copy'}
							</button>
							<a href={formUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
								<ExternalLink className="h-4 w-4" />
								Open
							</a>
						</div>
					</div>
				</div>

				{!isPublished && (
					<div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
						This form is still a draft. Publish it when you are ready for people to use this URL.
						<button onClick={onPublish} className="ml-3 font-semibold underline decoration-amber-400 underline-offset-4">
							Publish now
						</button>
					</div>
				)}
			</div>
		</section>
	)
}

function FormSharePanel({
	title,
	isPublished,
	slug,
	formUrl,
	resultsUrl,
	publicResults,
	onPublish,
}: {
	title: string
	isPublished: boolean
	slug: string
	formUrl: string
	resultsUrl: string
	publicResults: boolean
	onPublish: () => void
}) {
	const [copied, setCopied] = useState<'link' | 'embed' | 'results' | null>(null)
	const [embedMode, setEmbedMode] = useState<'inline' | 'popup' | 'slidein'>('inline')
	const [qrDataUrl, setQrDataUrl] = useState('')
	const baseUrl = typeof window === 'undefined' ? '' : window.location.origin

	useEffect(() => {
		QRCode.toDataURL(formUrl, {
			width: 480,
			margin: 2,
			color: { dark: '#111827', light: '#ffffff' },
			errorCorrectionLevel: 'M',
		}).then(setQrDataUrl).catch(console.error)
	}, [formUrl])

	const getEmbedCode = (mode: 'inline' | 'popup' | 'slidein') => {
		if (mode === 'inline') {
			return `<iframe src="${formUrl}?embed=1" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;"></iframe>`
		}
		if (mode === 'popup') {
			return `<script src="${baseUrl}/embed.js"></script>\n<button onclick="KoraForms.popup('${slug}')">Open Form</button>`
		}
		return `<script src="${baseUrl}/embed.js"></script>\n<script>KoraForms.slideIn('${slug}', { position: 'right' })</script>`
	}

	const embedCode = getEmbedCode(embedMode)
	const copy = (value: string, key: 'link' | 'embed' | 'results') => {
		copyToClipboard(value)
		setCopied(key)
		setTimeout(() => setCopied(null), 1600)
	}
	const downloadQR = () => {
		if (!qrDataUrl) return
		const a = document.createElement('a')
		a.href = qrDataUrl
		a.download = `${slug}-qr-code.png`
		a.click()
	}

	return (
		<section className="py-8 animate-fade-in">
			<div className="mx-auto max-w-6xl space-y-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-[22px] font-semibold tracking-tight text-slate-950 dark:text-gray-100">Share</h2>
						<p className="mt-1 text-[14px] text-slate-500 dark:text-gray-400">Share {title} by link, social post, embed, QR code, or results link.</p>
					</div>
					{!isPublished && (
						<button onClick={onPublish} className="inline-flex items-center justify-center gap-2 kf-primary px-5 py-3 text-[14px] font-semibold">
							<Send className="h-4 w-4" />
							Publish to share
						</button>
					)}
				</div>

				<div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
					<div className="kf-panel p-6">
						<div className="flex h-full flex-col justify-between gap-6">
							<div>
								<div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/25 dark:text-brand-300">
									<Globe className="h-5 w-5" />
								</div>
								<h3 className="text-[17px] font-semibold text-slate-950 dark:text-gray-100">Public form link</h3>
								<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Use this link in email, chat, or your website.</p>
							</div>
							<div className="space-y-3">
								<div className="truncate rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-500 dark:bg-gray-900 dark:text-gray-400">{formUrl}</div>
								<div className="flex flex-wrap gap-2">
									<button onClick={() => copy(formUrl, 'link')} className="inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
										{copied === 'link' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
										{copied === 'link' ? 'Copied' : 'Copy link'}
									</button>
									<a href={formUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
										<ExternalLink className="h-4 w-4" />
										Open
									</a>
								</div>
								<div className="mt-4">
									<p className="mb-2 text-[12px] font-semibold text-slate-500 dark:text-gray-400">Share on social</p>
									<div className="grid grid-cols-3 gap-2">
										<a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out "${title}" on KoraForms`)}&url=${encodeURIComponent(formUrl)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-center text-[12px] font-medium text-slate-600 hover:bg-slate-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">X</a>
										<a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(formUrl)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-center text-[12px] font-medium text-slate-600 hover:bg-slate-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">LinkedIn</a>
										<a href={`https://wa.me/?text=${encodeURIComponent(`${title}: ${formUrl}`)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-center text-[12px] font-medium text-slate-600 hover:bg-slate-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">WhatsApp</a>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="kf-panel p-6">
						<div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300">
							<Code className="h-5 w-5" />
						</div>
						<h3 className="text-[17px] font-semibold text-slate-950 dark:text-gray-100">Embed</h3>
						<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Place the form inline, open it as a popup, or slide it into the page.</p>
						<div className="mt-4 flex rounded-xl bg-slate-100 p-1 dark:bg-gray-800">
							{[
								{ value: 'inline' as const, label: 'Inline' },
								{ value: 'popup' as const, label: 'Popup' },
								{ value: 'slidein' as const, label: 'Slide-in' },
							].map(option => (
								<button
									key={option.value}
									onClick={() => setEmbedMode(option.value)}
									className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
										embedMode === option.value
											? 'bg-white text-slate-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
											: 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
									}`}
								>
									{option.label}
								</button>
							))}
						</div>
						<textarea
							readOnly
							value={embedCode}
							rows={4}
							className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[12px] text-slate-600 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
						/>
						<button onClick={() => copy(embedCode, 'embed')} className="mt-3 inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
							{copied === 'embed' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
							{copied === 'embed' ? 'Copied' : 'Copy embed'}
						</button>
						<p className="mt-2 text-[11px] text-slate-400 dark:text-gray-500">
							{embedMode === 'inline' && 'Paste this where the form should appear.'}
							{embedMode === 'popup' && 'Adds a button that opens the form in a centered popup.'}
							{embedMode === 'slidein' && 'Slides the form in from the right side of the page.'}
						</p>
					</div>
				</div>

				<div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
					<div className="kf-panel p-6">
						<div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300">
							<QrCode className="h-5 w-5" />
						</div>
						<h3 className="text-[17px] font-semibold text-slate-950 dark:text-gray-100">QR code</h3>
						<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Print it, place it on slides, or share it where scanning is easier than typing.</p>
						<div className="mt-5 flex flex-col items-center gap-4">
							{qrDataUrl ? (
								<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-800">
									<img src={qrDataUrl} alt={`QR code for ${title}`} className="h-44 w-44" />
								</div>
							) : (
								<div className="h-44 w-44 rounded-2xl bg-slate-100 animate-pulse dark:bg-gray-800" />
							)}
							<div className="flex flex-wrap justify-center gap-2">
								<button onClick={downloadQR} className="inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
									<Download className="h-4 w-4" />
									Download PNG
								</button>
								<button onClick={() => copy(formUrl, 'link')} className="inline-flex items-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold">
									{copied === 'link' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
									{copied === 'link' ? 'Copied' : 'Copy link'}
								</button>
							</div>
						</div>
					</div>

					<div className="kf-panel p-5">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">Public results</h3>
							<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">
								{publicResults ? 'Results are available to anyone with the results link.' : 'Enable public results from Settings when you want viewers to see responses.'}
							</p>
						</div>
						<button
							onClick={() => copy(resultsUrl, 'results')}
							disabled={!publicResults}
							className="inline-flex items-center justify-center gap-2 kf-control px-4 py-2.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
						>
							{copied === 'results' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
							{copied === 'results' ? 'Copied' : 'Copy results link'}
						</button>
					</div>
					</div>
				</div>
			</div>
		</section>
	)
}

function FormSettingsPanel({
	status,
	theme,
	settings,
	onStatusChange,
	onThemeChange,
	onSettingsChange,
}: {
	status: string
	theme: string
	settings: FormSettingsType
	onStatusChange: (status: string) => void
	onThemeChange: (theme: string) => void
	onSettingsChange: (settings: FormSettingsType) => void
}) {
	const updateSetting = <K extends keyof FormSettingsType>(key: K, value: FormSettingsType[K]) => {
		onSettingsChange({ ...settings, [key]: value })
	}

	return (
		<section className="py-8 animate-fade-in">
			<div className="mx-auto max-w-5xl space-y-6">
				<div>
					<h2 className="text-[22px] font-semibold tracking-tight text-slate-950 dark:text-gray-100">Settings</h2>
					<p className="mt-1 text-[14px] text-slate-500 dark:text-gray-400">Control form behavior, access, and presentation.</p>
				</div>

				<div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
					<div className="kf-panel p-6">
						<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">Availability</h3>
						<div className="mt-4 grid grid-cols-3 gap-2">
							{[
								{ value: 'draft', label: 'Draft', icon: Ban },
								{ value: 'published', label: 'Live', icon: Globe },
								{ value: 'closed', label: 'Closed', icon: Lock },
							].map(({ value, label, icon: Icon }) => (
								<button
									key={value}
									onClick={() => onStatusChange(value)}
									className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors ${
										status === value
											? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-900/25 dark:text-brand-300'
											: 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'
									}`}
								>
									<Icon className="h-4 w-4" />
									{label}
								</button>
							))}
						</div>

						<div className="mt-5 grid gap-3 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-gray-400">
									<Calendar className="h-3.5 w-3.5" />
									Opens
								</span>
								<input
									type="datetime-local"
									value={timestampToDatetimeLocal(settings.opensAt)}
									onChange={(event) => updateSetting('opensAt', datetimeLocalToTimestamp(event.target.value))}
									className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
								/>
							</label>
							<label className="block">
								<span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-gray-400">
									<Calendar className="h-3.5 w-3.5" />
									Closes
								</span>
								<input
									type="datetime-local"
									value={timestampToDatetimeLocal(settings.closesAt)}
									onChange={(event) => updateSetting('closesAt', datetimeLocalToTimestamp(event.target.value))}
									className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
								/>
							</label>
						</div>
					</div>

					<div className="kf-panel p-6">
						<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">Theme</h3>
						<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Applied as a restrained accent on the public form.</p>
						<div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
							{THEME_PRESETS.map((preset) => (
								<button
									key={preset.id}
									onClick={() => onThemeChange(preset.id)}
									className={`rounded-xl p-2 text-center transition-colors ${
										theme === preset.id ? 'bg-slate-100 dark:bg-gray-800' : 'hover:bg-slate-50 dark:hover:bg-gray-800/60'
									}`}
									title={preset.name}
								>
									<span
										className="mx-auto block h-8 w-8 rounded-full ring-1 ring-black/10"
										style={{
											backgroundColor: preset.preview,
											...(theme === preset.id ? { boxShadow: `0 0 0 3px ${preset.colors[100]}` } : {}),
										}}
									/>
									<span className="mt-1 block truncate text-[10px] text-slate-500 dark:text-gray-400">{preset.name}</span>
								</button>
							))}
						</div>
					</div>
				</div>

				<div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
					<div className="kf-panel p-6">
						<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">After Submit</h3>
						<label className="mt-4 block">
							<span className="mb-1.5 block text-[12px] font-medium text-slate-500 dark:text-gray-400">Thank-you message</span>
							<textarea
								value={settings.thankYouMessage || ''}
								onChange={(event) => updateSetting('thankYouMessage', event.target.value)}
								rows={3}
								placeholder="Thanks. Your response has been received."
								className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
							/>
						</label>
						<label className="mt-3 block">
							<span className="mb-1.5 block text-[12px] font-medium text-slate-500 dark:text-gray-400">Redirect URL</span>
							<input
								type="url"
								value={settings.redirectUrl || ''}
								onChange={(event) => updateSetting('redirectUrl', event.target.value)}
								placeholder="https://example.com/thank-you"
								className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
							/>
						</label>
					</div>

					<div className="kf-panel p-6">
						<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">Responses</h3>
						<div className="mt-4 space-y-4">
							<SettingsCheckbox
								label="Allow multiple submissions"
								checked={settings.allowMultiple !== false}
								onChange={(checked) => updateSetting('allowMultiple', checked)}
							/>
							<SettingsCheckbox
								label="Public results"
								checked={!!settings.publicResults}
								onChange={(checked) => updateSetting('publicResults', checked)}
							/>
							<SettingsCheckbox
								label="Show results after submit"
								checked={!!settings.showResultsAfterSubmit}
								disabled={!settings.publicResults}
								onChange={(checked) => updateSetting('showResultsAfterSubmit', checked)}
							/>
							<label className="block">
								<span className="mb-1.5 block text-[12px] font-medium text-slate-500 dark:text-gray-400">Response limit</span>
								<input
									type="number"
									min={0}
									value={settings.maxResponses || 0}
									onChange={(event) => updateSetting('maxResponses', Number(event.target.value) || undefined)}
									className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
								/>
							</label>
							<label className="block">
								<span className="mb-1.5 block text-[12px] font-medium text-slate-500 dark:text-gray-400">Password</span>
								<input
									type="password"
									value={settings.password || ''}
									onChange={(event) => updateSetting('password', event.target.value || undefined)}
									placeholder="Optional"
									className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
								/>
							</label>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

function SettingsCheckbox({
	label,
	checked,
	disabled,
	onChange,
}: {
	label: string
	checked: boolean
	disabled?: boolean
	onChange: (checked: boolean) => void
}) {
	return (
		<label className={`flex items-center justify-between gap-4 text-[13px] font-medium text-slate-600 dark:text-gray-300 ${disabled ? 'opacity-45' : ''}`}>
			<span>{label}</span>
			<input
				type="checkbox"
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked)}
				className="h-4 w-4 rounded border-slate-300 accent-brand-600"
			/>
		</label>
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
			theme: 'red',
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
