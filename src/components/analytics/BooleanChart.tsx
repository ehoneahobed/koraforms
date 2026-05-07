interface Props {
	yes: number
	no: number
}

export function BooleanChart({ yes, no }: Props) {
	const total = yes + no || 1
	const yesPct = Math.round((yes / total) * 100)
	const noPct = 100 - yesPct

	// SVG donut chart
	const size = 120
	const strokeWidth = 16
	const radius = (size - strokeWidth) / 2
	const circumference = 2 * Math.PI * radius
	const yesArc = (yesPct / 100) * circumference

	return (
		<div className="flex items-center gap-6">
			{/* Donut */}
			<div className="relative shrink-0">
				<svg width={size} height={size} className="-rotate-90">
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="currentColor"
						strokeWidth={strokeWidth}
						className="text-red-100 dark:text-red-900/30"
					/>
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="currentColor"
						strokeWidth={strokeWidth}
						strokeDasharray={`${yesArc} ${circumference - yesArc}`}
						strokeLinecap="round"
						className="text-emerald-500 transition-all duration-700"
					/>
				</svg>
				<div className="absolute inset-0 flex items-center justify-center">
					<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{total}</span>
				</div>
			</div>

			{/* Legend */}
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<div className="w-3 h-3 rounded-full bg-emerald-500" />
					<span className="text-sm text-gray-700 dark:text-gray-300">
						Yes — {yes} ({yesPct}%)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-3 h-3 rounded-full bg-red-400 dark:bg-red-500/60" />
					<span className="text-sm text-gray-700 dark:text-gray-300">
						No — {no} ({noPct}%)
					</span>
				</div>
			</div>
		</div>
	)
}
