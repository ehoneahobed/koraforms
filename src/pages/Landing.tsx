import {
	FileText,
	Wifi,
	WifiOff,
	Zap,
	BarChart3,
	Shield,
	Globe,
	ArrowRight,
	Check,
	Smartphone,
} from 'lucide-react'

interface Props {
	navigate: (path: string) => void
}

export function Landing({ navigate }: Props) {
	return (
		<div className="min-h-screen bg-white dark:bg-surface-dark">
			{/* Hero */}
			<section className="relative overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-white dark:from-brand-900/20 dark:via-surface-dark dark:to-surface-dark" />
				<div className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-16 sm:pt-24 pb-20 sm:pb-32">
					<div className="text-center max-w-3xl mx-auto">
						<div className="inline-flex items-center gap-2 rounded-full bg-brand-100 dark:bg-brand-900/30 px-3 py-1 text-xs font-medium text-brand-700 dark:text-brand-300 mb-6">
							<WifiOff className="h-3 w-3" />
							Works offline — no internet required
						</div>
						<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-gray-100 leading-[1.1] mb-6">
							Build forms that work{' '}
							<span className="text-brand-600 dark:text-brand-400">anywhere</span>
						</h1>
						<p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto mb-10">
							Create beautiful forms and collect data even without internet.
							Responses save locally and sync automatically when you're back
							online. Perfect for fieldwork, churches, schools, and remote areas.
						</p>
						<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
							<button
								onClick={() => navigate('dashboard')}
								className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-7 py-3.5 text-base font-medium text-white shadow-lg shadow-brand-600/25 transition-smooth hover:bg-brand-500 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98]"
							>
								Start building — it's free
								<ArrowRight className="h-4 w-4" />
							</button>
							<a
								href="https://github.com/ehoneahobed/koraforms"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-7 py-3.5 text-base font-medium text-gray-700 dark:text-gray-300 transition-smooth hover:bg-gray-200 dark:hover:bg-gray-700"
							>
								View on GitHub
							</a>
						</div>
					</div>
				</div>
			</section>

			{/* Features */}
			<section className="py-16 sm:py-24 border-t border-gray-100 dark:border-gray-800">
				<div className="mx-auto max-w-5xl px-4 sm:px-6">
					<div className="text-center mb-12 sm:mb-16">
						<h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
							Why KoraForms?
						</h2>
						<p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
							Built for the real world — where internet isn't always available
							but your work can't stop.
						</p>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						<FeatureCard
							icon={<WifiOff className="h-5 w-5" />}
							title="Offline First"
							description="Create forms, collect responses, and view analytics — all without internet. Data saves to your device instantly."
						/>
						<FeatureCard
							icon={<Wifi className="h-5 w-5" />}
							title="Auto Sync"
							description="When you're back online, everything syncs automatically. No manual export or upload needed."
						/>
						<FeatureCard
							icon={<Zap className="h-5 w-5" />}
							title="Instant Setup"
							description="Start from a template or build from scratch. Church records, surveys, attendance — ready in minutes."
						/>
						<FeatureCard
							icon={<BarChart3 className="h-5 w-5" />}
							title="Built-in Analytics"
							description="See response breakdowns, fill rates, trends over time, and numeric summaries. Export to CSV anytime."
						/>
						<FeatureCard
							icon={<Smartphone className="h-5 w-5" />}
							title="Mobile Ready"
							description="Typeform-style one-question-at-a-time experience on phones. Large touch targets, keyboard navigation."
						/>
						<FeatureCard
							icon={<Shield className="h-5 w-5" />}
							title="Your Data, Your Device"
							description="Data is stored locally on your device first. No data leaves your device until you choose to sync."
						/>
					</div>
				</div>
			</section>

			{/* Use Cases */}
			<section className="py-16 sm:py-24 bg-gray-50 dark:bg-surface-elevated-dark border-t border-gray-100 dark:border-gray-800">
				<div className="mx-auto max-w-5xl px-4 sm:px-6">
					<div className="text-center mb-12">
						<h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
							Built for
						</h2>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
						<UseCaseCard
							title="Churches & Religious Organizations"
							items={[
								'Member registration',
								'Sunday attendance tracking',
								'Tithe & offering records',
								'Event registration',
							]}
						/>
						<UseCaseCard
							title="Field Data Collection"
							items={[
								'Community health surveys',
								'Agricultural assessments',
								'Census and population data',
								'Research questionnaires',
							]}
						/>
						<UseCaseCard
							title="Schools & Training"
							items={[
								'Student enrollment',
								'Course feedback',
								'Exam registration',
								'Workshop sign-ups',
							]}
						/>
						<UseCaseCard
							title="Small Businesses"
							items={[
								'Customer feedback',
								'Order forms',
								'Employee onboarding',
								'Inventory checks',
							]}
						/>
					</div>
				</div>
			</section>

			{/* CTA */}
			<section className="py-16 sm:py-24 border-t border-gray-100 dark:border-gray-800">
				<div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
					<div className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mx-auto mb-6">
						<Globe className="h-7 w-7 text-brand-500" />
					</div>
					<h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
						Ready to collect data anywhere?
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mb-8 max-w-lg mx-auto">
						No sign-up required. Start building forms right now — everything works
						offline from the first click.
					</p>
					<button
						onClick={() => navigate('dashboard')}
						className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-brand-600/25 transition-smooth hover:bg-brand-500 active:scale-[0.98]"
					>
						Create your first form
						<ArrowRight className="h-4 w-4" />
					</button>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-gray-100 dark:border-gray-800 py-8">
				<div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
					<div className="flex items-center gap-2">
						<div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center">
							<FileText className="h-3 w-3 text-white" />
						</div>
						<span className="font-medium text-gray-600 dark:text-gray-300">KoraForms</span>
					</div>
					<div className="flex items-center gap-4">
						<a
							href="https://github.com/ehoneahobed/koraforms"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
						>
							GitHub
						</a>
						<span>
							Built with{' '}
							<a
								href="https://github.com/ehoneahobed/kora"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:text-gray-600 dark:hover:text-gray-200 transition-smooth"
							>
								Kora.js
							</a>
						</span>
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
}: {
	icon: React.ReactNode
	title: string
	description: string
}) {
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-6 transition-smooth hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm">
			<div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-500 mb-4">
				{icon}
			</div>
			<h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
			<p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
		</div>
	)
}

function UseCaseCard({ title, items }: { title: string; items: string[] }) {
	return (
		<div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark p-6">
			<h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>
			<ul className="space-y-2">
				{items.map((item) => (
					<li key={item} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
						<Check className="h-4 w-4 text-brand-500 shrink-0" />
						{item}
					</li>
				))}
			</ul>
		</div>
	)
}
