import { useEffect, useState } from 'react'
import { setPageMeta } from '../utils/meta'
import { ChevronDown } from 'lucide-react'

interface Props {
	navigate: (path: string) => void
}

const FAQS: { question: string; answer: string }[] = [
	{
		question: 'Is KoraForms really free?',
		answer: 'Yes, KoraForms is completely free to use. You can create unlimited forms, collect unlimited responses, and access all features at no cost.',
	},
	{
		question: 'How does offline mode work?',
		answer: 'When you or your respondents don\'t have internet, data is saved locally on the device. When connectivity returns, everything syncs automatically to the server. No data is ever lost.',
	},
	{
		question: 'Do respondents need an account?',
		answer: 'No. Anyone with the form link can fill it out without creating an account or signing in. Only form creators need an account.',
	},
	{
		question: 'What types of fields can I add?',
		answer: 'KoraForms supports text (short and long), multiple choice, checkboxes, dropdown selects, email, phone number, URL, number, date, rating scales, and signature capture.',
	},
	{
		question: 'Can I export my data?',
		answer: 'Yes. You can export all responses for any form to CSV format with one click, which can be opened in Excel, Google Sheets, or any spreadsheet application.',
	},
	{
		question: 'How do I share my form?',
		answer: 'Once you publish a form, you get a shareable link and QR code. You can share the link via messaging apps, email, or social media. Respondents open it in any browser.',
	},
	{
		question: 'Is my data secure?',
		answer: 'Data is stored locally on your device first, then synced to our secure servers over encrypted connections. Only you can see your form responses.',
	},
	{
		question: 'Can I customize the look of my forms?',
		answer: 'Yes. Each form can have its own color theme chosen from 12+ preset options. The form fill experience is a modern, mobile-friendly one-question-at-a-time layout.',
	},
	{
		question: 'What browsers are supported?',
		answer: 'KoraForms works in all modern browsers including Chrome, Firefox, Safari, and Edge on both desktop and mobile devices.',
	},
	{
		question: 'Can multiple people use the same account?',
		answer: 'Each person should create their own account. Your forms and responses are scoped to your account and are not visible to other users.',
	},
]

const GUIDES = [
	{
		title: 'Creating your first form',
		steps: [
			'Sign up for a free account or sign in',
			'Click "New Form" on the dashboard',
			'Choose a template or start blank',
			'Add your fields — text, multiple choice, ratings, etc.',
			'Click "Publish" when ready',
			'Share the link with your respondents',
		],
	},
	{
		title: 'Viewing and exporting responses',
		steps: [
			'Go to your dashboard and find the form',
			'Click "Responses" to see all submissions',
			'View summary charts and field-by-field breakdowns',
			'Click "Export CSV" to download all data as a spreadsheet',
		],
	},
	{
		title: 'Using templates',
		steps: [
			'Click "New Form" and browse the template categories',
			'Choose from Church, Events, Surveys, Education, and more',
			'The template pre-fills the form with relevant fields',
			'Customize the title, description, and fields as needed',
			'Publish and share when ready',
		],
	},
]

export function Help({ navigate }: Props) {
	useEffect(() => {
		setPageMeta({
			title: 'Help & Getting Started',
			description: 'Learn how to use KoraForms. Guides, FAQs, and tips for creating forms and collecting data.',
		})
	}, [])

	const [openFaq, setOpenFaq] = useState<number | null>(null)

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
						className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-full hover:bg-brand-500 transition-all duration-200"
					>
						Get started free
					</button>
				</div>
			</nav>

			<div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 sm:py-24">
				<div className="text-center mb-16">
					<h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-4">
						Help Center
					</h1>
					<p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
						Everything you need to get started with KoraForms.
					</p>
				</div>

				{/* Quick start guides */}
				<section className="mb-20">
					<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 tracking-tight">
						Quick Start Guides
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						{GUIDES.map((guide) => (
							<div
								key={guide.title}
								className="rounded-2xl bg-gray-50/80 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800/40 p-5"
							>
								<h3 className="font-semibold text-[15px] text-gray-900 dark:text-gray-100 mb-3">
									{guide.title}
								</h3>
								<ol className="space-y-2">
									{guide.steps.map((step, i) => (
										<li key={i} className="flex gap-2.5 text-sm text-gray-500 dark:text-gray-400">
											<span className="shrink-0 w-5 h-5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-bold flex items-center justify-center mt-0.5">
												{i + 1}
											</span>
											<span className="leading-relaxed">{step}</span>
										</li>
									))}
								</ol>
							</div>
						))}
					</div>
				</section>

				{/* FAQ */}
				<section>
					<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 tracking-tight">
						Frequently Asked Questions
					</h2>
					<div className="divide-y divide-gray-100 dark:divide-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800/40 bg-white dark:bg-surface-elevated-dark overflow-hidden">
						{FAQS.map((faq, i) => (
							<button
								key={i}
								onClick={() => setOpenFaq(openFaq === i ? null : i)}
								className="w-full text-left px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors duration-150"
							>
								<div className="flex items-center justify-between gap-4">
									<span className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
										{faq.question}
									</span>
									<ChevronDown
										className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
											openFaq === i ? 'rotate-180' : ''
										}`}
									/>
								</div>
								{openFaq === i && (
									<p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed pr-8">
										{faq.answer}
									</p>
								)}
							</button>
						))}
					</div>
				</section>

				{/* Contact */}
				<section className="mt-16 text-center">
					<p className="text-sm text-gray-400 dark:text-gray-500">
						Still have questions?{' '}
						<a
							href="mailto:support@korajs.dev"
							className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
						>
							Contact us
						</a>
					</p>
				</section>
			</div>
		</div>
	)
}
