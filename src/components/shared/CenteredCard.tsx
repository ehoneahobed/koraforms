import type { ReactNode } from 'react'

const TONES = {
	brand: 'bg-brand-50 dark:bg-brand-900/25',
	emerald: 'bg-emerald-50 dark:bg-emerald-900/25',
	red: 'bg-red-50 dark:bg-red-900/25',
	slate: 'bg-slate-100 dark:bg-gray-800',
} as const

/** A centered card for account pages (invitations, verification, password reset). */
export function Card({ icon, tone, title, children }: { icon: ReactNode; tone: keyof typeof TONES; title: string; children?: ReactNode }) {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
			<div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center shadow-sm">
				<div className={`mx-auto mb-5 h-14 w-14 rounded-2xl flex items-center justify-center ${TONES[tone]}`}>{icon}</div>
				<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h1>
				{children}
			</div>
		</div>
	)
}
