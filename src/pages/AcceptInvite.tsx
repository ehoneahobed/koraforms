import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth, useAuthStatus } from '@korajs/auth/react'
import { authClient } from '../auth'
import { Check, AlertCircle, Loader2, LogIn } from 'lucide-react'

export function AcceptInvite() {
	const { token } = useParams<{ token: string }>()
	const navigate = useNavigate()
	const { isAuthenticated, isLoading: authLoading } = useAuthStatus()
	const { user } = useAuth()
	const [status, setStatus] = useState<'idle' | 'accepting' | 'accepted' | 'error'>('idle')
	const [message, setMessage] = useState('')
	const [formId, setFormId] = useState('')
	const attempted = useRef(false)

	useEffect(() => {
		if (authLoading || !isAuthenticated || !token || attempted.current) return
		attempted.current = true
		acceptInvitation()
	}, [authLoading, isAuthenticated, token])

	async function acceptInvitation() {
		setStatus('accepting')
		try {
			const accessToken = await authClient.getAccessToken()
			if (!accessToken) {
				setStatus('error')
				setMessage('Please sign in to accept this invitation.')
				return
			}
			const res = await fetch('/api/forms/collaborators/accept', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ inviteToken: token }),
			})
			const body = await res.json().catch(() => ({})) as { message?: string; error?: string; formId?: string }
			if (res.ok) {
				setStatus('accepted')
				setMessage(body.message || 'Invitation accepted!')
				setFormId(body.formId || '')
			} else {
				setStatus('error')
				setMessage(body.error || 'Failed to accept invitation.')
			}
		} catch {
			setStatus('error')
			setMessage('Something went wrong. Please try again.')
		}
	}

	if (authLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
				<div className="text-center">
					<Loader2 className="h-8 w-8 animate-spin text-brand-600 mx-auto mb-4" />
					<p className="text-gray-500 dark:text-gray-400">Loading...</p>
				</div>
			</div>
		)
	}

	if (!isAuthenticated) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
				<div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center shadow-sm">
					<div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-brand-50 dark:bg-brand-900/25 flex items-center justify-center">
						<LogIn className="h-7 w-7 text-brand-600 dark:text-brand-400" />
					</div>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Sign in to continue</h1>
					<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">
						You need to sign in to accept this collaboration invitation.
					</p>
					<div className="flex gap-3 justify-center">
						<button
							onClick={() => navigate(`/signin`, { state: { from: { pathname: `/invite/${token}` } } })}
							className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl"
						>
							Sign in
						</button>
						<button
							onClick={() => navigate(`/signup`, { state: { from: { pathname: `/invite/${token}` } } })}
							className="kf-control px-6 py-3 text-[15px] font-semibold rounded-xl"
						>
							Create account
						</button>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
			<div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center shadow-sm">
				{status === 'accepting' && (
					<>
						<Loader2 className="h-10 w-10 animate-spin text-brand-600 mx-auto mb-4" />
						<h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Accepting invitation...</h1>
					</>
				)}
				{status === 'accepted' && (
					<>
						<div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/25 flex items-center justify-center">
							<Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
						</div>
						<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">You're in!</h1>
						<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">{message}</p>
						<button
							onClick={() => navigate(formId ? `/forms/${formId}/edit` : '/dashboard')}
							className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl"
						>
							{formId ? 'Open form' : 'Go to dashboard'}
						</button>
					</>
				)}
				{status === 'error' && (
					<>
						<div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-red-50 dark:bg-red-900/25 flex items-center justify-center">
							<AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
						</div>
						<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Invitation issue</h1>
						<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">{message}</p>
						<button
							onClick={() => navigate('/dashboard')}
							className="kf-control px-6 py-3 text-[15px] font-semibold rounded-xl"
						>
							Go to dashboard
						</button>
					</>
				)}
			</div>
		</div>
	)
}
