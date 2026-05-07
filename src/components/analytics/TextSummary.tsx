interface Props {
	wordFrequency: { word: string; count: number }[]
	avgLength: number
	responseCount: number
}

export function TextSummary({ wordFrequency, avgLength, responseCount }: Props) {
	const maxCount = wordFrequency.length > 0 ? wordFrequency[0]!.count : 1

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

			{/* Word cloud (simple tag layout) */}
			{wordFrequency.length > 0 && (
				<div>
					<p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">Common words</p>
					<div className="flex flex-wrap gap-1.5">
						{wordFrequency.map(({ word, count }) => {
							const intensity = 0.3 + (count / maxCount) * 0.7
							return (
								<span
									key={word}
									className="inline-flex items-center gap-1 rounded-md bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 text-xs"
									style={{ opacity: intensity }}
								>
									<span className="text-brand-700 dark:text-brand-300">{word}</span>
									<span className="text-brand-400 dark:text-brand-500 tabular-nums">{count}</span>
								</span>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}
