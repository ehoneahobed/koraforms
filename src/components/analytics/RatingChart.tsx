import { Star } from 'lucide-react'

interface Props {
	distribution: number[]
	average: number
}

export function RatingChart({ distribution, average }: Props) {
	const total = distribution.reduce((a, b) => a + b, 0) || 1

	return (
		<div className="flex flex-col sm:flex-row gap-6">
			{/* Average display */}
			<div className="flex flex-col items-center justify-center shrink-0">
				<span className="text-4xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
					{average.toFixed(1)}
				</span>
				<div className="flex gap-0.5 mt-1">
					{Array.from({ length: 5 }, (_, i) => (
						<Star
							key={i}
							className={`h-4 w-4 ${i < Math.round(average) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-gray-700'}`}
						/>
					))}
				</div>
				<span className="text-xs text-gray-400 mt-1">{total} ratings</span>
			</div>

			{/* Distribution bars */}
			<div className="flex-1 space-y-1.5">
				{distribution.map((count, i) => {
					const starNum = i + 1
					const pct = Math.round((count / total) * 100)
					return (
						<div key={starNum} className="flex items-center gap-2">
							<span className="text-xs text-gray-500 dark:text-gray-400 w-4 text-right tabular-nums">
								{starNum}
							</span>
							<Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
							<div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
								<div
									className="h-full rounded-full bg-amber-400 transition-all duration-500"
									style={{ width: `${pct}%`, minWidth: count > 0 ? '4px' : '0' }}
								/>
							</div>
							<span className="text-xs text-gray-400 tabular-nums w-8">{count}</span>
						</div>
					)
				}).reverse()}
			</div>
		</div>
	)
}
