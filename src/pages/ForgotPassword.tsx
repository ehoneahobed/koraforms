import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@korajs/auth/react'
import { KeyRound, Loader2, Mail } from 'lucide-react'
import { Card } from '../components/shared/CenteredCard'
import { passwordErrorMessage } from '../features/account/errors'

const INPUT =
	'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-elevated-dark px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-smooth'

/** "Forgot your password?": asks for a reset link by email. */
export function ForgotPassword() {
	const navigate = useNavigate()
	const location = useLocation()
	const { requestPasswordReset } = useAuth()
	const [email, setEmail] = useState(() => (location.state as { email?: string } | null)?.email ?? '')
	const [sentTo, setSentTo] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	async function submit(event: React.FormEvent) {
		event.preventDefault()
		const address = email.trim()
		if (!address || busy) return
		setBusy(true)
		setError('')
		try {
			await requestPasswordReset(address)
			setSentTo(address)
		} catch (failure) {
			setError(passwordErrorMessage(failure))
		} finally {
			setBusy(false)
		}
	}

	if (sentTo) {
		return (
			<Card icon={<Mail className="h-7 w-7 text-brand-600 dark:text-brand-400" />} tone="brand" title="Check your email">
				<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">
					If a KoraForms account uses <strong>{sentTo}</strong>, we sent it a link to choose a new password. The link works once, for 1 hour.
				</p>
				<div className="flex gap-3 justify-center">
					<button onClick={() => navigate('/signin')} className="kf-primary px-6 py-3 text-[15px] font-semibold rounded-xl">Back to sign in</button>
					<button onClick={() => setSentTo('')} className="kf-control px-6 py-3 text-[15px] font-semibold rounded-xl">Use another address</button>
				</div>
			</Card>
		)
	}

	return (
		<Card icon={<KeyRound className="h-7 w-7 text-brand-600 dark:text-brand-400" />} tone="brand" title="Forgot your password?">
			<p className="text-gray-500 dark:text-gray-400 text-[15px] mb-6">Enter your account's email address and we will send you a link to choose a new password.</p>
			<form onSubmit={submit} className="space-y-4 text-left">
				{error && <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
				<div>
					<label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
					<input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus autoComplete="email" className={INPUT} />
				</div>
				<button type="submit" disabled={busy || !email.trim()} className="kf-primary w-full px-6 py-3 text-[15px] font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center">
					{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
				</button>
			</form>
			<button onClick={() => navigate('/signin')} className="mt-5 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline">Back to sign in</button>
		</Card>
	)
}
