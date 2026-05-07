import { FileText } from 'lucide-react'

interface Props {
	/** Form slug for UTM tracking */
	slug?: string
	/** 'subtle' for during form fill, 'prominent' for thank-you page */
	variant?: 'subtle' | 'prominent'
}

export function PoweredByBadge({ slug, variant = 'subtle' }: Props) {
	const ref = slug ? `?ref=badge&form=${encodeURIComponent(slug)}` : '?ref=badge'
	const href = `https://koraforms.app${ref}`

	if (variant === 'prominent') {
		return (
			<a
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-smooth group"
			>
				<div className="w-4 h-4 rounded bg-brand-600 flex items-center justify-center shrink-0">
					<FileText className="h-2.5 w-2.5 text-white" />
				</div>
				Made with <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-smooth">KoraForms</span>
			</a>
		)
	}

	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center gap-1.5 text-[10px] text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-smooth"
		>
			<div className="w-3 h-3 rounded-sm bg-gray-300 dark:bg-gray-600 flex items-center justify-center shrink-0">
				<FileText className="h-2 w-2 text-white dark:text-gray-900" />
			</div>
			Made with KoraForms
		</a>
	)
}
