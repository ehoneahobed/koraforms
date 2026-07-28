import { useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Copy, Inbox, ListChecks, Share2 } from 'lucide-react'
import type { FormField } from '../../types'
import {
	buildFollowUpReview,
	type ResponseOverviewSummary,
} from '../../features/responses/inbox'
import {
	formatDuration,
	formatTimeSince,
	staticFieldLabel,
} from '../../features/responses/utils'
import { copyToClipboard } from '../../utils/clipboard'

export function ResponseOverview({
	totalResponses,
	completionRate,
	dropOff,
	overview,
}: {
	totalResponses: number
	completionRate: number
	dropOff: number
	overview: ResponseOverviewSummary
}) {
	const health = completionRate >= 85 ? 'Strong' : completionRate >= 60 ? 'Watch' : 'Needs review'
	const healthClass = completionRate >= 85
		? 'text-emerald-700 dark:text-emerald-300'
		: completionRate >= 60
			? 'text-amber-700 dark:text-amber-300'
			: 'text-red-600 dark:text-red-300'
	const primarySignal = overview.requiredGaps[0]
		? `${staticFieldLabel(overview.requiredGaps[0].field)} missing in ${overview.requiredGaps[0].missing}`
		: overview.lowFillFields[0]
			? `${staticFieldLabel(overview.lowFillFields[0].field)} at ${overview.lowFillFields[0].pct}% fill`
			: 'No urgent review signals'

	return (
		<section className="mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
			<div className="grid grid-cols-2 gap-y-4 md:grid-cols-[1.1fr_repeat(4,0.7fr)] md:items-center">
				<div className="col-span-2 min-w-0 md:col-span-1">
					<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Health</p>
					<div className="mt-0.5 flex items-center gap-2">
						<span className={`text-[15px] font-semibold ${healthClass}`}>{health}</span>
						<span className="text-[12px] text-slate-400 dark:text-gray-500">{primarySignal}</span>
					</div>
				</div>
				<ResponseMetric label="Responses" value={totalResponses.toLocaleString()} helper={overview.lastResponseAt ? formatTimeSince(overview.lastResponseAt) : 'No activity'} />
				<ResponseMetric label="Complete" value={`${completionRate}%`} helper={`${dropOff} partial`} tone={dropOff > 0 ? 'warn' : 'good'} />
				<ResponseMetric label="Median" value={overview.medianDuration ? formatDuration(overview.medianDuration) : '--'} helper="Completion time" />
				<ResponseMetric label="Mobile" value={overview.mobilePct == null ? '--' : `${overview.mobilePct}%`} helper="Respondents" />
			</div>
		</section>
	)
}

function ResponseMetric({
	label,
	value,
	helper,
	tone = 'neutral',
}: {
	label: string
	value: string
	helper: string
	tone?: 'neutral' | 'good' | 'warn'
}) {
	const valueClass = tone === 'good'
		? 'text-emerald-700 dark:text-emerald-300'
		: tone === 'warn'
			? 'text-amber-700 dark:text-amber-300'
			: 'text-slate-950 dark:text-gray-100'

	return (
		<div className="min-w-0 md:border-l md:border-slate-100 md:pl-4 md:dark:border-gray-800">
			<p className="text-[11px] font-medium text-slate-400 dark:text-gray-500">{label}</p>
			<p className={`mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight ${valueClass}`}>{value}</p>
			<p className="truncate text-[11px] text-slate-400 dark:text-gray-600">{helper}</p>
		</div>
	)
}

export function FollowUpView({
	fields,
	responses,
	onOpenResponse,
	onInspectField,
}: {
	fields: FormField[]
	responses: Record<string, unknown>[]
	onOpenResponse: (id: string) => void
	onInspectField: (fieldId: string) => void
}) {
	const review = useMemo(() => {
		return buildFollowUpReview(fields, responses)
	}, [fields, responses])

	const hasWork = review.qualitySignals.length > 0 || review.incomplete.length > 0 || review.slow.length > 0 || review.lowFillFields.length > 0 || review.duplicateGroups.length > 0

	if (responses.length === 0) {
		return (
			<div className="py-16 text-center">
				<ListChecks className="mx-auto h-8 w-8 text-slate-300 dark:text-gray-700" />
				<h2 className="mt-3 text-lg font-semibold text-slate-950 dark:text-gray-100">Nothing to review yet</h2>
				<p className="mt-1 text-sm text-slate-400 dark:text-gray-500">Follow-up suggestions appear after submissions arrive.</p>
			</div>
		)
	}

	return (
		<div className="space-y-5 animate-fade-in">
			<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Review queue</p>
						<h2 className="mt-1 text-[24px] font-bold tracking-tight text-slate-950 dark:text-gray-100">
							{hasWork ? 'Suggested follow-ups' : 'Everything looks clean'}
						</h2>
						<p className="mt-1 text-[14px] text-slate-500 dark:text-gray-400">
							KoraForms scans quality, required gaps, slow submissions, low-fill fields, and duplicate-looking respondents.
						</p>
					</div>
					<div className="grid grid-cols-5 gap-2 text-center">
						<QueueCount label="Quality" value={review.qualitySignals.length} />
						<QueueCount label="Incomplete" value={review.incomplete.length} />
						<QueueCount label="Slow" value={review.slow.length} />
						<QueueCount label="Fields" value={review.lowFillFields.length} />
						<QueueCount label="Dupes" value={review.duplicateGroups.length} />
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				<ReviewSection
					title="Response quality"
					description="Submissions that look incomplete, duplicated, unusually fast, or worth checking."
					empty="No quality signals detected."
				>
					{review.qualitySignals.slice(0, 8).map(signal => (
						<ReviewResponseRow
							key={signal.id}
							response={{ id: signal.responseId }}
							title={signal.title}
							detail={`${signal.detail} ${signal.action}`}
							badge={signal.severity === 'review' ? 'Review' : signal.severity === 'watch' ? 'Watch' : 'Note'}
							tone={signal.severity}
							onOpen={() => onOpenResponse(signal.responseId)}
						/>
					))}
				</ReviewSection>

				<ReviewSection
					title="Incomplete required answers"
					description="Responses missing one or more required fields."
					empty="No required gaps found."
				>
					{review.incomplete.map(item => (
						<ReviewResponseRow
							key={String(item.response.id)}
							response={item.response}
							title={`${item.missingFields.length} missing required field${item.missingFields.length !== 1 ? 's' : ''}`}
							detail={item.missingFields.map(staticFieldLabel).join(', ')}
							badge={`${item.completion}%`}
							onOpen={() => onOpenResponse(String(item.response.id))}
						/>
					))}
				</ReviewSection>

				<ReviewSection
					title="Slow submissions"
					description={`Responses that took longer than ${formatDuration(Math.round(review.slowThreshold))}.`}
					empty="No unusually slow submissions."
				>
					{review.slow.map(item => (
						<ReviewResponseRow
							key={String(item.response.id)}
							response={item.response}
							title="Long completion time"
							detail="This may indicate confusing wording or too many fields."
							badge={formatDuration(Math.round(Number(item.meta?.duration) || 0))}
							onOpen={() => onOpenResponse(String(item.response.id))}
						/>
					))}
				</ReviewSection>

				<ReviewSection
					title="Low-fill fields"
					description="Fields with fill rates below 75%."
					empty="No low-fill fields detected."
				>
					{review.lowFillFields.map(item => (
						<button
							key={item.field.id}
							onClick={() => onInspectField(item.field.id)}
							className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-brand-800"
						>
							<div className="min-w-0">
								<p className="truncate text-[14px] font-semibold text-slate-800 dark:text-gray-200">{staticFieldLabel(item.field)}</p>
								<p className="mt-0.5 text-[12px] text-slate-400 dark:text-gray-500">{item.missing} blank response{item.missing !== 1 ? 's' : ''}</p>
							</div>
							<span className="rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{item.pct}%</span>
						</button>
					))}
				</ReviewSection>

				<ReviewSection
					title="Possible duplicates"
					description="Repeated names, emails, or phone numbers."
					empty="No duplicate-looking respondents."
				>
					{review.duplicateGroups.map(group => (
						<button
							key={`${group.field.id}-${group.value}`}
							onClick={() => onOpenResponse(String(group.responses[0]?.id))}
							className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-brand-800"
						>
							<div className="min-w-0">
								<p className="truncate text-[14px] font-semibold text-slate-800 dark:text-gray-200">{group.value}</p>
								<p className="mt-0.5 text-[12px] text-slate-400 dark:text-gray-500">{staticFieldLabel(group.field)}</p>
							</div>
							<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600 dark:bg-gray-800 dark:text-gray-300">{group.responses.length}x</span>
						</button>
					))}
				</ReviewSection>
			</div>
		</div>
	)
}

function QueueCount({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-900/60">
			<p className="text-[18px] font-bold tabular-nums text-slate-950 dark:text-gray-100">{value}</p>
			<p className="text-[10px] font-medium text-slate-400 dark:text-gray-500">{label}</p>
		</div>
	)
}

function ReviewSection({
	title,
	description,
	empty,
	children,
}: {
	title: string
	description: string
	empty: string
	children: ReactNode
}) {
	const hasChildren = Array.isArray(children) ? children.length > 0 : !!children

	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
			<div className="mb-4">
				<h3 className="text-[15px] font-semibold text-slate-950 dark:text-gray-100">{title}</h3>
				<p className="mt-1 text-[12px] text-slate-400 dark:text-gray-500">{description}</p>
			</div>
			<div className="space-y-2">
				{hasChildren ? children : (
					<div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-[13px] text-slate-400 dark:border-gray-800 dark:text-gray-600">
						{empty}
					</div>
				)}
			</div>
		</section>
	)
}

function ReviewResponseRow({
	response,
	title,
	detail,
	badge,
	tone = 'watch',
	onOpen,
}: {
	response: Record<string, unknown>
	title: string
	detail: string
	badge: string
	tone?: 'info' | 'watch' | 'review'
	onOpen: () => void
}) {
	const badgeClass = tone === 'review'
		? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
		: tone === 'info'
			? 'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300'
			: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
	return (
		<button
			onClick={onOpen}
			className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-brand-800"
		>
			<div className="min-w-0">
				<p className="truncate text-[14px] font-semibold text-slate-800 dark:text-gray-200">{title}</p>
				<p className="mt-0.5 truncate text-[12px] text-slate-400 dark:text-gray-500">{detail}</p>
				{response.submittedAt ? (
					<p className="mt-1 text-[11px] text-slate-400 dark:text-gray-600">{formatTimeSince(Number(response.submittedAt))}</p>
				) : null}
			</div>
			<span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${badgeClass}`}>{badge}</span>
		</button>
	)
}

export function EmptyState({
	formId,
	navigate,
	form,
}: {
	formId: string
	navigate: (path: string) => void
	form: Record<string, unknown>
}) {
	const [copied, setCopied] = useState(false)

	const copyLink = async () => {
		const slug = String(form.slug || formId)
		const url = `${window.location.origin}/f/${slug}`
		if (await copyToClipboard(url)) {
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}
	}

	return (
		<div className="flex flex-col items-center justify-center py-16 animate-fade-in">
			<div className="relative mb-8">
				<div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 flex items-center justify-center shadow-lg shadow-gray-100/50 dark:shadow-none">
					<Inbox className="h-10 w-10 text-gray-300 dark:text-gray-600" />
				</div>
			</div>

			<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No responses yet</h2>
			<p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mb-8 leading-relaxed">
				Share your form to start collecting data. New submissions will appear here automatically, even when you are offline.
			</p>

			<div className="flex items-center gap-3 mb-12">
				<button
					onClick={() => navigate(`share/${formId}`)}
					className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 active:scale-[0.98] shadow-sm shadow-brand-600/25"
				>
					<Share2 className="h-4 w-4" />
					Share form
				</button>
				<button
					onClick={copyLink}
					className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
				>
					{copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
					{copied ? 'Copied!' : 'Copy link'}
				</button>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-lg mb-10">
				{[
					{ step: 1, title: 'Share', desc: 'Share a link or QR code' },
					{ step: 2, title: 'Collect', desc: 'Respond anytime online or offline' },
					{ step: 3, title: 'Understand', desc: 'Data insights when enough data arrives' },
				].map(item => (
					<div key={item.step} className="text-center">
						<div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-sm font-bold mx-auto mb-2">
							{item.step}
						</div>
						<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
						<p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.desc}</p>
					</div>
				))}
			</div>

			<div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 px-4 py-2.5 mb-8">
				<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
				<span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Ready to collect offline</span>
			</div>

			<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 p-5 max-w-sm w-full text-center">
				<p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">When will analytics appear?</p>
				<p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
					Response trends and comparisons become available after 5 responses.
				</p>
				<div className="flex items-center gap-2 justify-center">
					<div className="flex-1 max-w-[120px] h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
						<div className="h-full rounded-full bg-brand-400" style={{ width: '0%' }} />
					</div>
					<span className="text-[10px] text-gray-400 tabular-nums">0 of 5</span>
				</div>
			</div>
		</div>
	)
}
