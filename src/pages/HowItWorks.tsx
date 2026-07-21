import { useEffect } from 'react'
import { setPageMeta } from '../utils/meta'
import {
	FileText,
	Globe,
	BarChart3,
	WifiOff,
	Wifi,
	Smartphone,
	Share2,
	Download,
	ArrowRight,
} from 'lucide-react'

interface Props {
	navigate: (path: string) => void
}

export function HowItWorks({ navigate }: Props) {
	useEffect(() => {
		setPageMeta({
			title: 'How It Works',
			description: 'Learn how to create forms, collect responses offline, and analyze results with KoraForms.',
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

			<div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 sm:py-24">
				{/* Hero */}
				<div className="text-center mb-20">
					<h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-4">
						How KoraForms Works
					</h1>
					<p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
						Create forms in minutes, share them with anyone, and collect responses
						even without internet. Here's everything you need to know.
					</p>
				</div>

				{/* Steps */}
				<div className="space-y-20">
					<Step
						number={1}
						title="Create your form"
						description="Start from one of our 21+ templates or build from scratch. Add text fields, multiple choice, ratings, signatures, and more. Customize the look with your brand colors."
						features={[
							{ icon: <FileText className="h-4 w-4" />, text: 'Drag-and-drop form builder' },
							{ icon: <Smartphone className="h-4 w-4" />, text: 'Mobile-optimized one-question-at-a-time layout' },
						]}
					/>

					<Step
						number={2}
						title="Share with anyone"
						description="Publish your form and share it via link or QR code. Respondents don't need an account — they just open the link and start filling out the form on any device."
						features={[
							{ icon: <Share2 className="h-4 w-4" />, text: 'Share via link, QR code, or embed' },
							{ icon: <Globe className="h-4 w-4" />, text: 'Works on any device with a browser' },
						]}
					/>

					<Step
						number={3}
						title="Collect responses — even offline"
						description="Responses are saved instantly. When you're in the field without internet, data is stored locally on the device and syncs automatically when connectivity returns. No data is ever lost."
						features={[
							{ icon: <WifiOff className="h-4 w-4" />, text: 'Full offline support — no internet needed' },
							{ icon: <Wifi className="h-4 w-4" />, text: 'Auto-sync when back online' },
						]}
					/>

					<Step
						number={4}
						title="Analyze and export"
						description="View response summaries, field-by-field breakdowns, and trends over time. Export your data to CSV for use in spreadsheets, reports, or other tools."
						features={[
							{ icon: <BarChart3 className="h-4 w-4" />, text: 'Built-in charts and analytics' },
							{ icon: <Download className="h-4 w-4" />, text: 'One-click CSV export' },
						]}
					/>
				</div>

				{/* CTA */}
				<div className="text-center mt-24 pt-16 border-t border-gray-100 dark:border-gray-800">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">
						Ready to get started?
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mb-8">
						Create your first form in under 2 minutes. It's completely free.
					</p>
					<button
						onClick={() => navigate('signup')}
						className="inline-flex items-center gap-2 rounded-full bg-slate-950 pl-6 pr-7 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md active:scale-[0.97] dark:bg-white dark:text-slate-950 dark:hover:bg-gray-200"
					>
						Create your first form
						<ArrowRight className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	)
}

function Step({
	number,
	title,
	description,
	features,
}: {
	number: number
	title: string
	description: string
	features: { icon: React.ReactNode; text: string }[]
}) {
	return (
		<div className="flex gap-6 sm:gap-10">
			<div className="shrink-0 pt-1">
				<div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
					{number}
				</div>
			</div>
			<div>
				<h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">
					{title}
				</h3>
				<p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-4 max-w-xl">
					{description}
				</p>
				<div className="flex flex-col sm:flex-row gap-3">
					{features.map((f) => (
						<div key={f.text} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
							<span className="text-slate-400">{f.icon}</span>
							{f.text}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
