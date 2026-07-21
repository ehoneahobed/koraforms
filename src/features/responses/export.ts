import type { FormField } from '../../types'
import { formatDuration, parseResponseData, parseResponseMeta, responseFields, staticFieldLabel } from './utils'

export interface ResponseExportRecord extends Record<string, unknown> {
	data?: unknown
	submittedAt?: unknown
}

export interface ResponseExportOptions {
	fields: FormField[]
	responses: ResponseExportRecord[]
	selectedFieldIds?: string[]
	includeMetadata?: boolean
}

export function getExportFields(fields: FormField[], selectedFieldIds?: string[]): FormField[] {
	const fieldsForResponses = responseFields(fields)
	if (!selectedFieldIds) return fieldsForResponses
	const selected = new Set(selectedFieldIds)
	return fieldsForResponses.filter(field => selected.has(field.id))
}

export function createResponsesCsv({
	fields,
	responses,
	selectedFieldIds,
	includeMetadata = true,
}: ResponseExportOptions): string {
	const exportFields = getExportFields(fields, selectedFieldIds)
	const headers = [...(includeMetadata ? ['#', 'Submitted At'] : []), ...exportFields.map(field => field.label || field.id)]
	const rows = responses.map((response, index) => {
		const data = parseResponseData(response)
		const submittedAt = response.submittedAt ? new Date(Number(response.submittedAt)).toLocaleString() : ''
		return [
			...(includeMetadata ? [String(index + 1), submittedAt] : []),
			...exportFields.map(field => data[field.id] || ''),
		]
	})

	return [headers, ...rows]
		.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
		.join('\n')
}

export function createResponsesJson({
	fields,
	responses,
	selectedFieldIds,
	includeMetadata = true,
}: ResponseExportOptions): unknown[] {
	const exportFields = getExportFields(fields, selectedFieldIds)
	return responses.map((response, index) => {
		const data = parseResponseData(response)
		const labeled: Record<string, string> = {}
		for (const field of exportFields) {
			if (data[field.id] !== undefined) {
				labeled[field.label || field.id] = data[field.id]!
			}
		}
		return includeMetadata
			? {
				responseNumber: index + 1,
				submittedAt: response.submittedAt ? new Date(Number(response.submittedAt)).toISOString() : null,
				data: labeled,
			}
			: labeled
	})
}

export interface ResponsesReportOptions {
	title: string
	fields: FormField[]
	responses: ResponseExportRecord[]
	generatedAt?: Date
}

type ReportFieldSummary =
	| { label: string; type: 'categorical'; data: [string, number][]; total: number }
	| { label: string; type: 'numeric'; avg: string; min: number; max: number; count: number }
	| { label: string; type: 'text'; total: number; unique: number }

export function createResponsesReportHtml({
	title,
	fields,
	responses,
	generatedAt = new Date(),
}: ResponsesReportOptions): string {
	const reportFields = responseFields(fields)
	const allData = responses.map(parseResponseData)
	const fieldSummaries = createReportFieldSummaries(reportFields, allData)
	const durations = responses
		.map(response => parseResponseMeta(response)?.duration)
		.filter((value): value is number => typeof value === 'number' && value > 0 && value < 86400)
	const avgTime = durations.length > 0
		? formatDuration(Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length))
		: 'N/A'
	const now = generatedAt.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
	const newest = responses[0]
	const oldest = responses[responses.length - 1]
	const dateRange = `${shortReportDate(oldest?.submittedAt)} - ${shortReportDate(newest?.submittedAt, true)}`

	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)} - Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px;color:#1a1a1a;max-width:800px;margin:0 auto;font-size:13px}
h1{font-size:22px;margin-bottom:4px}
.subtitle{color:#666;font-size:13px;margin-bottom:24px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}
.stat{background:#f8f9fa;border-radius:8px;padding:14px}
.stat-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
.stat-value{font-size:20px;font-weight:700}
h2{font-size:16px;margin:24px 0 12px;padding-top:16px;border-top:1px solid #eee}
.field-card{background:#fafafa;border-radius:8px;padding:14px;margin-bottom:12px}
.field-name{font-weight:600;margin-bottom:8px}
.bar-row{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.bar-label{width:140px;text-align:right;font-size:12px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{flex:1;background:#eee;border-radius:4px;height:14px;overflow:hidden}
.bar-fill{background:#e53e3e;border-radius:4px;height:100%}
.bar-count{font-size:11px;color:#888;width:60px}
.num-stats{display:flex;gap:20px;font-size:13px}
.num-stats span{color:#888}
.text-stats{font-size:13px;color:#555}
.footer{text-align:center;color:#aaa;font-size:11px;margin-top:40px;padding-top:16px;border-top:1px solid #eee}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
th{text-align:left;padding:6px 8px;background:#f0f0f0;border-bottom:1px solid #ddd;font-weight:600;font-size:11px;text-transform:uppercase;color:#666}
td{padding:6px 8px;border-bottom:1px solid #f0f0f0}
tr:nth-child(even){background:#fafafa}
@media print{body{padding:20px}h2{page-break-before:auto}.field-card{break-inside:avoid}}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p class="subtitle">Report generated on ${escapeHtml(now)} &bull; ${responses.length} response${responses.length !== 1 ? 's' : ''}</p>
<div class="stats">
<div class="stat"><div class="stat-label">Responses</div><div class="stat-value">${responses.length}</div></div>
<div class="stat"><div class="stat-label">Fields</div><div class="stat-value">${reportFields.length}</div></div>
<div class="stat"><div class="stat-label">Avg. Time</div><div class="stat-value">${escapeHtml(avgTime)}</div></div>
<div class="stat"><div class="stat-label">Date Range</div><div class="stat-value" style="font-size:13px">${escapeHtml(dateRange)}</div></div>
</div>
<h2>Field Summary</h2>
${fieldSummaries.map(renderFieldSummary).join('\n')}
<h2>All Responses</h2>
<table><thead><tr><th>#</th><th>Date</th>${reportFields.slice(0, 8).map(field => `<th>${escapeHtml(field.label || field.id)}</th>`).join('')}</tr></thead><tbody>
${responses.slice(0, 100).map((response, index) => {
		const data = allData[index] ?? {}
		const date = response.submittedAt ? new Date(Number(response.submittedAt)).toLocaleDateString() : ''
		return `<tr><td>${responses.length - index}</td><td>${escapeHtml(date)}</td>${reportFields.slice(0, 8).map(field => `<td>${escapeHtml((data[field.id] || '-').slice(0, 60))}</td>`).join('')}</tr>`
	}).join('\n')}
</tbody></table>
${responses.length > 100 ? `<p style="text-align:center;color:#888;margin-top:8px;font-size:12px">Showing first 100 of ${responses.length} responses</p>` : ''}
<div class="footer">Generated by KoraForms &bull; forms.korajs.dev</div>
</body></html>`
}

function createReportFieldSummaries(
	fields: FormField[],
	allData: Record<string, string>[],
): ReportFieldSummary[] {
	return fields.map(field => {
		const values = allData.map(data => data[field.id] ?? '').filter(Boolean)
		const isCategorical = ['select', 'radio', 'checkbox', 'yesno'].includes(field.type)
		const isNumeric = ['number', 'rating', 'scale'].includes(field.type)
		if (isCategorical) {
			const counts: Record<string, number> = {}
			for (const value of values) {
				const parts = field.type === 'checkbox' ? value.split(',') : [value]
				for (const part of parts) {
					const trimmed = part.trim()
					if (trimmed) counts[trimmed] = (counts[trimmed] ?? 0) + 1
				}
			}
			return {
				label: staticFieldLabel(field),
				type: 'categorical',
				data: Object.entries(counts).sort((a, b) => b[1] - a[1]) as [string, number][],
				total: values.length,
			}
		}
		if (isNumeric) {
			const nums = values.map(Number).filter(number => !Number.isNaN(number))
			if (nums.length > 0) {
				const sum = nums.reduce((total, number) => total + number, 0)
				return {
					label: staticFieldLabel(field),
					type: 'numeric',
					avg: (sum / nums.length).toFixed(1),
					min: Math.min(...nums),
					max: Math.max(...nums),
					count: nums.length,
				}
			}
		}
		return {
			label: staticFieldLabel(field),
			type: 'text',
			total: values.length,
			unique: new Set(values).size,
		}
	})
}

function renderFieldSummary(summary: ReportFieldSummary): string {
	if (summary.type === 'categorical') {
		const maxCount = summary.data[0]?.[1] ?? 1
		return `<div class="field-card"><div class="field-name">${escapeHtml(summary.label)}</div>${summary.data.slice(0, 10).map(([label, count]) =>
			`<div class="bar-row"><div class="bar-label">${escapeHtml(label)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round((count / maxCount) * 100)}%"></div></div><div class="bar-count">${count} (${summary.total > 0 ? Math.round((count / summary.total) * 100) : 0}%)</div></div>`
		).join('')}</div>`
	}
	if (summary.type === 'numeric') {
		return `<div class="field-card"><div class="field-name">${escapeHtml(summary.label)}</div><div class="num-stats"><span>Average:</span> <strong>${escapeHtml(summary.avg)}</strong> &nbsp; <span>Min:</span> <strong>${summary.min}</strong> &nbsp; <span>Max:</span> <strong>${summary.max}</strong> &nbsp; <span>Count:</span> <strong>${summary.count}</strong></div></div>`
	}
	return `<div class="field-card"><div class="field-name">${escapeHtml(summary.label)}</div><div class="text-stats">${summary.total} responses, ${summary.unique} unique values</div></div>`
}

function shortReportDate(value: unknown, includeYear = false): string {
	if (!value) return '-'
	return new Date(Number(value)).toLocaleDateString('en', {
		month: 'short',
		day: 'numeric',
		...(includeYear ? { year: 'numeric' as const } : {}),
	})
}

function escapeHtml(value: unknown): string {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}
