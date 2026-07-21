import { useState } from 'react'
import { useAuth } from '@korajs/auth/react'
import { Eye, EyeOff, ArrowRight, WifiOff, Zap, Shield, Check } from 'lucide-react'

interface Props {
	navigate: (path: string) => void
}

export function SignUp({ navigate }: Props) {
	const { signUp, error, isLoading } = useAuth()
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [localError, setLocalError] = useState<string | null>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (submitting) return
		setLocalError(null)

		if (password.length < 8) {
			setLocalError('Password must be at least 8 characters')
			return
		}
		if (password !== confirmPassword) {
			setLocalError('Passwords do not match')
			return
		}

		setSubmitting(true)
		await signUp({ email, password, name: name || undefined })
		setSubmitting(false)
	}

	const displayError = localError || error

	const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 8 ? 2 : password.length < 12 ? 3 : 4
	const strengthColors = ['', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500']
	const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']

	return (
		<div className="min-h-screen flex bg-surface dark:bg-surface-dark">
			{/* Left panel — branding (hidden on mobile) */}
			<div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-600 to-brand-700">
				{/* Decorative elements */}
				<div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
				<div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
				<div className="absolute top-1/4 left-1/3 w-2 h-2 bg-white/20 rounded-full" />
				<div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-white/15 rounded-full" />

				<div className="relative flex flex-col justify-center px-12 xl:px-16">
					<div className="flex items-center gap-3 mb-10">
						<img src="/logo-icon.png" alt="KoraForms" className="w-10 h-10 rounded-xl" />
						<span className="text-xl font-bold text-white tracking-tight">KoraForms</span>
					</div>

					<h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4 tracking-tight">
						Start collecting<br />data in minutes.
					</h2>
					<p className="text-brand-200 text-base mb-10 max-w-sm leading-relaxed">
						Join thousands who build forms that work anywhere — even without internet.
					</p>

					<div className="space-y-4">
						{[
							{ icon: <WifiOff className="h-4 w-4" />, text: 'Works without internet' },
							{ icon: <Zap className="h-4 w-4" />, text: '17+ ready-made templates' },
							{ icon: <Shield className="h-4 w-4" />, text: 'Free forever, no credit card' },
						].map((item) => (
							<div key={item.text} className="flex items-center gap-3 text-brand-200">
								<div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
									{item.icon}
								</div>
								<span className="text-sm font-medium">{item.text}</span>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Right panel — form */}
			<div className="flex-1 flex items-center justify-center px-4 sm:px-6">
				<div className="w-full max-w-sm animate-fade-in">
					{/* Logo */}
					<div className="text-center mb-8 lg:mb-10">
						<button
							onClick={() => navigate('')}
							className="inline-flex items-center gap-2.5 hover:opacity-80 transition-smooth"
						>
							<img src="/logo-icon.png" alt="KoraForms" className="w-10 h-10 rounded-xl" />
							<span className="text-xl font-bold tracking-tight">KoraForms</span>
						</button>
						<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-6 mb-1">Create your account</h2>
						<p className="text-gray-500 dark:text-gray-400 text-sm">
							Free forever. No credit card required.
						</p>
					</div>

					{/* Form */}
					<form onSubmit={handleSubmit} className="space-y-4">
						{displayError && (
							<div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400 animate-shake">
								{displayError}
							</div>
						)}

						<div>
							<label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
								Name <span className="text-gray-400 font-normal">(optional)</span>
							</label>
							<input
								id="name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Your name"
								autoFocus
								autoComplete="name"
								className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-elevated-dark px-4 py-3 text-sm outline-none focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-smooth"
							/>
						</div>

						<div>
							<label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
								Email
							</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
								required
								autoComplete="email"
								className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-elevated-dark px-4 py-3 text-sm outline-none focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-smooth"
							/>
						</div>

						<div>
							<label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
								Password
							</label>
							<div className="relative">
								<input
									id="password"
									type={showPassword ? 'text' : 'password'}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="At least 8 characters"
									required
									minLength={8}
									autoComplete="new-password"
									className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-elevated-dark px-4 py-3 pr-10 text-sm outline-none focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-smooth"
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-smooth"
									tabIndex={-1}
								>
									{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
								</button>
							</div>
							{/* Strength indicator */}
							{password.length > 0 && (
								<div className="mt-2 animate-fade-in">
									<div className="flex gap-1 mb-1">
										{[1, 2, 3, 4].map((level) => (
											<div
												key={level}
												className={`h-1 flex-1 rounded-full transition-smooth ${
													passwordStrength >= level ? strengthColors[passwordStrength] : 'bg-gray-200 dark:bg-gray-700'
												}`}
											/>
										))}
									</div>
									<div className="flex items-center justify-between">
										<p className={`text-xs ${passwordStrength >= 3 ? 'text-emerald-500' : 'text-gray-400'}`}>
											{strengthLabels[passwordStrength]}
										</p>
										{password.length < 8 && (
											<p className="text-xs text-gray-400">
												{8 - password.length} more character{8 - password.length !== 1 ? 's' : ''}
											</p>
										)}
									</div>
								</div>
							)}
						</div>

						<div>
							<label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
								Confirm password
							</label>
							<div className="relative">
								<input
									id="confirmPassword"
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder="Repeat your password"
									required
									autoComplete="new-password"
									className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-elevated-dark px-4 py-3 text-sm outline-none focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-smooth"
								/>
								{confirmPassword.length > 0 && password === confirmPassword && (
									<div className="absolute right-3 top-1/2 -translate-y-1/2">
										<Check className="h-4 w-4 text-emerald-500" />
									</div>
								)}
							</div>
						</div>

						<button
							type="submit"
							disabled={submitting || isLoading}
							className="group w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition-smooth hover:bg-brand-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
						>
							{submitting ? 'Creating account...' : 'Create account'}
							{!submitting && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
						</button>
					</form>

					{/* Divider */}
					<div className="relative my-6">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-gray-200 dark:border-gray-800" />
						</div>
						<div className="relative flex justify-center text-xs">
							<span className="px-3 bg-surface dark:bg-surface-dark text-gray-400">or</span>
						</div>
					</div>

					{/* Footer */}
					<p className="text-center text-sm text-gray-500 dark:text-gray-400">
						Already have an account?{' '}
						<button
							onClick={() => navigate('signin')}
							className="text-brand-600 dark:text-brand-400 font-semibold hover:underline"
						>
							Sign in
						</button>
					</p>
				</div>
			</div>
		</div>
	)
}
