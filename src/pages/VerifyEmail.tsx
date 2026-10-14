import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useAuthStatus } from '@korajs/auth/react'
import { AlertCircle, Check, Loader2, LogIn } from 'lucide-react'
import { pendingInvite, pendingVerification } from '../features/collaborators/pendingLinks'
import { Card } from './AcceptInvite'

type State = 'verifying' | 'verified' | 'wrong-account' | 'expired' | 'invalid' | 'error'

function serverCodeOf(error: unknown): string | null {
	const context = (error as { context?: { serverCode?: unknown } } | null)?.context
	return typeof context?.serverCode === 'string' ? context.serverCode : null
}

/**
 * The page a verification link opens (`/verify-email#<token>`). The link works only for
 * the account it was sent for, opened while signed in to it.
 */
export function VerifyEmail() {
	const navigate = useNavigate()
	const { isAuthenticated, isLoading } = useAuthStatus()
	const { user, verifyEmail, sendVerificationEmail, signOut } = useAuth()
	const [token] = useState(() => pendingVerification.take())
	const [state, setState] = useState<State>('verifying')
	const [resent, setResent] = useState(false)
	const attempted = useRef<string | null>(null)

	useEffect(() => {
		if (isLoading || !isAuthenticated || !user) return
		if (!token) {
			setState(user.emailVerified ? 'verified' : 'invalid')
			return
		}
		// Once per signed-in account (a switch of account tries again).
		if (attempted.current === user.id) return
		attempted.current = user.id
		setState('verifying')
		verifyEmail(token)
			.then(() => {
				pendingVerification.clear()
				setState('verified')
			})
			.catch((error: unknown) => {
				const code = serverCodeOf(error)
				if (code === 'VERIFICATION_WRONG_ACCOUNT') setState('wrong-account')
				else if (code === 'VERIFICATION_TOKEN_EXPIRED') setState('expired')
				else if (code === 'VERIFICATION_TOKEN_INVALID') setState(user.emailVerified ? 'verified' : 'invalid')
				else setState('error')
			})
	}, [isLoading, isAuthenticated, user, token, verifyEmail])

	async function resend() {
		try {
			await sendVerificationEmail()
			setResent(true)
		} catch {
			setState('error')
		}
	}

	if (isLoading) {
		return <Card icon={<Loader2 className="h-7 w-7 animate-spin text-brand-600" />} tone="brand" title="Loading..." />
	}

	if (!isAuthenticated) {
		return (
			<Card icon={<LogIn className="h-7 w-7 text-brand-600 dark:text-brand-400" />} tone="brand" title="Sign in to verify">
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">Sign in to the account this link was sent for. You will come back here to finish.</p>
				<button onClick={() => navigate('/signin', { state: { from: { pathname: '/verify-email' } } })} className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl">Sign in</button>
			</Card>
		)
	}

	if (state === 'verifying') {
		return <Card icon={<Loader2 className="h-7 w-7 animate-spin text-brand-600" />} tone="brand" title="Verifying your email..." />
	}

	if (state === 'verified') {
		const invite = pendingInvite.peek()
		return (
			<Card icon={<Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />} tone="emerald" title="Email verified">
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">{user?.email} is verified.</p>
				<button onClick={() => navigate(invite ? '/invite' : '/dashboard')} className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl">
					{invite ? 'Continue to your invitation' : 'Go to dashboard'}
				</button>
			</Card>
		)
	}

	const messages: Record<Exclude<State, 'verifying' | 'verified'>, { title: string; body: string }> = {
		'wrong-account': {
			title: 'Different account',
			body: `This link is for another account, and you are signed in as ${user?.email ?? 'someone else'}. Sign in to the account you created with the address the email was sent to.`,
		},
		expired: { title: 'Link expired', body: 'Verification links work for 24 hours. Send a new one.' },
		invalid: { title: 'Link not valid', body: 'This link was already used or replaced by a newer one. Use the most recent email, or send a new one.' },
		error: { title: 'Something went wrong', body: 'Your email could not be verified right now. Try again in a moment.' },
	}
	const { title, body } = messages[state]
	return (
		<Card icon={<AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />} tone="red" title={title}>
			<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">{resent ? `We sent a new link to ${user?.email}.` : body}</p>
			<div className="flex gap-3 justify-center">
				{state === 'wrong-account' ? (
					<button
						onClick={async () => {
							await signOut()
							attempted.current = null
							navigate('/signin', { state: { from: { pathname: '/verify-email' } } })
						}}
						className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl"
					>
						Switch account
					</button>
				) : (
					<button onClick={() => void resend()} disabled={resent} className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl disabled:opacity-50">Send a new link</button>
				)}
				<button onClick={() => navigate('/dashboard')} className="kf-control px-6 py-3 text-[15px] font-semibold rounded-xl">Dashboard</button>
			</div>
		</Card>
	)
}
