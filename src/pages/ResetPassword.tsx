import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@korajs/auth/react'
import { AlertCircle, Check, KeyRound, Loader2 } from 'lucide-react'
import { Card } from '../components/shared/CenteredCard'
import { newPasswordProblem, passwordErrorMessage, serverCodeOf } from '../features/account/errors'

const INPUT =
	'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-elevated-dark px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-smooth'

/** The token from the link's fragment, taken out of the address bar once read. */
function takeToken(): string {
	const token = window.location.hash.slice(1)
	if (token) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
	return token
}

/** The page a reset link opens (`/reset-password#<token>`): choose a new password. */
export function ResetPassword() {
	const navigate = useNavigate()
	const { resetPassword } = useAuth()
	const [token] = useState(takeToken)
	const [password, setPassword] = useState('')
	const [confirmation, setConfirmation] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const [linkDead, setLinkDead] = useState(false)
	const [done, setDone] = useState(false)

	async function submit(event: React.FormEvent) {
		event.preventDefault()
		if (busy) return
		const problem = newPasswordProblem(password, confirmation)
		if (problem) {
			setError(problem)
			return
		}
		setBusy(true)
		setError('')
		try {
			await resetPassword(token, password)
			setDone(true)
		} catch (failure) {
			const code = serverCodeOf(failure)
			setLinkDead(code === 'RESET_TOKEN_INVALID' || code === 'RESET_TOKEN_EXPIRED')
			setError(passwordErrorMessage(failure))
		} finally {
			setBusy(false)
		}
	}

	if (done) {
		return (
			<Card icon={<Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />} tone="emerald" title="Password changed">
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">Every device that was signed in has been signed out. Sign in with your new password.</p>
				<button onClick={() => navigate('/signin')} className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl">Sign in</button>
			</Card>
		)
	}

	if (!token || linkDead) {
		return (
			<Card icon={<AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />} tone="red" title={token ? 'Link no longer valid' : 'Reset link incomplete'}>
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">{token ? error : 'Open the link from your reset email again, or ask for a new one.'}</p>
				<button onClick={() => navigate('/forgot-password')} className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl">Ask for a new link</button>
			</Card>
		)
	}

	return (
		<Card icon={<KeyRound className="h-7 w-7 text-brand-600 dark:text-brand-400" />} tone="brand" title="Choose a new password">
			<form onSubmit={submit} className="mt-4 space-y-4 text-left">
				{error && <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
				<div>
					<label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">New password</label>
					<input id="new-password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={128} autoFocus autoComplete="new-password" className={INPUT} />
				</div>
				<div>
					<label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm new password</label>
					<input id="confirm-password" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required autoComplete="new-password" className={INPUT} />
				</div>
				<button type="submit" disabled={busy} className="kf-primary w-full px-6 py-3 text-[15px] font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center">
					{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set new password'}
				</button>
			</form>
		</Card>
	)
}
