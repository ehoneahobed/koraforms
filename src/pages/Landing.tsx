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
	LayoutTemplate,
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
						<button
							onClick={() => navigate('/templates')}
							className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-smooth hidden sm:block"
						>
							Templates
						</button>
						<button
							onClick={() => navigate('/how-it-works')}
							className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-smooth hidden sm:block"
						>
							How it works
						</button>
						{isAuthenticated ? (
							<button
								onClick={() => navigate('dashboard')}
								className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-smooth hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
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
									className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-smooth hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
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
				<div className="absolute inset-x-0 top-0 h-px bg-slate-100 dark:bg-gray-800" />

				<div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-32 pb-20 sm:pb-28">
					<div className="text-center max-w-3xl mx-auto">
						{/* Badge */}
						<div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 mb-8">
							<WifiOff className="h-3.5 w-3.5" />
							Works offline — no internet required
						</div>

						<h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight text-gray-900 dark:text-gray-100 leading-[1.1] mb-6">
							Build forms that work{' '}
							<span className="text-brand-600 dark:text-brand-400">anywhere</span>
						</h1>

						<p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto mb-10">
							Create beautiful forms and collect data even without internet.
							Responses save locally and sync automatically. Perfect for fieldwork,
							churches, schools, and remote areas.
						</p>

						<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
							<button
								onClick={() => navigate(isAuthenticated ? 'dashboard' : 'signup')}
								className="group inline-flex items-center gap-2.5 rounded-xl bg-slate-950 px-7 py-3.5 text-base font-semibold text-white transition-smooth hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
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

						{/* Stats bar */}
						<div className="flex items-center justify-center gap-8 sm:gap-12 mt-10 pt-10 border-t border-gray-100 dark:border-gray-800">
							<div className="text-center">
								<div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">22</div>
								<div className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">Field types</div>
							</div>
							<div className="w-px h-10 bg-gray-200 dark:bg-gray-700" />
							<div className="text-center">
								<div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">21+</div>
								<div className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">Templates</div>
							</div>
							<div className="w-px h-10 bg-gray-200 dark:bg-gray-700" />
							<div className="text-center">
								<div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">22</div>
								<div className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">Languages</div>
							</div>
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
							description="Start from 21+ templates or build from scratch. Church records, surveys, attendance — ready in minutes."
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

			{/* Templates */}
			<section className="py-20 sm:py-28 border-t border-gray-100 dark:border-gray-800">
				<div className="mx-auto max-w-6xl px-4 sm:px-6">
					<div className="text-center mb-10">
						<h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 tracking-tight">
							21+ ready-made templates
						</h2>
						<p className="text-lg text-gray-500 dark:text-gray-400">
							Start collecting data in seconds with our pre-built templates.
						</p>
					</div>
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
						{[
							{ emoji: '⛪', name: 'Church Registration' },
							{ emoji: '🎉', name: 'Event Registration' },
							{ emoji: '😊', name: 'Customer Satisfaction' },
							{ emoji: '📊', name: 'NPS Survey' },
							{ emoji: '💼', name: 'Job Application' },
							{ emoji: '🎓', name: 'Student Enrollment' },
							{ emoji: '🐛', name: 'Bug Report' },
							{ emoji: '🏥', name: 'Health Screening' },
						].map((template) => (
							<div
								key={template.name}
								className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-elevated-dark px-4 py-3.5 text-center transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm hover:-translate-y-0.5 cursor-default"
							>
								<span className="text-xl block mb-1.5">{template.emoji}</span>
								<span className="text-sm font-medium text-gray-700 dark:text-gray-300">{template.name}</span>
							</div>
						))}
					</div>
					<div className="text-center mt-8">
						<button
							onClick={() => navigate('/templates')}
							className="group inline-flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300 transition-smooth"
						>
							Browse all templates
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
						</button>
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

			{/* Comparison */}
			<section className="py-20 sm:py-28 bg-gray-50 dark:bg-surface-elevated-dark border-t border-gray-100 dark:border-gray-800">
				<div className="mx-auto max-w-4xl px-4 sm:px-6">
					<div className="text-center mb-14">
						<h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 tracking-tight">
							How we compare
						</h2>
						<p className="text-lg text-gray-500 dark:text-gray-400">
							KoraForms gives you more features without the price tag.
						</p>
					</div>
					<div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-elevated-dark shadow-sm">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-gray-100 dark:border-gray-800">
									<th className="px-5 py-4 text-left font-semibold text-gray-900 dark:text-gray-100">Feature</th>
									<th className="px-5 py-4 text-center font-semibold text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-900/10">KoraForms</th>
									<th className="px-5 py-4 text-center font-semibold text-gray-900 dark:text-gray-100">Google Forms</th>
									<th className="px-5 py-4 text-center font-semibold text-gray-900 dark:text-gray-100">Typeform</th>
									<th className="px-5 py-4 text-center font-semibold text-gray-900 dark:text-gray-100">Tally</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100 dark:divide-gray-800">
								<ComparisonRow feature="Unlimited forms" kora="yes" google="yes" typeform="1 per account" tally="yes" />
								<ComparisonRow feature="Unlimited responses" kora="yes" google="yes" typeform="10/mo free" tally="yes" />
								<ComparisonRow feature="Works offline" kora="yes" google="no" typeform="no" tally="no" />
								<ComparisonRow feature="Built-in analytics" kora="yes" google="Basic" typeform="no" tally="no" />
								<ComparisonRow feature="Password protection" kora="yes" google="no" typeform="Pro only" tally="Pro only" />
								<ComparisonRow feature="Custom CSS" kora="yes" google="no" typeform="Pro only" tally="Pro only" />
								<ComparisonRow feature="Conditional logic" kora="yes" google="yes" typeform="yes" tally="yes" />
								<ComparisonRow feature="QR code sharing" kora="yes" google="no" typeform="no" tally="no" />
								<ComparisonRow feature="Save & continue later" kora="yes" google="no" typeform="Pro only" tally="no" />
								<ComparisonRow feature="Email notifications" kora="yes" google="yes" typeform="Pro only" tally="Pro only" />
								<tr className="bg-gray-50/50 dark:bg-gray-800/30">
									<td className="px-5 py-4 font-semibold text-gray-900 dark:text-gray-100">Price</td>
									<td className="px-5 py-4 text-center font-bold text-emerald-600 dark:text-emerald-400 bg-brand-50/50 dark:bg-brand-900/10">Free</td>
									<td className="px-5 py-4 text-center text-gray-600 dark:text-gray-400">Free</td>
									<td className="px-5 py-4 text-center text-gray-600 dark:text-gray-400">$25/mo</td>
									<td className="px-5 py-4 text-center text-gray-600 dark:text-gray-400">$29/mo</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</section>

			{/* CTA */}
			<section className="py-20 sm:py-28 border-t border-gray-100 dark:border-gray-800">
				<div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
					<div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-10 shadow-sm sm:p-16 dark:border-gray-800 dark:bg-white">
						<div className="relative">
							<div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 dark:bg-slate-100">
								<Database className="h-7 w-7 text-white dark:text-slate-500" />
							</div>
							<h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight dark:text-slate-950">
								Ready to collect data anywhere?
							</h2>
							<p className="text-slate-300 mb-8 max-w-md mx-auto dark:text-slate-500">
								Create your first form in under 2 minutes. Everything works
								offline from the first click.
							</p>
							<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
								<button
									onClick={() => navigate(isAuthenticated ? 'dashboard' : 'signup')}
									className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-slate-950 shadow-sm transition-smooth hover:bg-slate-100 active:scale-[0.98] dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
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

function ComparisonRow({
	feature,
	kora,
	google,
	typeform,
	tally,
}: {
	feature: string
	kora: string
	google: string
	typeform: string
	tally: string
}) {
	const renderCell = (value: string, isKora: boolean) => {
		if (value === 'yes') {
			return (
				<span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${isKora ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
					<Check className={`h-3.5 w-3.5 ${isKora ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'}`} />
				</span>
			)
		}
		if (value === 'no') {
			return <span className="text-red-400 dark:text-red-500 font-medium">&times;</span>
		}
		if (value.includes('Pro only')) {
			return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Pro only</span>
		}
		return <span className="text-xs text-gray-500 dark:text-gray-400">{value}</span>
	}

	return (
		<tr>
			<td className="px-5 py-3.5 text-gray-700 dark:text-gray-300">{feature}</td>
			<td className="px-5 py-3.5 text-center bg-brand-50/50 dark:bg-brand-900/10">{renderCell(kora, true)}</td>
			<td className="px-5 py-3.5 text-center">{renderCell(google, false)}</td>
			<td className="px-5 py-3.5 text-center">{renderCell(typeform, false)}</td>
			<td className="px-5 py-3.5 text-center">{renderCell(tally, false)}</td>
		</tr>
	)
}
