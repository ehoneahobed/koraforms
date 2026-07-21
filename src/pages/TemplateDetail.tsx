import { useEffect } from 'react'
import { ArrowLeft, ArrowRight, Clock, FileText, Hash, Sparkles } from 'lucide-react'
import { FORM_TEMPLATES } from '../templates'
import { setPageMeta } from '../utils/meta'
import { useAuth } from '@korajs/auth/react'
import { PoweredByBadge } from '../components/shared/PoweredByBadge'

interface TemplateDetailProps {
	templateKey: string
	navigate: (path: string) => void
}

const FIELD_TYPE_LABELS: Record<string, { label: string; color: string }> = {
	text: { label: 'Short Text', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
	textarea: { label: 'Long Text', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
	email: { label: 'Email', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
	phone: { label: 'Phone', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
	number: { label: 'Number', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
	date: { label: 'Date', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
	time: { label: 'Time', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
	url: { label: 'URL', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
	select: { label: 'Dropdown', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' },
	radio: { label: 'Multiple Choice', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' },
	checkbox: { label: 'Checkboxes', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' },
	rating: { label: 'Rating', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
	scale: { label: 'Scale', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
	yesno: { label: 'Yes/No', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
	section: { label: 'Section', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
	statement: { label: 'Statement', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
	signature: { label: 'Signature', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
	file: { label: 'File Upload', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
	ranking: { label: 'Ranking', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
	matrix: { label: 'Matrix', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
	calculated: { label: 'Calculated', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
	hidden: { label: 'Hidden', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

function estimateCompletionTime(fieldCount: number): string {
	// Roughly 20 seconds per field, rounded to nearest minute
	const minutes = Math.max(1, Math.round((fieldCount * 20) / 60))
	return minutes === 1 ? '~1 minute' : `~${minutes} minutes`
}

export function TemplateDetail({ templateKey, navigate }: TemplateDetailProps) {
	const { isAuthenticated } = useAuth()
	const template = FORM_TEMPLATES[templateKey]

	useEffect(() => {
		if (template) {
			setPageMeta({
				title: `${template.title} — Free Form Template | KoraForms`,
				description: `Create a ${template.title.toLowerCase()} in seconds. ${template.description} Free, offline-first form builder.`,
				url: `https://forms.korajs.dev/templates/${templateKey}`,
			})
		} else {
			setPageMeta({
				title: 'Template Not Found',
				description: 'This template could not be found.',
			})
		}
	}, [template, templateKey])

	if (!template) {
		return (
			<div className="min-h-screen bg-white dark:bg-surface-dark">
				<NavBar navigate={navigate} isAuthenticated={isAuthenticated} />
				<div className="mx-auto max-w-3xl px-4 sm:px-6 py-32 text-center animate-fade-in">
					<div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-6">
						<FileText className="h-9 w-9 text-gray-300 dark:text-gray-600" />
					</div>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
						Template not found
					</h1>
					<p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
						The template you're looking for doesn't exist or may have been removed.
					</p>
					<button
						onClick={() => navigate('/templates')}
						className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-500 transition-smooth shadow-sm shadow-brand-600/25 active:scale-[0.98]"
					>
						<ArrowLeft className="h-4 w-4" />
						Browse all templates
					</button>
				</div>
			</div>
		)
	}

	const inputFields = template.fields.filter(f => f.type !== 'section' && f.type !== 'statement')
	const requiredCount = inputFields.filter(f => f.required).length

	return (
		<div className="min-h-screen bg-white dark:bg-surface-dark">
			{/* Navigation */}
			<NavBar navigate={navigate} isAuthenticated={isAuthenticated} />

			{/* Hero */}
			<section className="relative overflow-hidden border-b border-gray-100 dark:border-gray-800">
				<div className="absolute inset-0 bg-gradient-to-b from-brand-50/80 via-white to-white dark:from-brand-900/10 dark:via-surface-dark dark:to-surface-dark" />
				<div className="absolute top-10 left-1/4 w-72 h-72 bg-brand-200/20 dark:bg-brand-800/10 rounded-full blur-3xl" />
				<div className="absolute top-20 right-1/4 w-96 h-96 bg-violet-200/15 dark:bg-violet-800/10 rounded-full blur-3xl" />

				<div className="relative mx-auto max-w-4xl px-4 sm:px-6 pt-12 sm:pt-16 pb-12 sm:pb-16">
					<button
						onClick={() => navigate('/templates')}
						className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6 transition-smooth"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to templates
					</button>

					<div className="flex items-center gap-2 mb-3">
						<Sparkles className="h-4 w-4 text-brand-500 dark:text-brand-400" />
						<span className="text-xs font-semibold text-brand-600 dark:text-brand-400 tracking-wide uppercase">
							Free Template
						</span>
					</div>

					<h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight mb-4">
						{template.title}
					</h1>
					<p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl mb-8">
						{template.description}
					</p>

					<button
						onClick={() => navigate(isAuthenticated ? `/forms/new/edit?template=${templateKey}` : '/signup')}
						className="group inline-flex items-center gap-2.5 rounded-xl bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition-smooth hover:bg-brand-500 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98]"
					>
						{isAuthenticated ? 'Use this template' : 'Get started with this template'}
						<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
					</button>
				</div>
			</section>

			{/* Content */}
			<section className="mx-auto max-w-4xl px-4 sm:px-6 py-12 sm:py-16">
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{/* Field list — main content */}
					<div className="lg:col-span-2">
						<div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark overflow-hidden shadow-sm">
							{/* Card header */}
							<div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
								<span className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
									Form Fields Preview
								</span>
								<span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-full px-2.5 py-0.5">
									{template.fields.length} field{template.fields.length !== 1 ? 's' : ''}
								</span>
							</div>

							{/* Field list */}
							<div className="px-6 py-4">
								<div className="space-y-3">
									{template.fields.map((field, index) => {
										const display = FIELD_TYPE_LABELS[field.type] || {
											label: field.type,
											color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
										}
										const hasOptions = (field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && field.options
										const options = hasOptions ? field.options!.split(',').map(o => o.trim()) : []

										return (
											<div
												key={field.id}
												className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 transition-smooth hover:bg-gray-100/80 dark:hover:bg-gray-800/70"
											>
												<div className="flex items-start gap-3">
													{/* Field number */}
													<span className="flex-shrink-0 w-7 h-7 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-gray-500">
														{index + 1}
													</span>

													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2 mb-1.5">
															{/* Field type badge */}
															<span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 flex-shrink-0 ${display.color}`}>
																{display.label}
															</span>
															{/* Required indicator */}
															{field.required && (
																<span className="text-[10px] font-semibold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-full px-2 py-0.5">
																	Required
																</span>
															)}
														</div>
														{/* Field label */}
														<p className="text-sm font-medium text-gray-800 dark:text-gray-200">
															{field.label}
														</p>

														{/* Options pills for select/radio/checkbox */}
														{hasOptions && options.length > 0 && (
															<div className="flex flex-wrap gap-1.5 mt-2.5">
																{options.map((option) => (
																	<span
																		key={option}
																		className="text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1"
																	>
																		{option}
																	</span>
																))}
															</div>
														)}
													</div>
												</div>
											</div>
										)
									})}
								</div>
							</div>
						</div>
					</div>

					{/* Sidebar — template info */}
					<div className="lg:col-span-1">
						<div className="sticky top-20 space-y-6">
							{/* Stats card */}
							<div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark overflow-hidden shadow-sm">
								<div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
									<span className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
										Template Info
									</span>
								</div>
								<div className="px-5 py-4 space-y-4">
									<div className="flex items-center gap-3">
										<div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0">
											<Hash className="h-4 w-4 text-brand-600 dark:text-brand-400" />
										</div>
										<div>
											<p className="text-xs text-gray-400 dark:text-gray-500">Total Fields</p>
											<p className="text-sm font-semibold text-gray-900 dark:text-white">
												{template.fields.length} field{template.fields.length !== 1 ? 's' : ''}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-3">
										<div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
											<FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
										</div>
										<div>
											<p className="text-xs text-gray-400 dark:text-gray-500">Required Fields</p>
											<p className="text-sm font-semibold text-gray-900 dark:text-white">
												{requiredCount} of {inputFields.length}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-3">
										<div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0">
											<Clock className="h-4 w-4 text-violet-600 dark:text-violet-400" />
										</div>
										<div>
											<p className="text-xs text-gray-400 dark:text-gray-500">Est. Completion</p>
											<p className="text-sm font-semibold text-gray-900 dark:text-white">
												{estimateCompletionTime(inputFields.length)}
											</p>
										</div>
									</div>
								</div>
							</div>

							{/* CTA card */}
							<div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-6 shadow-lg shadow-brand-600/10 overflow-hidden relative">
								<div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
								<div className="relative">
									<h3 className="text-base font-bold text-white mb-2">
										Ready to use this template?
									</h3>
									<p className="text-sm text-brand-200 mb-5 leading-relaxed">
										{isAuthenticated
											? 'Start collecting responses in minutes. Fully customizable.'
											: 'Sign up for free and start collecting responses in minutes.'
										}
									</p>
									<button
										onClick={() => navigate(isAuthenticated ? `/forms/new/edit?template=${templateKey}` : '/signup')}
										className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-700 shadow-sm transition-smooth hover:bg-brand-50 active:scale-[0.98]"
									>
										{isAuthenticated ? 'Use this template' : 'Get started free'}
										<ArrowRight className="h-4 w-4" />
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Bottom CTA */}
			<section className="border-t border-gray-100 dark:border-gray-800 py-16 sm:py-20">
				<div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
					<h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4 tracking-tight">
						Start collecting data today
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
						Use this template as a starting point, then customize it to fit your exact needs. Works offline from the first click.
					</p>
					<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
						<button
							onClick={() => navigate(isAuthenticated ? `/forms/new/edit?template=${templateKey}` : '/signup')}
							className="group inline-flex items-center gap-2.5 rounded-xl bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition-smooth hover:bg-brand-500 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98]"
						>
							{isAuthenticated ? 'Use this template' : 'Get started free'}
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
						</button>
						<button
							onClick={() => navigate('/templates')}
							className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-7 py-3.5 text-base font-medium text-gray-700 dark:text-gray-300 transition-smooth hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
						>
							Browse all templates
						</button>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-gray-100 dark:border-gray-800 py-10">
				<div className="mx-auto max-w-6xl px-4 sm:px-6">
					<div className="flex flex-col items-center gap-6">
						<PoweredByBadge variant="prominent" />
						<div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
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
						<div className="text-xs text-gray-300 dark:text-gray-700">
							&copy; {new Date().getFullYear()} KoraForms. All rights reserved.
						</div>
					</div>
				</div>
			</footer>
		</div>
	)
}

function NavBar({ navigate, isAuthenticated }: { navigate: (path: string) => void; isAuthenticated: boolean }) {
	return (
		<nav className="sticky top-0 z-40 border-b border-gray-100/50 dark:border-gray-800/50 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-14">
				<button
					onClick={() => navigate('/')}
					className="flex items-center gap-2.5"
				>
					<img src="/logo-icon.png" alt="KoraForms" className="w-8 h-8 rounded-lg" />
					<span className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">KoraForms</span>
				</button>
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
							onClick={() => navigate('/dashboard')}
							className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 transition-smooth shadow-sm shadow-brand-600/25"
						>
							Dashboard
						</button>
					) : (
						<>
							<button
								onClick={() => navigate('/signin')}
								className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-smooth"
							>
								Sign in
							</button>
							<button
								onClick={() => navigate('/signup')}
								className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 transition-smooth shadow-sm shadow-brand-600/25"
							>
								Get started
							</button>
						</>
					)}
				</div>
			</div>
		</nav>
	)
}
