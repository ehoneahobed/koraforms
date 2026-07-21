import { useEffect } from 'react'
import { setPageMeta } from '../utils/meta'

interface Props {
	navigate: (path: string) => void
}

export function Terms({ navigate }: Props) {
	useEffect(() => {
		setPageMeta({
			title: 'Terms of Service',
			description: 'Terms and conditions for using KoraForms.',
		})
	}, [])

	return (
		<div className="min-h-screen bg-white dark:bg-surface-dark">
			{/* Nav */}
			<nav className="sticky top-0 z-40 border-b border-gray-100 dark:border-gray-800/60 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl">
				<div className="mx-auto max-w-4xl px-4 sm:px-6 flex items-center justify-between h-12">
					<button onClick={() => navigate('')} className="flex items-center gap-2 hover:opacity-80 transition-all duration-200">
						<img src="/logo-icon.png" alt="KoraForms" className="w-7 h-7 rounded-lg" />
						<span className="text-[15px] font-semibold tracking-tight">KoraForms</span>
					</button>
					<button
						onClick={() => navigate('signup')}
						className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-gray-200"
					>
						Get started free
					</button>
				</div>
			</nav>

			<div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24">
				<div className="mb-12">
					<h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-4">
						Terms of Service
					</h1>
					<p className="text-sm text-gray-400 dark:text-gray-500">
						Last updated: July 2026
					</p>
				</div>

				<div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
					<Section title="1. Acceptance of terms">
						<p>
							By accessing or using KoraForms, you agree to be bound by these Terms of Service.
							If you do not agree, please do not use the service.
						</p>
					</Section>

					<Section title="2. Description of service">
						<p>
							KoraForms is a web-based form builder that allows you to create forms, collect responses,
							and analyze data. The service includes offline-first functionality that stores data locally
							on your device and syncs to our servers when connected.
						</p>
					</Section>

					<Section title="3. Account registration">
						<p>
							To create and manage forms, you must register for an account. You are responsible for
							maintaining the security of your account credentials and for all activity under your account.
							Form respondents do not need an account.
						</p>
					</Section>

					<Section title="4. Your data">
						<p>
							You retain ownership of all content you create on KoraForms, including form definitions
							and collected responses. We do not claim any intellectual property rights over your data.
						</p>
						<p>
							You grant us a limited license to store, process, and display your data solely to provide
							and improve the service.
						</p>
					</Section>

					<Section title="5. Acceptable use">
						<p>You agree not to use KoraForms to:</p>
						<ul>
							<li>Collect data in violation of applicable laws or regulations</li>
							<li>Distribute spam, malware, or harmful content</li>
							<li>Impersonate another person or entity</li>
							<li>Attempt to gain unauthorized access to other users' data</li>
							<li>Overload or interfere with the service infrastructure</li>
						</ul>
					</Section>

					<Section title="6. Service availability">
						<p>
							We strive to keep KoraForms available at all times, but we do not guarantee uninterrupted
							access. The offline-first design means you can continue working even when the server
							is temporarily unavailable.
						</p>
					</Section>

					<Section title="7. Free tier">
						<p>
							KoraForms is currently offered free of charge. We reserve the right to introduce paid plans
							in the future, but existing free functionality will remain available.
						</p>
					</Section>

					<Section title="8. Termination">
						<p>
							You may stop using KoraForms at any time. We may suspend or terminate your account if you
							violate these terms. Upon termination, your right to use the service ceases, but you may
							export your data before account deletion.
						</p>
					</Section>

					<Section title="9. Limitation of liability">
						<p>
							KoraForms is provided "as is" without warranties of any kind. To the maximum extent
							permitted by law, we are not liable for any indirect, incidental, or consequential
							damages arising from your use of the service.
						</p>
					</Section>

					<Section title="10. Changes to terms">
						<p>
							We may update these terms from time to time. Continued use of KoraForms after changes
							constitutes acceptance of the updated terms.
						</p>
					</Section>

					<Section title="Contact">
						<p>
							Questions about these terms? Contact us at{' '}
							<a href="mailto:support@korajs.dev" className="text-brand-600 dark:text-brand-400 hover:underline">
								support@korajs.dev
							</a>.
						</p>
					</Section>
				</div>
			</div>
		</div>
	)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section>
			<h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">{title}</h2>
			<div className="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed space-y-3">
				{children}
			</div>
		</section>
	)
}
