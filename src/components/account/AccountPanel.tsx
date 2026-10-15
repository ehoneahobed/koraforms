import { useState } from 'react'
import { useAuth } from '@korajs/auth/react'
import { BadgeCheck, Loader2, MailWarning } from 'lucide-react'
import { newPasswordProblem, passwordErrorMessage } from '../../features/account/errors'

const INPUT =
	'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'

type Notice = { tone: 'success' | 'error'; message: string } | null

/** Account settings: the address and whether it is verified, and changing the password. */
export function AccountPanel() {
	const { user, sendVerificationEmail, changePassword } = useAuth()
	const [current, setCurrent] = useState('')
	const [next, setNext] = useState('')
	const [confirmation, setConfirmation] = useState('')
	const [busy, setBusy] = useState(false)
	const [passwordNotice, setPasswordNotice] = useState<Notice>(null)
	const [verifyNotice, setVerifyNotice] = useState<Notice>(null)
	const [sending, setSending] = useState(false)

	async function submit(event: React.FormEvent) {
		event.preventDefault()
		if (busy) return
		const problem = newPasswordProblem(next, confirmation)
		if (problem) {
			setPasswordNotice({ tone: 'error', message: problem })
			return
		}
		setBusy(true)
		setPasswordNotice(null)
		try {
			await changePassword(current, next)
			setCurrent('')
			setNext('')
			setConfirmation('')
			setPasswordNotice({ tone: 'success', message: 'Password changed. Your other devices were signed out.' })
		} catch (failure) {
			setPasswordNotice({ tone: 'error', message: passwordErrorMessage(failure) })
		} finally {
			setBusy(false)
		}
	}

	async function verify() {
		setSending(true)
		setVerifyNotice(null)
		try {
			const result = await sendVerificationEmail()
			setVerifyNotice({
				tone: 'success',
				message: result.alreadyVerified ? 'Your email is verified.' : `We sent a verification link to ${user?.email}. Open it while signed in.`,
			})
		} catch {
			setVerifyNotice({ tone: 'error', message: 'The verification email could not be sent. Try again later.' })
		} finally {
			setSending(false)
		}
	}

	const noticeClass = (notice: Notice) =>
		`mt-3 text-[13px] ${notice?.tone === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`

	return (
		<div className="kf-panel divide-y divide-slate-100 dark:divide-gray-800">
			<div className="px-5 py-4">
				<p className="text-[13px] text-slate-500 dark:text-gray-400">Email</p>
				<div className="mt-1 flex flex-wrap items-center gap-3">
					<p className="text-[15px] font-medium text-slate-900 dark:text-gray-100">{user?.email}</p>
					{user?.emailVerified ? (
						<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
							<BadgeCheck className="h-3.5 w-3.5" /> Verified
						</span>
					) : (
						<>
							<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
								<MailWarning className="h-3.5 w-3.5" /> Not verified
							</span>
							<button onClick={() => void verify()} disabled={sending} className="text-[13px] font-semibold text-brand-600 hover:underline disabled:opacity-50 dark:text-brand-400">
								{sending ? 'Sending...' : 'Send verification link'}
							</button>
						</>
					)}
				</div>
				{!user?.emailVerified && (
					<p className="mt-1 text-[12px] text-slate-400 dark:text-gray-500">Accepting an invitation to collaborate needs a verified address.</p>
				)}
				{verifyNotice && <p role="status" className={noticeClass(verifyNotice)}>{verifyNotice.message}</p>}
			</div>

			<form onSubmit={submit} className="px-5 py-4">
				<p className="text-[15px] font-semibold text-slate-900 dark:text-gray-100">Change password</p>
				<p className="mt-0.5 mb-4 text-[13px] text-slate-500 dark:text-gray-400">This device stays signed in; every other device is signed out.</p>
				<div className="grid gap-3 sm:grid-cols-3">
					<div>
						<label htmlFor="current-password" className="mb-1 block text-[13px] font-medium text-slate-600 dark:text-gray-300">Current password</label>
						<input id="current-password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" className={INPUT} />
					</div>
					<div>
						<label htmlFor="account-new-password" className="mb-1 block text-[13px] font-medium text-slate-600 dark:text-gray-300">New password</label>
						<input id="account-new-password" type="password" placeholder="At least 8 characters" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" className={INPUT} />
					</div>
					<div>
						<label htmlFor="account-confirm-password" className="mb-1 block text-[13px] font-medium text-slate-600 dark:text-gray-300">Confirm new password</label>
						<input id="account-confirm-password" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required autoComplete="new-password" className={INPUT} />
					</div>
				</div>
				<button type="submit" disabled={busy} className="kf-primary mt-4 inline-flex items-center px-5 py-2.5 text-[14px] font-semibold disabled:opacity-50">
					{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Change password'}
				</button>
				{passwordNotice && <p role={passwordNotice.tone === 'error' ? 'alert' : 'status'} className={noticeClass(passwordNotice)}>{passwordNotice.message}</p>}
			</form>
		</div>
	)
}
