import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth, useAuthStatus } from '@korajs/auth/react'
import type { InvitationDescription } from '@korajs/spaces'
import { SpacesError } from '@korajs/spaces/client'
import { AlertCircle, Check, Loader2, LogIn, Mail, UserPlus } from 'lucide-react'
import { ensureSyncConnected } from '../kora'
import { ROLE_LABELS, collaboratorRole } from '../features/collaborators/access'
import { pendingInvite } from '../features/collaborators/pendingLinks'
import { Card } from '../components/shared/CenteredCard'
import { sharingErrorMessage, spaces } from '../features/collaborators/spaces'

/** Refusals after which the kept invitation link is of no further use. */
const TERMINAL = new Set<string>(['INVITATION_NOT_FOUND', 'INVITATION_EXPIRED', 'ALREADY_MEMBER', 'INVITER_NO_LONGER_AUTHORIZED', 'SPACE_NOT_FOUND'])

type View =
	| { kind: 'loading' }
	| { kind: 'invitation'; invitation: InvitationDescription }
	| { kind: 'accepted'; formId: string }
	| { kind: 'declined' }
	| { kind: 'error'; message: string }

/**
 * The page an invitation link opens (`/invite#<token>`). The invitee signs in (or creates
 * an account) with the invited address, verifies it, then accepts.
 */
export function AcceptInvite() {
	const { legacyToken } = useParams<{ legacyToken?: string }>()
	const navigate = useNavigate()
	const { isAuthenticated, isLoading: authLoading } = useAuthStatus()
	const { user, signOut, sendVerificationEmail } = useAuth()
	const [token] = useState(() => (legacyToken ? '' : pendingInvite.take()))
	const [view, setView] = useState<View>({ kind: 'loading' })
	const [busy, setBusy] = useState(false)
	const [verificationSent, setVerificationSent] = useState(false)
	const [notice, setNotice] = useState('')
	const [attempt, setAttempt] = useState(0)
	const verified = user?.emailVerified === true
	const waitingForVerification = view.kind === 'invitation' && view.invitation.match === 'unverified'

	useEffect(() => {
		if (authLoading || !isAuthenticated || !token) return
		void ensureSyncConnected()
		let cancelled = false
		setView((current) => (current.kind === 'invitation' ? current : { kind: 'loading' }))
		spaces
			.describe(token)
			.then((invitation) => {
				if (invitation.expired) pendingInvite.clear()
				if (!cancelled) setView({ kind: 'invitation', invitation })
			})
			.catch((error: unknown) => {
				if (error instanceof SpacesError && TERMINAL.has(error.spacesCode)) pendingInvite.clear()
				if (!cancelled) setView({ kind: 'error', message: sharingErrorMessage(error, 'This invitation could not be opened.') })
			})
		return () => {
			cancelled = true
		}
		// `verified` and `attempt` describe it again (match becomes 'yes' once verified).
	}, [authLoading, isAuthenticated, token, user?.id, verified, attempt])

	// The verification link usually opens in another tab: look again when this one is back.
	useEffect(() => {
		if (!waitingForVerification) return
		const again = () => {
			if (document.visibilityState === 'visible') setAttempt((n) => n + 1)
		}
		window.addEventListener('focus', again)
		document.addEventListener('visibilitychange', again)
		return () => {
			window.removeEventListener('focus', again)
			document.removeEventListener('visibilitychange', again)
		}
	}, [waitingForVerification])

	async function accept() {
		setBusy(true)
		try {
			const result = await spaces.accept(token, { timeoutMs: 5000 })
			pendingInvite.clear()
			setView({ kind: 'accepted', formId: result.space[1] })
		} catch (error) {
			if (error instanceof SpacesError && TERMINAL.has(error.spacesCode)) pendingInvite.clear()
			setView({ kind: 'error', message: sharingErrorMessage(error, 'Failed to accept the invitation.') })
		} finally {
			setBusy(false)
		}
	}

	async function decline() {
		setBusy(true)
		try {
			await spaces.decline(token)
			pendingInvite.clear()
			setView({ kind: 'declined' })
		} catch (error) {
			setView({ kind: 'error', message: sharingErrorMessage(error, 'Failed to decline the invitation.') })
		} finally {
			setBusy(false)
		}
	}

	async function sendVerification() {
		setBusy(true)
		setNotice('')
		try {
			const result = await sendVerificationEmail()
			if (result.alreadyVerified) setNotice('Your email is already verified.')
			else setVerificationSent(true)
		} catch (error) {
			setNotice(sharingErrorMessage(error, 'The verification email could not be sent. Try again in a moment.'))
		} finally {
			setBusy(false)
		}
	}

	if (legacyToken) {
		return (
			<Card icon={<Mail className="h-7 w-7 text-brand-600 dark:text-brand-400" />} tone="brand" title="This link was replaced">
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">
					Invitation links have changed. If your invitation is still open, a new email with a new link is on its way; otherwise ask the form owner to invite you again.
				</p>
				<button onClick={() => navigate('/dashboard')} className="kf-control px-6 py-3 text-[15px] font-semibold rounded-xl">Go to dashboard</button>
			</Card>
		)
	}

	if (authLoading) return <Spinner label="Loading..." />

	if (!token) {
		return (
			<Card icon={<AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />} tone="red" title="Invitation link incomplete">
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">Open the link from your invitation email again.</p>
				<button onClick={() => navigate('/dashboard')} className="kf-control px-6 py-3 text-[15px] font-semibold rounded-xl">Go to dashboard</button>
			</Card>
		)
	}

	if (!isAuthenticated) {
		return (
			<Card icon={<LogIn className="h-7 w-7 text-brand-600 dark:text-brand-400" />} tone="brand" title="Sign in to continue">
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">
					Sign in, or create an account, with the email address this invitation was sent to.
				</p>
				<div className="flex gap-3 justify-center">
					<button onClick={() => navigate('/signin', { state: { from: { pathname: '/invite' } } })} className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl">Sign in</button>
					<button onClick={() => navigate('/signup', { state: { from: { pathname: '/invite' } } })} className="kf-control px-6 py-3 text-[15px] font-semibold rounded-xl">Create account</button>
				</div>
			</Card>
		)
	}

	if (view.kind === 'loading') return <Spinner label="Opening invitation..." />

	if (view.kind === 'accepted') {
		return (
			<Card icon={<Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />} tone="emerald" title="You're in!">
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">The form is now in your dashboard.</p>
				<button onClick={() => navigate(`/forms/${view.formId}/edit`)} className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl">Open form</button>
			</Card>
		)
	}

	if (view.kind === 'declined') {
		return (
			<Card icon={<Check className="h-7 w-7 text-slate-500" />} tone="slate" title="Invitation declined">
				<button onClick={() => navigate('/dashboard')} className="kf-control px-6 py-3 text-[15px] font-semibold rounded-xl">Go to dashboard</button>
			</Card>
		)
	}

	if (view.kind === 'error') {
		return (
			<Card icon={<AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />} tone="red" title="Invitation issue">
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">{view.message}</p>
				<div className="flex gap-3 justify-center">
					{pendingInvite.peek() && (
						<button onClick={() => { setView({ kind: 'loading' }); setAttempt((n) => n + 1) }} className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl">Try again</button>
					)}
					<button onClick={() => navigate('/dashboard')} className="kf-control px-6 py-3 text-[15px] font-semibold rounded-xl">Go to dashboard</button>
				</div>
			</Card>
		)
	}

	const { invitation } = view
	const role = ROLE_LABELS[collaboratorRole(invitation.role)]
	const title = typeof invitation.details?.title === 'string' ? invitation.details.title : null
	const inviter = typeof invitation.details?.inviterName === 'string' ? invitation.details.inviterName : null

	if (invitation.expired) {
		return (
			<Card icon={<AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />} tone="red" title="Invitation expired">
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">Ask the form owner to send it again.</p>
				<button onClick={() => navigate('/dashboard')} className="kf-control px-6 py-3 text-[15px] font-semibold rounded-xl">Go to dashboard</button>
			</Card>
		)
	}

	if (invitation.match === 'no') {
		return (
			<Card icon={<Mail className="h-7 w-7 text-brand-600 dark:text-brand-400" />} tone="brand" title="Wrong account">
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">
					This invitation was sent to <strong>{invitation.emailHint}</strong>, but you are signed in as <strong>{user?.email}</strong>. Sign in with the invited address to accept it.
				</p>
				<button
					onClick={async () => {
						await signOut()
						navigate('/signin', { state: { from: { pathname: '/invite' } } })
					}}
					className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl"
				>
					Switch account
				</button>
			</Card>
		)
	}

	if (invitation.match === 'unverified') {
		return (
			<Card icon={<Mail className="h-7 w-7 text-brand-600 dark:text-brand-400" />} tone="brand" title="Verify your email first">
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">
					{verificationSent
						? <>We sent a new verification link to <strong>{user?.email}</strong>.</>
						: <>To accept this invitation as {role.toLowerCase()}, confirm that <strong>{user?.email}</strong> is your address. If you just created your account, we already emailed you a link.</>}
					{' '}Open the link in this browser while signed in, then come back to this page.
				</p>
				{notice && <p role="status" className="mb-4 text-[13px] text-slate-600 dark:text-gray-300">{notice}</p>}
				<button onClick={() => void sendVerification()} disabled={busy} className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl disabled:opacity-50">
					{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : verificationSent ? 'Send again' : 'Email me a verification link'}
				</button>
			</Card>
		)
	}

	return (
		<Card icon={<UserPlus className="h-7 w-7 text-brand-600 dark:text-brand-400" />} tone="brand" title="You're invited">
			<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">
				{inviter ? <><strong>{inviter}</strong> invited you</> : 'You were invited'} to collaborate on {title ? <strong>"{title}"</strong> : 'a form'} as <strong>{role}</strong>.
			</p>
			<div className="flex gap-3 justify-center">
				<button onClick={() => void accept()} disabled={busy} className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl disabled:opacity-50">
					{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept invitation'}
				</button>
				<button onClick={() => void decline()} disabled={busy} className="kf-control px-6 py-3 text-[15px] font-semibold rounded-xl disabled:opacity-50">Decline</button>
			</div>
		</Card>
	)
}

function Spinner({ label }: { label: string }) {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
			<div className="text-center">
				<Loader2 className="h-8 w-8 animate-spin text-brand-600 mx-auto mb-4" />
				<p className="text-gray-500 dark:text-gray-400">{label}</p>
			</div>
		</div>
	)
}
