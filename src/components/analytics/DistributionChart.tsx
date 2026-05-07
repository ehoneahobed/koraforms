interface Props {
	items: { label: string; count: number; percentage: number }[]
	color?: string
}

export function DistributionChart({ items, color = 'var(--color-brand-500, #6366f1)' }: Props) {
	if (items.length === 0) {
		return <p className="text-sm text-gray-400">No responses yet</p>
	}

	const maxCount = Math.max(...items.map((i) => i.count), 1)

	return (
		<div className="space-y-2.5">
			{items.map((item) => (
				<div key={item.label}>
					<div className="flex items-center justify-between text-sm mb-1">
						<span className="text-gray-700 dark:text-gray-300 truncate mr-2">{item.label}</span>
						<span className="text-gray-400 dark:text-gray-500 shrink-0 tabular-nums text-xs">
							{item.count} ({item.percentage}%)
						</span>
					</div>
					<div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
						<div
							className="h-full rounded-full transition-all duration-500"
							style={{
								width: `${(item.count / maxCount) * 100}%`,
								backgroundColor: color,
								minWidth: item.count > 0 ? '4px' : '0',
							}}
						/>
					</div>
				</div>
			))}
		</div>
	)
}
