import { BarChart3, Clock, TrendingUp, Users } from 'lucide-react'

interface Props {
	totalResponses: number
	todayResponses: number
	avgPerDay: number
	fieldCount: number
}

export function SummaryCards({ totalResponses, todayResponses, avgPerDay, fieldCount }: Props) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
			<Card
				icon={<BarChart3 className="h-4 w-4" />}
				label="Total Responses"
				value={totalResponses}
			/>
			<Card
				icon={<TrendingUp className="h-4 w-4" />}
				label="Today"
				value={todayResponses}
				accent
			/>
			<Card
				icon={<Clock className="h-4 w-4" />}
				label="Avg / Day"
				value={avgPerDay}
			/>
			<Card
				icon={<Users className="h-4 w-4" />}
				label="Questions"
				value={fieldCount}
			/>
		</div>
	)
}

function Card({
	icon,
	label,
	value,
	accent,
}: {
	icon: React.ReactNode
	label: string
	value: number
	accent?: boolean
}) {
	return (
		<div className={`rounded-xl border px-4 py-3 ${
			accent
				? 'border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/10'
				: 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50'
		}`}>
			<div className="flex items-center gap-1.5 text-gray-400 mb-1">
				{icon}
				<span className="text-[10px] uppercase tracking-wider">{label}</span>
			</div>
			<div className={`text-2xl font-bold tabular-nums ${
				accent ? 'text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100'
			}`}>
				{value}
			</div>
		</div>
	)
}
