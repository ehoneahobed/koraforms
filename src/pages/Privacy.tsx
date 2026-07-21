import { useEffect } from 'react'
import { setPageMeta } from '../utils/meta'

interface Props {
	navigate: (path: string) => void
}

export function Privacy({ navigate }: Props) {
	useEffect(() => {
		setPageMeta({
			title: 'Privacy Policy',
			description: 'How KoraForms collects, stores, and protects your data. Your privacy matters.',
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
						Privacy Policy
					</h1>
					<p className="text-sm text-gray-400 dark:text-gray-500">
						Last updated: July 2026
					</p>
				</div>

				<div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
					<Section title="Overview">
						<p>
							KoraForms is committed to protecting your privacy. This policy explains what data we collect,
							how we use it, and your rights regarding your information.
						</p>
					</Section>

					<Section title="What we collect">
						<ul>
							<li><strong>Account information</strong> — When you create an account, we collect your name, email address, and a hashed password. We never store your password in plain text.</li>
							<li><strong>Form data</strong> — The forms you create and the responses collected through those forms are stored on our servers after syncing from your device.</li>
							<li><strong>Device data</strong> — We generate an anonymous device identifier for offline sync. We do not collect device fingerprints, IP-based location, or browsing history.</li>
						</ul>
					</Section>

					<Section title="How data is stored">
						<p>
							KoraForms uses an offline-first architecture. Your data is stored locally on your device first,
							then synced to our secure servers over encrypted (HTTPS) connections when you are online.
							Data at rest is stored in a PostgreSQL database hosted on reputable cloud infrastructure.
						</p>
					</Section>

					<Section title="Form respondents">
						<p>
							People who fill out your forms do not need to create an account. We assign an anonymous device
							identifier solely for syncing purposes. We do not track respondents across forms or websites.
						</p>
					</Section>

					<Section title="How we use your data">
						<ul>
							<li>To provide and improve the KoraForms service</li>
							<li>To sync your forms and responses across your devices</li>
							<li>To send you important service updates (if you opt in)</li>
						</ul>
						<p>
							We do not sell, rent, or share your personal data with third parties for marketing purposes.
						</p>
					</Section>

					<Section title="Data security">
						<p>
							We use industry-standard security measures including encrypted connections (TLS/HTTPS),
							hashed passwords, and secure cloud hosting. While no system is 100% secure, we take
							reasonable steps to protect your data.
						</p>
					</Section>

					<Section title="Your rights">
						<ul>
							<li><strong>Access</strong> — You can view all your data through the KoraForms dashboard.</li>
							<li><strong>Export</strong> — You can export all responses to CSV at any time.</li>
							<li><strong>Deletion</strong> — You can delete individual forms and responses. To delete your account entirely, contact us.</li>
						</ul>
					</Section>

					<Section title="Cookies">
						<p>
							KoraForms uses only essential cookies required for authentication and session management.
							We do not use tracking cookies, advertising cookies, or third-party analytics.
						</p>
					</Section>

					<Section title="Changes to this policy">
						<p>
							We may update this policy from time to time. When we make significant changes,
							we will notify you through the application or by email.
						</p>
					</Section>

					<Section title="Contact">
						<p>
							If you have questions about this privacy policy or your data, contact us at{' '}
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
