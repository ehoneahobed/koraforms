import { useEffect, useState, type CSSProperties } from 'react'
import { Check, Copy } from 'lucide-react'
import { PoweredByBadge } from '../shared/PoweredByBadge'
import { getPublicOfflineDiagnostics } from '../../features/form-fill/offlineRuntime'
import { copyToClipboard } from '../../utils/clipboard'

// Custom thank-you screen with redirect support
export function SubmittedScreen({
	themeVars,
	customMessage,
	redirectUrl,
	redirectDelay,
	allowMultiple,
	showResultsLink,
	formSlug,
	submissionStatus = 'accepted',
	pendingOfflineSubmissions = 0,
	rejectedOfflineSubmissions = 0,
	onReset,
}: {
	themeVars: Record<string, string>
	customMessage?: string
	redirectUrl?: string
	redirectDelay: number
	allowMultiple: boolean
	showResultsLink?: boolean
	formSlug: string
	submissionStatus?: 'accepted' | 'queued'
	pendingOfflineSubmissions?: number
	rejectedOfflineSubmissions?: number
	onReset: () => void
}) {
	const [countdown, setCountdown] = useState(redirectDelay)
	const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
	const isQueued = submissionStatus === 'queued'

	const copyDiagnostics = async () => {
		try {
			const diagnostics = await getPublicOfflineDiagnostics()
			const copied = await copyToClipboard(JSON.stringify(diagnostics, null, 2))
			setCopyState(copied ? 'copied' : 'failed')
		} catch {
			setCopyState('failed')
		}
	}

	useEffect(() => {
		if (!redirectUrl || isQueued) return
		if (countdown <= 0) {
			window.location.href = redirectUrl
			return
		}
		const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
		return () => clearTimeout(timer)
	}, [countdown, isQueued, redirectUrl])

	return (
		<div className="flex items-center justify-center min-h-screen px-4 overflow-hidden" style={themeVars as CSSProperties}>
			{/* Confetti burst */}
			<Confetti />

			<div className="text-center animate-scale-in max-w-md relative z-10">
				<div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-6 animate-bounce-once">
					<Check className="h-8 w-8 text-emerald-500" strokeWidth={2.5} />
				</div>
				<h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
					{customMessage && !isQueued ? '' : isQueued ? 'Saved on this device' : 'Thank you!'}
				</h2>
				{isQueued ? (
					<p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
						Your response is complete and will sync automatically when this device is back online.
						{pendingOfflineSubmissions > 0 ? ` ${pendingOfflineSubmissions} response${pendingOfflineSubmissions === 1 ? '' : 's'} waiting to sync.` : ''}
						{rejectedOfflineSubmissions > 0 ? ` ${rejectedOfflineSubmissions} response${rejectedOfflineSubmissions === 1 ? '' : 's'} needs review.` : ''}
					</p>
				) : customMessage ? (
					<p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed whitespace-pre-line">
						{customMessage}
					</p>
				) : (
					<p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
						Your response has been submitted successfully.
					</p>
				)}
				{redirectUrl && !isQueued && (
					<p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
						Redirecting in {countdown}...
					</p>
				)}
				<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
					{allowMultiple && (
						<button
							onClick={onReset}
							className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-medium text-white transition-smooth hover:bg-brand-500 active:scale-[0.98]"
						>
							Submit another response
						</button>
					)}
					{showResultsLink && !isQueued && (
						<a
							href={`/f/${formSlug}/results`}
							className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 px-6 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 transition-smooth hover:border-gray-300 active:scale-[0.98]"
						>
							View results
						</a>
					)}
					{redirectUrl && !isQueued && (
						<a
							href={redirectUrl}
							className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 px-6 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 transition-smooth hover:border-gray-300 active:scale-[0.98]"
						>
							Continue now
						</a>
					)}
					{isQueued && (
						<button
							onClick={copyDiagnostics}
							className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 px-5 py-3 text-sm font-medium text-gray-500 transition-smooth hover:border-gray-300 hover:text-gray-700 active:scale-[0.98] dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200"
						>
							<Copy className="h-4 w-4" />
							{copyState === 'copied' ? 'Diagnostics copied' : copyState === 'failed' ? 'Copy unavailable' : 'Copy diagnostics'}
						</button>
					)}
				</div>
				<div className="mt-10">
					<PoweredByBadge slug={formSlug} variant="prominent" />
				</div>
			</div>
		</div>
	)
}

// Lightweight confetti animation using CSS
function Confetti() {
	const [particles] = useState(() => {
		const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']
		return Array.from({ length: 40 }, (_, i) => ({
			id: i,
			color: colors[i % colors.length]!,
			left: Math.random() * 100,
			delay: Math.random() * 0.6,
			duration: 1.5 + Math.random() * 1.5,
			size: 4 + Math.random() * 6,
			rotation: Math.random() * 360,
			drift: (Math.random() - 0.5) * 60,
		}))
	})

	return (
		<div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
			{particles.map(p => (
				<div
					key={p.id}
					className="absolute animate-confetti-fall"
					style={{
						left: `${p.left}%`,
						top: '-10px',
						width: `${p.size}px`,
						height: `${p.size * 0.6}px`,
						backgroundColor: p.color,
						borderRadius: '2px',
						animationDelay: `${p.delay}s`,
						animationDuration: `${p.duration}s`,
						transform: `rotate(${p.rotation}deg)`,
						'--confetti-drift': `${p.drift}px`,
					} as CSSProperties}
				/>
			))}
		</div>
	)
}
