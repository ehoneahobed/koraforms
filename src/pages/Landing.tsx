import {
	Wifi,
	WifiOff,
	Zap,
	BarChart3,
	Shield,
	Globe,
	ArrowRight,
	Check,
	Smartphone,
	Sparkles,
	Play,
	Users,
	Database,
	Layers,
} from 'lucide-react'
import { useAuth } from '@korajs/auth/react'

interface Props {
	navigate: (path: string) => void
}

export function Landing({ navigate }: Props) {
	const { isAuthenticated } = useAuth()
	return (
		<div className="min-h-screen bg-white dark:bg-surface-dark">
			{/* Navigation */}
			<nav className="sticky top-0 z-40 border-b border-gray-100/50 dark:border-gray-800/50 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl">
				<div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-14">
					<div className="flex items-center gap-2.5">
						<img src="/logo-icon.png" alt="KoraForms" className="w-8 h-8 rounded-lg" />
						<span className="text-lg font-bold tracking-tight">KoraForms</span>
					</div>
					<div className="flex items-center gap-2">
						{isAuthenticated ? (
							<button
								onClick={() => navigate('dashboard')}
								className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 transition-smooth shadow-sm shadow-brand-600/25"
							>
								Dashboard
							</button>
						) : (
							<>
								<button
									onClick={() => navigate('signin')}
									className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-smooth"
								>
									Sign in
								</button>
								<button
									onClick={() => navigate('signup')}
									className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 transition-smooth shadow-sm shadow-brand-600/25"
								>
									Get started
								</button>
							</>
						)}
					</div>
				</div>
			</nav>

			{/* Hero */}
			<section className="relative overflow-hidden">
				{/* Background elements */}
				<div className="absolute inset-0 bg-gradient-to-b from-brand-50/80 via-white to-white dark:from-brand-900/10 dark:via-surface-dark dark:to-surface-dark" />
				<div className="absolute top-20 left-1/4 w-72 h-72 bg-brand-200/20 dark:bg-brand-800/10 rounded-full blur-3xl" />
				<div className="absolute top-40 right-1/4 w-96 h-96 bg-violet-200/15 dark:bg-violet-800/10 rounded-full blur-3xl" />

				<div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-32 pb-20 sm:pb-28">
					<div className="text-center max-w-3xl mx-auto">
						{/* Badge */}
						<div className="inline-flex items-center gap-2 rounded-full bg-brand-100/80 dark:bg-brand-900/30 px-4 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 mb-8 backdrop-blur-sm border border-brand-200/50 dark:border-brand-800/30">
							<WifiOff className="h-3.5 w-3.5" />
							Works offline — no internet required
						</div>

						<h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight text-gray-900 dark:text-gray-100 leading-[1.1] mb-6">
							Build forms that work{' '}
							<span className="relative">
								<span className="text-brand-600 dark:text-brand-400">anywhere</span>
								<svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
									<path d="M2 6C50 2 150 2 198 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-brand-300 dark:text-brand-700" />
								</svg>
							</span>
						</h1>

						<p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto mb-10">
							Create beautiful forms and collect data even without internet.
							Responses save locally and sync automatically. Perfect for fieldwork,
							churches, schools, and remote areas.
						</p>

						<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
							<button
								onClick={() => navigate(isAuthenticated ? 'dashboard' : 'signup')}
								className="group inline-flex items-center gap-2.5 rounded-xl bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition-smooth hover:bg-brand-500 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98]"
							>
								{isAuthenticated ? 'Go to Dashboard' : 'Start building — it\'s free'}
								<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
							</button>
							<button
								onClick={() => navigate('/how-it-works')}
								className="inline-flex items-center gap-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-7 py-3.5 text-base font-medium text-gray-700 dark:text-gray-300 transition-smooth hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
							>
								<Play className="h-4 w-4" />
								See how it works
							</button>
						</div>

						{/* Social proof */}
						<div className="flex items-center justify-center gap-6 mt-12 text-sm text-gray-400 dark:text-gray-500">
							<span className="flex items-center gap-1.5">
								<Check className="h-4 w-4 text-emerald-500" />
								Free forever
							</span>
							<span className="flex items-center gap-1.5">
								<Check className="h-4 w-4 text-emerald-500" />
								No credit card
							</span>
							<span className="flex items-center gap-1.5">
								<Check className="h-4 w-4 text-emerald-500" />
								Open source
							</span>
						</div>
					</div>
				</div>
			</section>

			{/* Features */}
			<section className="py-20 sm:py-28 border-t border-gray-100 dark:border-gray-800">
				<div className="mx-auto max-w-6xl px-4 sm:px-6">
					<div className="text-center mb-14">
						<div className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
							<Sparkles className="h-3.5 w-3.5" />
							Features
						</div>
						<h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 tracking-tight">
							Why teams choose KoraForms
						</h2>
						<p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
							Built for the real world — where internet isn't always available
							but your work can't stop.
						</p>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
						<FeatureCard
							icon={<WifiOff className="h-5 w-5" />}
							color="brand"
							title="Offline First"
							description="Create forms, collect responses, and view analytics — all without internet. Data saves to your device instantly."
						/>
						<FeatureCard
							icon={<Wifi className="h-5 w-5" />}
							color="sky"
							title="Auto Sync"
							description="When you're back online, everything syncs automatically. No manual export or upload needed."
						/>
						<FeatureCard
							icon={<Zap className="h-5 w-5" />}
							color="amber"
							title="Instant Setup"
							description="Start from 17+ templates or build from scratch. Church records, surveys, attendance — ready in minutes."
						/>
						<FeatureCard
							icon={<BarChart3 className="h-5 w-5" />}
							color="violet"
							title="Built-in Analytics"
							description="See response breakdowns, fill rates, trends over time, and numeric summaries. Export to CSV anytime."
						/>
						<FeatureCard
							icon={<Smartphone className="h-5 w-5" />}
							color="emerald"
							title="Mobile Ready"
							description="Typeform-style one-question-at-a-time experience on phones. Large touch targets, keyboard navigation."
						/>
						<FeatureCard
							icon={<Shield className="h-5 w-5" />}
							color="rose"
							title="Your Data, Your Device"
							description="Data is stored locally on your device first. No data leaves your device until you choose to sync."
						/>
					</div>
				</div>
			</section>

			{/* How it works */}
			<section className="py-20 sm:py-28 bg-gray-50 dark:bg-surface-elevated-dark border-t border-gray-100 dark:border-gray-800">
				<div className="mx-auto max-w-6xl px-4 sm:px-6">
					<div className="text-center mb-14">
						<h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 tracking-tight">
							Three steps. That's it.
						</h2>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
						<StepCard
							step={1}
							icon={<Layers className="h-5 w-5" />}
							title="Build your form"
							description="Use the drag-and-drop editor or start from a template. Add text, ratings, signatures, and more."
						/>
						<StepCard
							step={2}
							icon={<Globe className="h-5 w-5" />}
							title="Share & collect"
							description="Publish and share via link, QR code, or embed. Respondents don't need an account."
						/>
						<StepCard
							step={3}
							icon={<BarChart3 className="h-5 w-5" />}
							title="Analyze results"
							description="View real-time charts, breakdowns by field, and export to CSV for further analysis."
						/>
					</div>
				</div>
			</section>

			{/* Use Cases */}
			<section className="py-20 sm:py-28 border-t border-gray-100 dark:border-gray-800">
				<div className="mx-auto max-w-6xl px-4 sm:px-6">
					<div className="text-center mb-14">
						<div className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
							<Users className="h-3.5 w-3.5" />
							Use cases
						</div>
						<h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 tracking-tight">
							Built for every team
						</h2>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
						<UseCaseCard
							emoji="⛪"
							title="Churches & Religious Organizations"
							items={['Member registration', 'Sunday attendance tracking', 'Tithe & offering records', 'Event registration']}
						/>
						<UseCaseCard
							emoji="🌍"
							title="Field Data Collection"
							items={['Community health surveys', 'Agricultural assessments', 'Census and population data', 'Research questionnaires']}
						/>
						<UseCaseCard
							emoji="🎓"
							title="Schools & Training"
							items={['Student enrollment', 'Course feedback', 'Exam registration', 'Workshop sign-ups']}
						/>
						<UseCaseCard
							emoji="💼"
							title="Small Businesses"
							items={['Customer feedback', 'Order forms', 'Employee onboarding', 'Inventory checks']}
						/>
					</div>
				</div>
			</section>

			{/* CTA */}
			<section className="py-20 sm:py-28 border-t border-gray-100 dark:border-gray-800">
				<div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
					<div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-600 to-brand-700 p-10 sm:p-16 shadow-xl shadow-brand-600/15">
						{/* Decorative */}
						<div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
						<div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

						<div className="relative">
							<div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
								<Database className="h-7 w-7 text-white" />
							</div>
							<h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight">
								Ready to collect data anywhere?
							</h2>
							<p className="text-brand-200 mb-8 max-w-md mx-auto">
								Create your first form in under 2 minutes. Everything works
								offline from the first click.
							</p>
							<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
								<button
									onClick={() => navigate(isAuthenticated ? 'dashboard' : 'signup')}
									className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-brand-700 shadow-sm transition-smooth hover:bg-brand-50 active:scale-[0.98]"
								>
									{isAuthenticated ? 'Go to Dashboard' : 'Create your first form'}
									<ArrowRight className="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-gray-100 dark:border-gray-800 py-10">
				<div className="mx-auto max-w-6xl px-4 sm:px-6">
					<div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-gray-400">
						<div className="flex items-center gap-2">
							<img src="/logo-icon.png" alt="KoraForms" className="w-6 h-6 rounded-md" />
							<span className="font-semibold text-gray-600 dark:text-gray-300">KoraForms</span>
							<span className="text-gray-300 dark:text-gray-700">|</span>
							<span className="text-xs">Forms that work anywhere</span>
						</div>
						<div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
							<button onClick={() => navigate('/how-it-works')} className="hover:text-gray-600 dark:hover:text-gray-200 transition-smooth">
								How it works
							</button>
							<button onClick={() => navigate('/help')} className="hover:text-gray-600 dark:hover:text-gray-200 transition-smooth">
								Help
							</button>
							<button onClick={() => navigate('/privacy')} className="hover:text-gray-600 dark:hover:text-gray-200 transition-smooth">
								Privacy
							</button>
							<button onClick={() => navigate('/terms')} className="hover:text-gray-600 dark:hover:text-gray-200 transition-smooth">
								Terms
							</button>
						</div>
					</div>
					<div className="mt-6 text-center text-xs text-gray-300 dark:text-gray-700">
						&copy; {new Date().getFullYear()} KoraForms. All rights reserved.
					</div>
				</div>
			</footer>
		</div>
	)
}

function FeatureCard({
	icon,
	title,
	description,
	color,
}: {
	icon: React.ReactNode
	title: string
	description: string
	color: 'brand' | 'sky' | 'amber' | 'violet' | 'emerald' | 'rose'
}) {
	const colorMap = {
		brand: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
		sky: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400',
		amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
		violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
		emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
		rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
	}

	return (
		<div className="group rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-6 transition-all duration-200 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-lg hover:shadow-gray-100/50 dark:hover:shadow-none hover:-translate-y-0.5">
			<div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-smooth group-hover:scale-110 ${colorMap[color]}`}>
				{icon}
			</div>
			<h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
			<p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
		</div>
	)
}

function StepCard({
	step,
	icon,
	title,
	description,
}: {
	step: number
	icon: React.ReactNode
	title: string
	description: string
}) {
	return (
		<div className="text-center">
			<div className="relative inline-flex mb-5">
				<div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
					{icon}
				</div>
				<span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">
					{step}
				</span>
			</div>
			<h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
			<p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
		</div>
	)
}

function UseCaseCard({ emoji, title, items }: { emoji: string; title: string; items: string[] }) {
	return (
		<div className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-6 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md hover:-translate-y-0.5">
			<div className="flex items-center gap-3 mb-4">
				<span className="text-2xl">{emoji}</span>
				<h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
			</div>
			<ul className="space-y-2.5">
				{items.map((item) => (
					<li key={item} className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
						<span className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
							<Check className="h-3 w-3 text-emerald-500" />
						</span>
						{item}
					</li>
				))}
			</ul>
		</div>
	)
}
