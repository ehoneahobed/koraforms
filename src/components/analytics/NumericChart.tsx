interface Props {
	min: number
	max: number
	mean: number
	median: number
	histogram: { bucket: string; count: number }[]
}

export function NumericChart({ min, max, mean, median, histogram }: Props) {
	const maxCount = Math.max(...histogram.map((h) => h.count), 1)

	return (
		<div className="space-y-4">
			{/* Stats row */}
			<div className="grid grid-cols-4 gap-3">
				<StatBox label="Min" value={min} />
				<StatBox label="Max" value={max} />
				<StatBox label="Mean" value={mean} />
				<StatBox label="Median" value={median} />
			</div>

			{/* Histogram */}
			{histogram.length > 0 && (
				<div className="flex items-end gap-1 h-24">
					{histogram.map((bar) => (
						<div key={bar.bucket} className="flex-1 flex flex-col items-center gap-1">
							<div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
								<div
									className="w-full rounded-t bg-brand-500/80 dark:bg-brand-400/60 transition-all duration-500 min-w-[4px]"
									style={{
										height: `${Math.max((bar.count / maxCount) * 100, bar.count > 0 ? 4 : 0)}%`,
									}}
								/>
							</div>
							<span className="text-[9px] text-gray-400 truncate max-w-full" title={bar.bucket}>
								{bar.bucket}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

function StatBox({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-center">
			<div className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
				{typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}
			</div>
			<div className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</div>
		</div>
	)
}
