interface Props {
	points: { date: string; count: number }[]
}

export function TimelineChart({ points }: Props) {
	if (points.length === 0) {
		return <p className="text-sm text-gray-400">No data yet</p>
	}

	const maxCount = Math.max(...points.map((p) => p.count), 1)
	const height = 100
	const padding = 4

	// Build SVG path for area chart
	const width = 100 // percentage-based via viewBox
	const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0

	const linePoints = points.map((p, i) => {
		const x = padding + i * stepX
		const y = height - padding - ((p.count / maxCount) * (height - padding * 2))
		return { x, y }
	})

	const linePath = linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
	const areaPath = `${linePath} L ${linePoints[linePoints.length - 1]!.x} ${height - padding} L ${linePoints[0]!.x} ${height - padding} Z`

	return (
		<div className="space-y-2">
			<svg
				viewBox={`0 0 ${width} ${height}`}
				className="w-full h-24"
				preserveAspectRatio="none"
			>
				{/* Area fill */}
				<path
					d={areaPath}
					className="fill-brand-500/10 dark:fill-brand-400/10"
				/>
				{/* Line */}
				<path
					d={linePath}
					fill="none"
					className="stroke-brand-500 dark:stroke-brand-400"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					vectorEffect="non-scaling-stroke"
				/>
				{/* Dots */}
				{linePoints.map((p, i) => (
					<circle
						key={i}
						cx={p.x}
						cy={p.y}
						r="2"
						className="fill-brand-500 dark:fill-brand-400"
						vectorEffect="non-scaling-stroke"
					/>
				))}
			</svg>

			{/* X-axis labels */}
			<div className="flex justify-between text-[9px] text-gray-400 px-1">
				{points.length <= 7 ? (
					points.map((p) => <span key={p.date}>{p.date}</span>)
				) : (
					<>
						<span>{points[0]!.date}</span>
						<span>{points[Math.floor(points.length / 2)]!.date}</span>
						<span>{points[points.length - 1]!.date}</span>
					</>
				)}
			</div>
		</div>
	)
}
