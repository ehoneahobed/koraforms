import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useSyncStatus, useMutation, useQuery } from '@korajs/react'
import { app } from './kora'
import { AuthProvider, useAuthStatus } from '@korajs/auth/react'
import { useAuth } from '@korajs/auth/react'
import { authClient } from './auth'
import { setPageMeta } from './utils/meta'
import { generateSlug } from './utils/slug'
import { FormSettingsPanel } from './components/forms/FormSettingsPanel'
import { FormSharePanel } from './components/forms/FormSharePanel'
import { FormUrlPanel } from './components/forms/FormUrlPanel'
import { CollaboratorsPanel } from './components/forms/CollaboratorsPanel'
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
	Menu,
	X,
	ChevronDown,
	ChevronLeft,
	ChevronsUpDown,
	Eye,
	Share2,
	Send,
	Check,
} from 'lucide-react'
import { Landing } from './pages/Landing'
import { SignIn } from './pages/SignIn'
import { SignUp } from './pages/SignUp'

// Lazy-loaded heavy pages — code-split into separate chunks
const FormList = lazy(() => import('./pages/FormList').then(m => ({ default: m.FormList })))
const FormBuilder = lazy(() => import('./pages/FormBuilder').then(m => ({ default: m.FormBuilder })))
const FormResponses = lazy(() => import('./pages/FormResponses').then(m => ({ default: m.FormResponses })))
const Templates = lazy(() => import('./pages/Templates').then(m => ({ default: m.Templates })))
const TemplateLibrary = lazy(() => import('./pages/TemplateLibrary').then(m => ({ default: m.TemplateLibrary })))
const TemplateDetail = lazy(() => import('./pages/TemplateDetail').then(m => ({ default: m.TemplateDetail })))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite').then(m => ({ default: m.AcceptInvite })))
const HowItWorks = lazy(() => import('./pages/HowItWorks').then(m => ({ default: m.HowItWorks })))
const Help = lazy(() => import('./pages/Help').then(m => ({ default: m.Help })))
const Privacy = lazy(() => import('./pages/Privacy').then(m => ({ default: m.Privacy })))
const Terms = lazy(() => import('./pages/Terms').then(m => ({ default: m.Terms })))
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { FORM_TEMPLATES, createFieldsFromTemplate } from './templates'
import { readStringFromStorage, writeStringToStorage } from './utils/storage'
import type { FormSettings as FormSettingsType, WebhookConfig } from './types'
import { parseFormFields, parseFormSettings, serializeFormSettings } from './domain/forms'
import { hasFormAccessPasswordSecret } from './domain/formPassword'
import {
	activeFormShellTab,
	buildPublishPayload,
	buildStatusPayload,
	formShellTabPath,
	getPublicFormUrl,
	parseFormShellPanel,
	sanitizeSlug,
	type FormShellTab,
} from './features/forms/shell'
import { buildPublishedFormVersionRecord, buildVersionRestorePayload, sortPublishedVersions } from './features/forms/versionHistory'
import type { PublicFormVersionRecord } from './features/form-fill/offlineModel'
import { recordAuditEvent } from './features/audit/events'
import { useFormCollaborators, useFormRole, useSharedFormIds } from './features/collaborators/hooks'
import { hasFormAccess } from './features/collaborators/access'
import type { CollaboratorRecord } from './features/collaborators/access'

// ---------------------------------------------------------------------------
// Dark mode management
// ---------------------------------------------------------------------------

function useDarkMode() {
	const [dark, setDark] = useState(() => {
		if (typeof window !== 'undefined') {
			const storedTheme = readStringFromStorage('koraforms-theme')
			return storedTheme === 'dark' ||
				(!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
		}
		return false
	})

	useEffect(() => {
		document.documentElement.classList.toggle('dark', dark)
		writeStringToStorage('koraforms-theme', dark ? 'dark' : 'light')
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
		{ label: 'Templates', icon: LayoutTemplate, path: '/dashboard/templates' },
	]

	const isActive = (path: string, label: string) => {
		// For Forms, match /dashboard and /forms/*
		if (label === 'Forms') return location.pathname === '/dashboard' || location.pathname.startsWith('/forms/')
		if (label === 'Templates') return location.pathname === '/dashboard/templates'
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
							onClick={() => { navigate(path); setSidebarOpen(false) }}
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
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-xl focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg dark:focus:bg-white dark:focus:text-slate-950"
			>
				Skip to content
			</a>
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
			<main id="main-content" tabIndex={-1} className="min-w-0 overflow-x-hidden outline-none md:ml-[264px]">
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
				<Route path="/dashboard/templates" element={<TemplateLibrary navigate={navigate} />} />
				<Route path="/dashboard/templates/:templateKey" element={<DashboardTemplateDetailPage />} />
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

function FormPageShell({ navigate, userId }: { navigate: (path: string) => void; userId: string }) {
	const { formId } = useParams()
	const location = useLocation()
	const routerNav = useNavigate()
	const [searchParams] = useSearchParams()
	const syncStatus = useSyncStatus()
	const { user } = useAuth()
	const [showShareModal, setShowShareModal] = useState(false)
	const [publishFeedback, setPublishFeedback] = useState<'idle' | 'saving' | 'saved'>('idle')

	// Load form data
	const allForms = useQuery(app.forms.where({}).orderBy('createdAt', 'desc'))
	const allAuditEvents = useQuery(app.audit_events.where({}).orderBy('createdAt', 'desc'))
	const allSideEffectDeliveries = useQuery(app.side_effect_deliveries.where({}).orderBy('updatedAt', 'desc'))
	const allPublicFormVersions = useQuery(app.public_form_versions.where({}).orderBy('publishedAt', 'desc'))
	const form = allForms.find((f) => f.id === formId)
	const auditEvents = allAuditEvents.filter(event => String(event.formId) === String(formId)).slice(0, 12)
	const sideEffectDeliveries = allSideEffectDeliveries.filter(delivery => String(delivery.formId) === String(formId)).slice(0, 24)
	const versionRecords = sortPublishedVersions(
		allPublicFormVersions.filter(version => String(version.formId) === String(formId)) as PublicFormVersionRecord[],
	)

	const { mutate: updateForm } = useMutation(
		(id: string, data: Record<string, unknown>) => app.forms.update(id, data),
	)
	const { mutateAsync: createPublicFormVersion } = useMutation(
		(data: Record<string, unknown>) => app.public_form_versions.insert(data),
	)

	const isPublished = form ? String(form.status) === 'published' : false
	const formTitle = form ? String(form.title || 'Untitled Form') : 'Loading...'
	const slug = form ? String(form.slug || '') : ''
	const formTheme = form ? String(form.theme || 'red') : 'red'
	const formHasPassword = hasFormAccessPasswordSecret(form?.accessPassword)
	const formSettings = useMemo<FormSettingsType>(() => {
		if (!form) return {}
		return parseFormSettings(form.settings)
	}, [form])
	const formFields = useMemo(() => {
		if (!form) return []
		return parseFormFields(form.fields)
	}, [form])
	const formUrl = getPublicFormUrl(slug || formId || '')

	const recordPublishedVersion = async (nextSlug: string) => {
		if (!form || !nextSlug) return
		const version = buildPublishedFormVersionRecord({
			form: { ...form, slug: nextSlug, status: 'published' },
			slug: nextSlug,
		})
		try {
			await createPublicFormVersion(version as unknown as Record<string, unknown>)
		} catch {
			// Publishing identical content can hit the slug/versionHash uniqueness guard.
			// The existing immutable snapshot is already the correct history entry.
		}
	}

	const updateSettings = (next: FormSettingsType) => {
		if (!formId) return
		updateForm(formId, { settings: JSON.stringify(serializeFormSettings(next)) })
		void recordAuditEvent(app.audit_events, {
			formId,
			actorId: userId,
			eventType: 'settings_updated',
			summary: 'Updated form settings',
			metadata: {
				publicResults: !!next.publicResults,
				hasSchedule: !!(next.opensAt || next.closesAt),
				hasLimit: !!next.maxResponses,
			},
		})
	}
	const updatePassword = (password: string) => {
		if (!formId) return
		updateForm(formId, { accessPassword: password.trim() })
		void recordAuditEvent(app.audit_events, {
			formId,
			actorId: userId,
			eventType: 'password_updated',
			summary: 'Updated access password',
		})
	}
	const clearPassword = () => {
		if (!formId) return
		updateForm(formId, { accessPassword: null })
		void recordAuditEvent(app.audit_events, {
			formId,
			actorId: userId,
			eventType: 'password_cleared',
			summary: 'Cleared access password',
		})
	}

	// Determine active tab from URL
	const activePanel = parseFormShellPanel(searchParams.get('panel'))
	const activeTab = activeFormShellTab(location.pathname, activePanel)

	const handleTabClick = (tab: FormShellTab) => {
		if (!formId) return
		routerNav(formShellTabPath(formId, tab))
	}

	// Publish handler
	const handlePublish = () => {
		if (!formId || !form) return
		setPublishFeedback('saving')
		const title = String(form.title || 'Untitled Form')
		const payload = buildPublishPayload(title, String(form.slug || ''))
		updateForm(formId, {
			status: payload.status,
			slug: payload.slug,
		})
		void recordAuditEvent(app.audit_events, {
			formId,
			actorId: userId,
			eventType: 'form_published',
			summary: isPublished ? 'Published form changes' : 'Published form',
			metadata: { slug: payload.slug },
		})
		void recordPublishedVersion(payload.slug)
		window.setTimeout(() => {
			setPublishFeedback('saved')
			window.setTimeout(() => setPublishFeedback('idle'), 1800)
		}, 300)
		if (payload.shouldOpenShare) {
			setShowShareModal(true)
		}
	}

	const handleSlugChange = (nextSlug: string) => {
		if (!formId) return
		const sanitized = sanitizeSlug(nextSlug)
		if (!sanitized) return
		updateForm(formId, { slug: sanitized })
		void recordAuditEvent(app.audit_events, {
			formId,
			actorId: userId,
			eventType: 'form_updated',
			summary: 'Updated public URL',
			metadata: { slug: sanitized },
		})
	}

	const handleStatusChange = (status: string) => {
		if (!formId || !form) return
		const payload = buildStatusPayload(status, slug, formTitle)
		updateForm(formId, payload)
		const eventType = status === 'published'
			? 'form_published'
			: status === 'closed'
				? 'form_closed'
				: 'form_reopened'
		void recordAuditEvent(app.audit_events, {
			formId,
			actorId: userId,
			eventType,
			summary: `Changed status to ${status}`,
			metadata: { status },
		})
		if (status === 'published') {
			void recordPublishedVersion(String(payload.slug || slug))
		}
	}

	const handleRestoreVersion = async (version: PublicFormVersionRecord) => {
		if (!formId) return
		updateForm(formId, buildVersionRestorePayload(version))
		await recordAuditEvent(app.audit_events, {
			formId,
			actorId: userId,
			eventType: 'form_updated',
			summary: 'Restored a published revision as draft',
			metadata: {
				versionHash: version.versionHash,
				publishedAt: version.publishedAt,
			},
		})
	}

	const handleWebhookTest = async (webhook: WebhookConfig): Promise<{ ok: boolean; message: string }> => {
		if (!formId) return { ok: false, message: 'Save the form before testing a webhook.' }
		const token = await authClient.getAccessToken()
		if (!token) return { ok: false, message: 'Sign in again before testing webhooks.' }
		const response = await fetch('/api/forms/webhook-test', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ formId, webhook }),
		})
		const body = await response.json().catch(() => ({})) as { message?: string; error?: string }
		return {
			ok: response.ok,
			message: body.message || body.error || (response.ok ? 'Test event sent.' : 'Webhook test failed.'),
		}
	}

	const handleEmailTest = async (email: string): Promise<{ ok: boolean; message: string }> => {
		if (!formId) return { ok: false, message: 'Save the form before testing email notifications.' }
		const token = await authClient.getAccessToken()
		if (!token) return { ok: false, message: 'Sign in again before testing email notifications.' }
		const response = await fetch('/api/forms/email-test', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ formId, email }),
		})
		const body = await response.json().catch(() => ({})) as { message?: string; error?: string }
		return {
			ok: response.ok,
			message: body.message || body.error || (response.ok ? 'Test email sent.' : 'Email test failed.'),
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

	// Collaborator data
	const formCollaborators = useFormCollaborators(formId || '')
	const formRole = useFormRole(
		form ? String(form.ownerId || '') : '',
		userId,
		formId || '',
	)

	const tabs: { key: FormShellTab; label: string }[] = [
		{ key: 'build', label: 'Build' },
		{ key: 'responses', label: 'Responses' },
		{ key: 'url', label: 'URL' },
		{ key: 'share', label: 'Share' },
		{ key: 'collaborators', label: 'People' },
		{ key: 'settings', label: 'Settings' },
	]

	if (!formId) return null

	return (
		<div className="animate-fade-in">
			{/* Breadcrumb bar */}
			<div className="flex items-center justify-between mb-3">
				<div className="flex min-w-0 items-center gap-3 text-sm">
					<button
						onClick={() => navigate('dashboard')}
						className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
						aria-label="Back to forms"
						title="Back to forms"
					>
						<ChevronLeft className="h-4 w-4" />
					</button>
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
			{activePanel === 'collaborators' && form && (
				<CollaboratorsPanel
					formId={formId}
					formTitle={formTitle}
					collaborators={formCollaborators}
					userRole={formRole?.role || 'owner'}
					userId={userId}
					userEmail={user?.email || ''}
				/>
			)}
			{activePanel === 'settings' && form && (
				<FormSettingsPanel
					title={formTitle}
					status={String(form.status || 'draft')}
					slug={slug}
					theme={formTheme}
					fields={formFields}
					auditEvents={auditEvents}
					sideEffectDeliveries={sideEffectDeliveries}
					versionRecords={versionRecords}
					settings={formSettings}
					hasPassword={formHasPassword}
					onStatusChange={handleStatusChange}
					onThemeChange={(theme) => {
						updateForm(formId, { theme })
						void recordAuditEvent(app.audit_events, {
							formId,
							actorId: userId,
							eventType: 'theme_changed',
							summary: 'Changed form theme',
							metadata: { theme },
						})
					}}
					onSettingsChange={updateSettings}
					onPasswordChange={updatePassword}
					onPasswordClear={clearPassword}
					onWebhookTest={handleWebhookTest}
					onEmailTest={handleEmailTest}
					onRestoreVersion={handleRestoreVersion}
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
	const { user } = useAuth()
	return <FormResponses formId={formId!} navigate={navigate} userId={user?.id || ''} />
}

// ---------------------------------------------------------------------------
// New form creation page — NOT nested under FormPageShell
// ---------------------------------------------------------------------------

// Module-level guard survives StrictMode unmount/remount cycles
let formCreationInFlight = false

function FormBuilderPage({ navigate, userId }: { navigate: (path: string) => void; userId: string }) {
	const routerNav = useNavigate()
	const [searchParams] = useSearchParams()
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (formCreationInFlight) return
		formCreationInFlight = true

		const templateKey = searchParams.get('template')
		const template = templateKey ? FORM_TEMPLATES[templateKey] : null

		const data = {
			title: template?.title || 'Untitled Form',
			description: template?.description || '',
			fields: templateKey && template ? JSON.stringify(createFieldsFromTemplate(templateKey)) : '[]',
			status: 'draft',
			ownerId: userId,
			theme: 'red',
		}

		app.forms.insert(data).then((record) => {
			void recordAuditEvent(app.audit_events, {
				formId: String(record.id),
				actorId: userId,
				eventType: templateKey ? 'template_used' : 'form_created',
				summary: templateKey && template ? `Created form from ${template.title}` : 'Created blank form',
				metadata: {
					templateKey: templateKey || '',
					templateTitle: template?.title || '',
				},
			})
			routerNav(`/forms/${record.id}/edit`, { replace: true })
		}).catch((err) => {
			console.error('Failed to create form:', err)
			setError(err instanceof Error ? err.message : 'Failed to create form')
		}).finally(() => {
			formCreationInFlight = false
		})
	}, [searchParams, userId, routerNav])

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center py-20 gap-4">
				<p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
				<button
					onClick={() => { setError(null); formCreationInFlight = false }}
					className="text-sm text-brand-600 dark:text-brand-400 font-medium hover:underline"
				>
					Try again
				</button>
			</div>
		)
	}

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
	const [searchParams] = useSearchParams()

	useEffect(() => {
		setPageMeta({ title: 'Sign In', description: 'Sign in to your KoraForms account.' })
	}, [])

	if (!isLoading && isAuthenticated) {
		const templateKey = searchParams.get('template')
		if (templateKey && FORM_TEMPLATES[templateKey]) {
			return <Navigate to={`/forms/new/edit?template=${templateKey}`} replace />
		}
		const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'
		return <Navigate to={from} replace />
	}

	return <SignIn navigate={navigate} />
}

function SignUpPage() {
	const navigate = useAppNavigate()
	const { isAuthenticated, isLoading } = useAuth()
	const [searchParams] = useSearchParams()

	useEffect(() => {
		setPageMeta({ title: 'Sign Up', description: 'Create a free KoraForms account. Build forms that work offline.' })
	}, [])

	if (!isLoading && isAuthenticated) {
		const templateKey = searchParams.get('template')
		if (templateKey && FORM_TEMPLATES[templateKey]) {
			return <Navigate to={`/forms/new/edit?template=${templateKey}`} replace />
		}
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
				<div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
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

function DashboardTemplateDetailPage() {
	const { templateKey } = useParams()
	const navigate = useAppNavigate()
	return <TemplateDetail templateKey={templateKey!} navigate={navigate} source="dashboard" />
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
					<Route path="/invite/:token" element={<Suspense fallback={<InlineLoader message="Loading..." />}><AcceptInvite /></Suspense>} />
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
