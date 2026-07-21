interface Props {
	wordFrequency: { word: string; count: number }[]
	avgLength: number
	responseCount: number
}

export function TextSummary({ wordFrequency, avgLength, responseCount }: Props) {
	const maxCount = wordFrequency.length > 0 ? wordFrequency[0]!.count : 1

	// Color palette for word cloud
	const colors = [
		'text-brand-700 dark:text-brand-300',
		'text-violet-600 dark:text-violet-400',
		'text-emerald-600 dark:text-emerald-400',
		'text-amber-600 dark:text-amber-400',
		'text-rose-600 dark:text-rose-400',
		'text-sky-600 dark:text-sky-400',
	]

	return (
		<div className="space-y-4">
			{/* Stats */}
			<div className="flex gap-4">
				<div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
					<div className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{responseCount}</div>
					<div className="text-[10px] text-gray-400 uppercase tracking-wider">Responses</div>
				</div>
				<div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
					<div className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{avgLength}</div>
					<div className="text-[10px] text-gray-400 uppercase tracking-wider">Avg chars</div>
				</div>
			</div>

			{/* Word cloud */}
			{wordFrequency.length > 0 && (
				<div>
					<p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-3">Word cloud</p>
					<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 py-3 px-2 rounded-lg bg-gray-50/50 dark:bg-gray-800/30 min-h-[80px]">
						{wordFrequency.map(({ word, count }, i) => {
							// Scale font size from 11px to 28px based on frequency
							const ratio = count / maxCount
							const fontSize = Math.round(11 + ratio * 17)
							const fontWeight = ratio > 0.6 ? 700 : ratio > 0.3 ? 600 : 400
							const color = colors[i % colors.length]
							return (
								<span
									key={word}
									className={`inline-block ${color} transition-transform hover:scale-110 cursor-default`}
									style={{
										fontSize: `${fontSize}px`,
										fontWeight,
										lineHeight: 1.3,
									}}
									title={`${word}: ${count} occurrence${count !== 1 ? 's' : ''}`}
								>
									{word}
								</span>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}
