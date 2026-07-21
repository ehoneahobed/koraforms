import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@korajs/react'
import { app } from '../kora'
import { setPageMeta } from '../utils/meta'
import {
	Download, FileSpreadsheet, ChevronRight, ChevronLeft,
	BarChart3, Share2, Search, Trash2,
	ArrowUpDown, X, Copy, Monitor, Smartphone, Globe, Timer,
	Inbox, CheckCircle2, AlertTriangle, Calendar, FileJson,
	Lightbulb, ListChecks
} from 'lucide-react'
import type { FormField } from '../types'
import { pipeValues } from '../types'
import { computeCrossInsights } from '../utils/analytics'
import { ShareModal } from '../components/shared/ShareModal'

// ============================================================================
// Types & Constants
// ============================================================================

interface Props {
	formId: string
	navigate: (path: string) => void
}

type SubTab = 'all' | 'analytics' | 'insights' | 'todo'
type ExportFormat = 'csv' | 'json'
type TimeRange = '7d' | '14d' | '30d' | '90d' | 'all'

const SUB_TABS: { key: SubTab; label: string; icon: typeof Inbox }[] = [
	{ key: 'all', label: 'Inbox', icon: Inbox },
	{ key: 'analytics', label: 'Analytics', icon: BarChart3 },
	{ key: 'insights', label: 'Field insights', icon: Lightbulb },
	{ key: 'todo', label: 'To do', icon: ListChecks },
]

const SUB_TAB_KEYS = new Set<SubTab>(SUB_TABS.map(tab => tab.key))

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
	{ value: '7d', label: '7d' },
	{ value: '14d', label: '14d' },
	{ value: '30d', label: '30d' },
	{ value: '90d', label: '90d' },
	{ value: 'all', label: 'All' },
]

const ITEMS_PER_PAGE = 25

// ============================================================================
// Utility functions
// ============================================================================

function daysForRange(range: TimeRange): number | null {
	if (range === '7d') return 7
	if (range === '14d') return 14
	if (range === '30d') return 30
	if (range === '90d') return 90
	return null
}

function startOfDaysAgo(daysAgo: number): number {
	const d = new Date()
	d.setHours(0, 0, 0, 0)
	d.setDate(d.getDate() - daysAgo + 1)
	return d.getTime()
}

function shortDate(d: Date): string {
	return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function dateKey(d: Date): string {
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}

function median(nums: number[]): number {
	if (nums.length === 0) return 0
	const sorted = [...nums].sort((a, b) => a - b)
	const mid = Math.floor(sorted.length / 2)
	if (sorted.length % 2 === 0) {
		return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
	}
	return sorted[mid] ?? 0
}

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`
	const m = Math.floor(seconds / 60)
	const s = seconds % 60
	if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
	const h = Math.floor(m / 60)
	return `${h}h ${m % 60}m`
}

function formatTimeSince(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000)
	if (seconds < 60) return 'just now'
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.floor(hours / 24)
	if (days < 7) return `${days}d ago`
	return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function getResponsesSubTabFromUrl(): SubTab {
	if (typeof window === 'undefined') return 'all'
	const value = new URLSearchParams(window.location.search).get('tab') as SubTab | null
	return value && SUB_TAB_KEYS.has(value) ? value : 'all'
}

function setResponsesSubTabInUrl(tab: SubTab) {
	if (typeof window === 'undefined') return
	const url = new URL(window.location.href)
	if (tab === 'all') url.searchParams.delete('tab')
	else url.searchParams.set('tab', tab)
	window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function parseUA(ua: string): { browser: string; os: string; device: string } {
	let browser = 'Other'
	let os = 'Other'
	let device = 'Desktop'
	if (/Edg\//i.test(ua)) browser = 'Edge'
	else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera'
	else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome'
	else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'
	else if (/Firefox\//i.test(ua)) browser = 'Firefox'
	if (/Windows/i.test(ua)) os = 'Windows'
	else if (/Mac OS|Macintosh/i.test(ua)) os = 'macOS'
	else if (/Android/i.test(ua)) os = 'Android'
	else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
	else if (/Linux/i.test(ua)) os = 'Linux'
	else if (/CrOS/i.test(ua)) os = 'ChromeOS'
	if (/Mobile|Android.*Mobile|iPhone/i.test(ua)) device = 'Mobile'
	else if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) device = 'Tablet'
	return { browser, os, device }
}

function isResponseField(field: FormField): boolean {
	return field.type !== 'section' && field.type !== 'statement' && field.type !== 'hidden'
}

function responseFields(fields: FormField[]): FormField[] {
	return fields.filter(isResponseField)
}

function parseResponseData(response: Record<string, unknown>): Record<string, string> {
	try {
		const parsed = JSON.parse(String(response.data || '{}')) as Record<string, unknown>
		return Object.fromEntries(
			Object.entries(parsed)
				.filter(([key]) => key !== '_meta')
				.map(([key, value]) => [key, value == null ? '' : String(value)]),
		)
	} catch {
		return {}
	}
}

function parseResponseMeta(response: Record<string, unknown>): { duration?: number; ua?: string; screen?: string; startedAt?: number } | undefined {
	try {
		const parsed = JSON.parse(String(response.data || '{}')) as { _meta?: { duration?: number; ua?: string; screen?: string; startedAt?: number } }
		return parsed._meta
	} catch {
		return undefined
	}
}

function isFilledValue(value: unknown): boolean {
	return value !== undefined && value !== null && String(value).trim() !== ''
}

function responseCompletionPct(fields: FormField[], data: Record<string, string>): number {
	const requiredFields = responseFields(fields).filter(field => field.required)
	if (requiredFields.length === 0) return 100
	const filled = requiredFields.filter(field => isFilledValue(data[field.id])).length
	return Math.round((filled / requiredFields.length) * 100)
}

function fieldLabel(field: FormField, data: Record<string, unknown>, fields: FormField[]): string {
	const stringData = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value == null ? '' : String(value)]))
	return pipeValues(field.label || field.id, stringData, fields)
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function staticFieldLabel(field: FormField): string {
	const label = field.label || field.id
	return label
		.replace(/([A-Za-z0-9][A-Za-z0-9\s'/-]*?)\s*\{\{([^}]+)\}\}/g, (match, before, token) => {
			const tokenLabel = String(token).trim()
			const strippedPrefix = String(before).replace(new RegExp(`${escapeRegExp(tokenLabel)}\\s*$`, 'i'), '').trimEnd()
			return `${strippedPrefix} ${tokenLabel}`.trim()
		})
		.replace(/\{\{([^}]+)\}\}/g, (_, token) => String(token).trim())
		.replace(/\s+/g, ' ')
		.trim()
}

function formatResponseValue(field: FormField, value: unknown): { kind: 'empty' | 'text' | 'list'; values: string[] } {
	if (value == null || value === '') return { kind: 'empty', values: [] }
	const raw = String(value)
	if (field.type === 'checkbox' || field.type === 'ranking') {
		const values = raw.split(',').map(part => part.trim()).filter(Boolean)
		return values.length > 0 ? { kind: 'list', values } : { kind: 'empty', values: [] }
	}
	if (field.type === 'rating') return { kind: 'text', values: [`${raw} star${raw === '1' ? '' : 's'}`] }
	if (field.type === 'scale') return { kind: 'text', values: [`${raw} / 10`] }
	if (field.type === 'file') return { kind: 'text', values: [raw] }
	if (field.type === 'signature') return { kind: 'text', values: raw.startsWith('data:image') ? ['Signature captured'] : [raw] }
	if (field.type === 'calculated') return { kind: 'text', values: [raw] }
	return { kind: 'text', values: [raw] }
}

// ============================================================================
// Main FormResponses Component
// ============================================================================

export function FormResponses({ formId, navigate }: Props) {
	const allForms = useQuery(app.forms.where({}).orderBy('createdAt', 'desc'))
	const allResponses = useQuery(
		app.responses.where({}).orderBy('submittedAt', 'desc'),
	)

	const form = allForms.find((f) => f.id === formId)
	const responses = allResponses.filter((r) => String(r.formId) === formId)

	useEffect(() => {
		setPageMeta({
			title: form ? `Responses: ${form.title}` : 'Responses',
			description: 'View and export form responses.',
		})
	}, [form?.title])

	// --- State ---
	const [subTab, setSubTab] = useState<SubTab>(() => getResponsesSubTabFromUrl())
	const [expandedId, setExpandedId] = useState<string | null>(null)
	const [selectedResponse, setSelectedResponse] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [sortCol, setSortCol] = useState<string>('_date')
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
	const [showShareModal, setShowShareModal] = useState(false)
	const [showExportModal, setShowExportModal] = useState(false)
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [currentPage, setCurrentPage] = useState(1)

	const switchSubTab = (tab: SubTab) => {
		setSubTab(tab)
		setResponsesSubTabInUrl(tab)
	}

	useEffect(() => {
		const handlePopState = () => setSubTab(getResponsesSubTabFromUrl())
		window.addEventListener('popstate', handlePopState)
		return () => window.removeEventListener('popstate', handlePopState)
	}, [])

	// --- Derived data ---
	let fields: FormField[] = []
	try {
		fields = JSON.parse(String(form?.fields || '[]'))
	} catch { /* ignore */ }

	const filteredResponses = useMemo(() => {
		let result = responses
		if (search.trim()) {
			const q = search.toLowerCase()
			result = result.filter(r => {
				const data = parseResponseData(r)
				const submittedAt = r.submittedAt ? new Date(Number(r.submittedAt)).toLocaleString().toLowerCase() : ''
				return submittedAt.includes(q) || Object.values(data).some(v => String(v).toLowerCase().includes(q))
			})
		}
		if (sortCol) {
			result = [...result].sort((a, b) => {
				let va: string, vb: string
				if (sortCol === '_date') {
					va = String(a.submittedAt || 0)
					vb = String(b.submittedAt || 0)
				} else {
					va = String(parseResponseData(a)[sortCol] || '')
					vb = String(parseResponseData(b)[sortCol] || '')
				}
				const cmp = va.localeCompare(vb, undefined, { numeric: true })
				return sortDir === 'asc' ? cmp : -cmp
			})
		}
		return result
	}, [responses, search, sortCol, sortDir])

	// Reset page when search changes
	useEffect(() => { setCurrentPage(1) }, [search])

	// Pagination
	const totalPages = Math.max(1, Math.ceil(filteredResponses.length / ITEMS_PER_PAGE))
	const paginatedResponses = useMemo(() => {
		const start = (currentPage - 1) * ITEMS_PER_PAGE
		return filteredResponses.slice(start, start + ITEMS_PER_PAGE)
	}, [filteredResponses, currentPage])

	const paginationStart = (currentPage - 1) * ITEMS_PER_PAGE + 1
	const paginationEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredResponses.length)

	// --- Stat computations ---
	const completionStats = useMemo(() => {
		const requiredFields = responseFields(fields).filter(f => f.required)
		let complete = 0
		let partial = 0
		for (const r of responses) {
			const data = parseResponseData(r)
			if (requiredFields.length === 0) {
				complete++
			} else {
				const allFilled = requiredFields.every(f => isFilledValue(data[f.id]))
				if (allFilled) complete++
				else partial++
			}
		}
		const rate = responses.length > 0 ? Math.round((complete / responses.length) * 100) : 0
		return { complete, partial, rate, dropOff: partial }
	}, [responses, fields])

	const responseOverview = useMemo(() => {
		const dataFields = responseFields(fields)
		const parsed = responses.map(response => ({ response, data: parseResponseData(response), meta: parseResponseMeta(response) }))
		const durations = parsed
			.map(item => item.meta?.duration)
			.filter((value): value is number => typeof value === 'number' && value > 0 && value < 86400)
		const devices = parsed.map(item => item.meta?.ua ? parseUA(item.meta.ua).device : null).filter(Boolean)
		const mobileCount = devices.filter(device => device === 'Mobile').length
		const fillByField = dataFields.map(field => {
			const filled = parsed.filter(item => isFilledValue(item.data[field.id])).length
			return {
				field,
				filled,
				missing: Math.max(0, responses.length - filled),
				pct: responses.length > 0 ? Math.round((filled / responses.length) * 100) : 0,
			}
		})
		const lowFillFields = fillByField.filter(item => item.pct < 80).sort((a, b) => a.pct - b.pct)
		const requiredGaps = responseFields(fields)
			.filter(field => field.required)
			.map(field => ({
				field,
				missing: parsed.filter(item => !isFilledValue(item.data[field.id])).length,
			}))
			.filter(item => item.missing > 0)
			.sort((a, b) => b.missing - a.missing)

		return {
			lastResponseAt: responses[0]?.submittedAt ? Number(responses[0].submittedAt) : null,
			avgDuration: durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
			medianDuration: durations.length > 0 ? Math.round(median(durations)) : null,
			mobilePct: devices.length > 0 ? Math.round((mobileCount / devices.length) * 100) : null,
			lowFillFields,
			requiredGaps,
			topField: fillByField.sort((a, b) => b.pct - a.pct)[0] || null,
		}
	}, [responses, fields])

	useEffect(() => {
		setSelectedIds(prev => {
			if (prev.size === 0) return prev
			const visibleIds = new Set(filteredResponses.map(response => String(response.id)))
			const next = new Set(Array.from(prev).filter(id => visibleIds.has(id)))
			return next.size === prev.size ? prev : next
		})
	}, [filteredResponses])

	// --- Actions ---
	const toggleSort = (col: string) => {
		if (sortCol === col) {
			setSortDir(d => d === 'asc' ? 'desc' : 'asc')
		} else {
			setSortCol(col)
			setSortDir('asc')
		}
	}

	const toggleSelect = (id: string) => {
		setSelectedIds(prev => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const selectAll = () => {
		if (selectedIds.size === paginatedResponses.length) {
			setSelectedIds(new Set())
		} else {
			setSelectedIds(new Set(paginatedResponses.map(r => r.id)))
		}
	}

	const deleteSelected = () => {
		if (selectedIds.size === 0) return
		if (!window.confirm(`Delete ${selectedIds.size} response${selectedIds.size !== 1 ? 's' : ''}?`)) return
		for (const id of selectedIds) {
			app.responses.delete(id)
		}
		setSelectedIds(new Set())
	}

	// --- Export helpers ---
	const downloadFile = (content: string, filename: string, type: string) => {
		const blob = new Blob([content], { type })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		a.click()
		URL.revokeObjectURL(url)
	}

	const exportCsv = (selectedFieldIds?: string[], sourceResponses: Record<string, unknown>[] = responses, includeMetadata = true) => {
		if (sourceResponses.length === 0) return
		const exportFields = selectedFieldIds
			? responseFields(fields).filter(f => selectedFieldIds.includes(f.id))
			: responseFields(fields)
		const headers = [...(includeMetadata ? ['#', 'Submitted At'] : []), ...exportFields.map(f => f.label || f.id)]
		const rows = sourceResponses.map((r, i) => {
			const data = parseResponseData(r)
			const submittedAt = r.submittedAt ? new Date(Number(r.submittedAt)).toLocaleString() : ''
			return [...(includeMetadata ? [String(i + 1), submittedAt] : []), ...exportFields.map(f => data[f.id] || '')]
		})
		const csvContent = [headers, ...rows]
			.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
			.join('\n')
		downloadFile(csvContent, `${String(form?.title || 'form')}-responses.csv`, 'text/csv')
	}

	const exportJson = (selectedFieldIds?: string[], sourceResponses: Record<string, unknown>[] = responses, includeMetadata = true) => {
		if (sourceResponses.length === 0) return
		const exportFields = selectedFieldIds
			? responseFields(fields).filter(f => selectedFieldIds.includes(f.id))
			: responseFields(fields)
		const exported = sourceResponses.map((r, i) => {
			const data = parseResponseData(r)
			const labeled: Record<string, string> = {}
			for (const field of exportFields) {
				if (data[field.id] !== undefined) {
					labeled[field.label || field.id] = data[field.id]!
				}
			}
			return includeMetadata
				? {
					responseNumber: i + 1,
					submittedAt: r.submittedAt ? new Date(Number(r.submittedAt)).toISOString() : null,
					data: labeled,
				}
				: labeled
		})
		downloadFile(JSON.stringify(exported, null, 2), `${String(form?.title || 'form')}-responses.json`, 'application/json')
	}

	const exportPdf = () => {
		if (responses.length === 0) return
		const allData = responses.map(r => {
			try { return JSON.parse(String(r.data || '{}')) as Record<string, string> } catch { return {} }
		})
		const reportFields = responseFields(fields)
		const fieldSummaries = reportFields
			.map(field => {
				const vals = allData.map(d => d[field.id] ?? '').filter(v => v !== '')
				const isCategorical = ['select', 'radio', 'checkbox', 'yesno'].includes(field.type)
				const isNumeric = ['number', 'rating', 'scale'].includes(field.type)
				if (isCategorical) {
					const counts: Record<string, number> = {}
					for (const v of vals) {
						const parts = field.type === 'checkbox' ? v.split(',') : [v]
						for (const p of parts) { const t = p.trim(); if (t) counts[t] = (counts[t] ?? 0) + 1 }
					}
					const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
					return { label: staticFieldLabel(field), type: 'categorical' as const, data: sorted, total: vals.length }
				}
				if (isNumeric) {
					const nums = vals.map(Number).filter(n => !isNaN(n))
					if (nums.length > 0) {
						const sum = nums.reduce((a, b) => a + b, 0)
						return { label: staticFieldLabel(field), type: 'numeric' as const, avg: (sum / nums.length).toFixed(1), min: Math.min(...nums), max: Math.max(...nums), count: nums.length }
					}
				}
				return { label: staticFieldLabel(field), type: 'text' as const, total: vals.length, unique: new Set(vals).size }
			})
		const durations: number[] = []
		for (const d of allData) {
			const meta = (d as Record<string, unknown>)._meta as { duration?: number } | undefined
			if (meta?.duration && meta.duration > 0 && meta.duration < 86400) durations.push(meta.duration)
		}
		const avgTime = durations.length > 0 ? formatDuration(Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)) : 'N/A'
		const title = String(form?.title || 'Form')
		const now = new Date().toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
		const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title} — Report</title>
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
<h1>${title}</h1>
<p class="subtitle">Report generated on ${now} &bull; ${responses.length} response${responses.length !== 1 ? 's' : ''}</p>
<div class="stats">
<div class="stat"><div class="stat-label">Responses</div><div class="stat-value">${responses.length}</div></div>
<div class="stat"><div class="stat-label">Fields</div><div class="stat-value">${reportFields.length}</div></div>
<div class="stat"><div class="stat-label">Avg. Time</div><div class="stat-value">${avgTime}</div></div>
<div class="stat"><div class="stat-label">Date Range</div><div class="stat-value" style="font-size:13px">${responses.length > 0 && responses.at(-1)?.submittedAt ? new Date(Number(responses.at(-1)!.submittedAt)).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'} — ${responses.length > 0 && responses[0]?.submittedAt ? new Date(Number(responses[0].submittedAt)).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</div></div>
</div>
<h2>Field Summary</h2>
${fieldSummaries.map(s => {
			if (s.type === 'categorical') {
				const maxC = s.data[0]?.[1] ?? 1
				return `<div class="field-card"><div class="field-name">${s.label}</div>${s.data.slice(0, 10).map(([label, count]) =>
					`<div class="bar-row"><div class="bar-label">${label}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round((count / maxC) * 100)}%"></div></div><div class="bar-count">${count} (${s.total > 0 ? Math.round((count / s.total) * 100) : 0}%)</div></div>`
				).join('')}</div>`
			}
			if (s.type === 'numeric') {
				return `<div class="field-card"><div class="field-name">${s.label}</div><div class="num-stats"><span>Average:</span> <strong>${s.avg}</strong> &nbsp; <span>Min:</span> <strong>${s.min}</strong> &nbsp; <span>Max:</span> <strong>${s.max}</strong> &nbsp; <span>Count:</span> <strong>${s.count}</strong></div></div>`
			}
			return `<div class="field-card"><div class="field-name">${s.label}</div><div class="text-stats">${s.total} responses, ${s.unique} unique values</div></div>`
		}).join('\n')}
<h2>All Responses</h2>
<table><thead><tr><th>#</th><th>Date</th>${reportFields.slice(0, 8).map(f => `<th>${f.label || f.id}</th>`).join('')}</tr></thead><tbody>
${responses.slice(0, 100).map((r, i) => {
			const data = allData[i] ?? {}
			const date = r.submittedAt ? new Date(Number(r.submittedAt)).toLocaleDateString() : ''
			return `<tr><td>${responses.length - i}</td><td>${date}</td>${reportFields.slice(0, 8).map(f => `<td>${(data[f.id] || '—').slice(0, 60)}</td>`).join('')}</tr>`
		}).join('\n')}
</tbody></table>
${responses.length > 100 ? `<p style="text-align:center;color:#888;margin-top:8px;font-size:12px">Showing first 100 of ${responses.length} responses</p>` : ''}
<div class="footer">Generated by KoraForms &bull; forms.korajs.dev</div>
</body></html>`
		const w = window.open('', '_blank')
		if (w) {
			w.document.write(html)
			w.document.close()
			setTimeout(() => w.print(), 500)
		}
	}

	// --- Date range display ---
	const dateRangeLabel = useMemo(() => {
		if (responses.length === 0) return ''
		const oldest = responses[responses.length - 1]
		const newest = responses[0]
		const fmt = (ts: unknown) => {
			if (!ts) return ''
			return new Date(Number(ts)).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
		}
		return `${fmt(oldest?.submittedAt)} - ${fmt(newest?.submittedAt)}`
	}, [responses])

	// --- Not found ---
	if (!form) {
		return (
			<div className="text-center py-20 text-gray-500 animate-fade-in">
				<p className="text-lg mb-2">Form not found</p>
				<button onClick={() => navigate('dashboard')} className="text-brand-500 hover:underline text-sm">
					Go back
				</button>
			</div>
		)
	}

	// --- Key fields for table (first 3 respondent-answer fields) ---
	const tableFields = responseFields(fields).slice(0, 3)

	// ========================================================================
	// RENDER
	// ========================================================================
	return (
		<div className="animate-fade-in rounded-b-2xl border border-t-0 border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark sm:p-6">
			{/* ---------------------------------------------------------------- */}
			{/* Sub-tabs                                                         */}
			{/* ---------------------------------------------------------------- */}
			<div className="border-b border-slate-100 dark:border-gray-800 mb-5 -mx-5 sm:-mx-6 px-5 sm:px-6">
				<div className="flex items-center justify-between gap-4">
					<div>
						<h2 className="text-[24px] font-bold text-slate-950 dark:text-gray-100 tracking-[-0.01em]">Responses</h2>
						<p className="text-[14px] text-slate-500 dark:text-gray-400 mt-1.5">Review, organise and understand every submission.</p>
					</div>
					<button
						onClick={() => setShowExportModal(true)}
						disabled={responses.length === 0}
						className="hidden sm:inline-flex items-center gap-2 kf-control px-5 py-3 text-[14px] font-semibold disabled:opacity-45 disabled:cursor-not-allowed"
					>
						<Download className="h-4 w-4" />
						Export
					</button>
				</div>
				<nav className="flex gap-2 mt-5 overflow-x-auto pb-1" aria-label="Response tabs">
					{SUB_TABS.map(tab => {
						const Icon = tab.icon
						return (
							<button
								key={tab.key}
								onClick={() => switchSubTab(tab.key)}
							className={`relative inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition-colors duration-200 ${
								subTab === tab.key
									? 'bg-brand-50 text-brand-700 dark:bg-brand-900/25 dark:text-brand-300'
										: 'text-gray-400 dark:text-gray-500 hover:bg-slate-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300'
								}`}
							>
								<Icon className="h-4 w-4" />
								{tab.label}
								{tab.key === 'all' && responses.length > 0 && <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-800">{responses.length}</span>}
							</button>
						)
					})}
				</nav>
			</div>

			{/* ---------------------------------------------------------------- */}
			{/* ALL TAB                                                          */}
			{/* ---------------------------------------------------------------- */}
			{subTab === 'all' && (
				<>
					{responses.length === 0 ? (
						<EmptyState formId={formId} navigate={navigate} form={form} />
					) : (
						<>
							<ResponseOverview
								totalResponses={responses.length}
								completionRate={completionStats.rate}
								dropOff={completionStats.dropOff}
								overview={responseOverview}
							/>

							{/* Controls bar */}
							<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
								<div className="relative flex-1 min-w-0 w-full sm:max-w-xs">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
									<input
										type="text"
										value={search}
										onChange={e => setSearch(e.target.value)}
										placeholder="Search responses..."
										className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm outline-none transition-all placeholder-gray-400 focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:focus:bg-surface-elevated-dark"
									/>
								</div>
								<div className="flex items-center gap-2 flex-wrap">
									{dateRangeLabel && (
										<span className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-800">
											<Calendar className="h-3.5 w-3.5" />
											{dateRangeLabel}
										</span>
									)}
									<button
										onClick={() => toggleSort('_date')}
										className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-surface-elevated-dark rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
									>
										<ArrowUpDown className="h-3.5 w-3.5" />
										{sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
									</button>
								</div>
							</div>

							{/* Response table */}
							<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-surface-elevated-dark">
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
												<th className="px-4 py-3 w-10">
													<input
														type="checkbox"
														checked={selectedIds.size === paginatedResponses.length && paginatedResponses.length > 0}
														onChange={selectAll}
														className="rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500/20"
													/>
												</th>
												<th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
													#
												</th>
												<th
													onClick={() => toggleSort('_date')}
													className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
												>
													<span className="inline-flex items-center gap-1">
														Submitted
														{sortCol === '_date' ? (
															<span className="text-brand-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
														) : (
															<ArrowUpDown className="h-3 w-3 opacity-30" />
														)}
													</span>
												</th>
												{tableFields.map(field => (
													<th
														key={field.id}
														onClick={() => toggleSort(field.id)}
														className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
													>
														<span className="inline-flex items-center gap-1">
											{staticFieldLabel(field)}
															{sortCol === field.id ? (
																<span className="text-brand-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
															) : (
																<ArrowUpDown className="h-3 w-3 opacity-30" />
															)}
														</span>
													</th>
												))}
												<th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
													Status
												</th>
												<th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
													Completion
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
											{paginatedResponses.map((response, index) => {
												const data = parseResponseData(response)
												const submittedAt = response.submittedAt
													? new Date(Number(response.submittedAt)).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
													: ''
												const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index
												const responseNum = filteredResponses.length - globalIndex
												const completionPct = responseCompletionPct(fields, data)
												const isComplete = completionPct === 100

												return (
													<tr
														key={response.id}
														onClick={() => setSelectedResponse(response.id)}
														className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer group"
													>
														<td className="px-4 py-3">
															<input
																type="checkbox"
																checked={selectedIds.has(response.id)}
																onChange={() => toggleSelect(response.id)}
																className="rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500/20"
																onClick={e => e.stopPropagation()}
															/>
														</td>
														<td className="px-4 py-3 text-gray-400 dark:text-gray-500 tabular-nums text-xs font-medium">
															{responseNum}
														</td>
														<td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
															{submittedAt}
														</td>
														{tableFields.map(field => {
															const formatted = formatResponseValue(field, data[field.id])
															return (
																<td key={field.id} className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-[180px] truncate text-sm">
																	{formatted.kind === 'empty' ? <span className="text-gray-300 dark:text-gray-600">—</span> : formatted.values.join(', ')}
																</td>
															)
														})}
														<td className="px-4 py-3">
															<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
																isComplete
																	? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
																	: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
															}`}>
																{isComplete ? 'Complete' : 'Partial'}
															</span>
														</td>
														<td className="px-4 py-3">
															<div className="flex items-center gap-2">
																<div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
																	<div
																		className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-amber-400'}`}
																		style={{ width: `${completionPct}%` }}
																	/>
																</div>
																<span className="text-[10px] text-gray-400 tabular-nums">{completionPct}%</span>
															</div>
														</td>
													</tr>
												)
											})}
										</tbody>
									</table>
								</div>

								{/* Pagination */}
								{filteredResponses.length > ITEMS_PER_PAGE && (
									<div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20">
										<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
											{paginationStart}-{paginationEnd} of {filteredResponses.length}
										</span>
										<div className="flex items-center gap-1">
											<button
												onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
												disabled={currentPage === 1}
												className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
											>
												<ChevronLeft className="h-4 w-4" />
											</button>
											{Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
												let pageNum: number
												if (totalPages <= 5) {
													pageNum = i + 1
												} else if (currentPage <= 3) {
													pageNum = i + 1
												} else if (currentPage >= totalPages - 2) {
													pageNum = totalPages - 4 + i
												} else {
													pageNum = currentPage - 2 + i
												}
												return (
													<button
														key={pageNum}
														onClick={() => setCurrentPage(pageNum)}
														className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
															currentPage === pageNum
																? 'bg-brand-500 text-white shadow-sm'
																: 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
														}`}
													>
														{pageNum}
													</button>
												)
											})}
											<button
												onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
												disabled={currentPage === totalPages}
												className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
											>
												<ChevronRight className="h-4 w-4" />
											</button>
										</div>
									</div>
								)}
							</div>
						</>
					)}
				</>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* ANALYTICS TAB                                                    */}
			{/* ---------------------------------------------------------------- */}
			{subTab === 'analytics' && (
				<>
					{responses.length === 0 ? (
						<EmptyState formId={formId} navigate={navigate} form={form} />
					) : (
						<AnalyticsView fields={fields} responses={responses} />
					)}
				</>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* FIELD INSIGHTS TAB                                               */}
			{/* ---------------------------------------------------------------- */}
			{subTab === 'insights' && (
				<>
					{responses.length === 0 ? (
						<EmptyState formId={formId} navigate={navigate} form={form} />
					) : (
						<FieldInsightsView fields={fields} responses={responses} />
					)}
				</>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* TO DO TAB                                                        */}
			{/* ---------------------------------------------------------------- */}
			{subTab === 'todo' && (
				<FollowUpView
					fields={fields}
					responses={responses}
					onOpenResponse={setSelectedResponse}
					onInspectField={(fieldId) => {
						void fieldId
						switchSubTab('insights')
						setSearch('')
					}}
				/>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* Bulk action bar                                                  */}
			{/* ---------------------------------------------------------------- */}
			{selectedIds.size > 0 && (
				<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-scale-in">
					<div className="flex items-center gap-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-2xl shadow-2xl px-5 py-3 backdrop-blur-sm">
						<span className="text-sm font-medium">{selectedIds.size} selected</span>
						<button
							onClick={() => setSelectedIds(new Set())}
							className="text-xs text-gray-400 dark:text-gray-600 hover:text-white dark:hover:text-gray-900 transition-colors"
						>
							Clear
						</button>
						<div className="w-px h-5 bg-gray-700 dark:bg-gray-300" />
						<button
							onClick={() => exportCsv(undefined, responses.filter(response => selectedIds.has(String(response.id))))}
							className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-200 dark:text-gray-700 hover:text-white dark:hover:text-gray-900 transition-colors"
						>
							<Download className="h-3.5 w-3.5" />
							Export
						</button>
						<div className="w-px h-5 bg-gray-700 dark:bg-gray-300" />
						<button
							onClick={deleteSelected}
							className="inline-flex items-center gap-1.5 text-sm font-medium text-red-400 dark:text-red-600 hover:text-red-300 dark:hover:text-red-500 transition-colors"
						>
							<Trash2 className="h-3.5 w-3.5" />
							Delete
						</button>
					</div>
				</div>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* Response detail slide-out                                        */}
			{/* ---------------------------------------------------------------- */}
			{selectedResponse && (
				<ResponseSlideOut
					responseId={selectedResponse}
					responses={filteredResponses}
					fields={fields}
					onClose={() => setSelectedResponse(null)}
					onNavigate={setSelectedResponse}
					onDelete={(id) => {
						app.responses.delete(id)
						setSelectedResponse(null)
					}}
				/>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* Export modal                                                     */}
			{/* ---------------------------------------------------------------- */}
			{showExportModal && (
				<ExportModal
					fields={fields}
					responseCount={responses.length}
					formTitle={String(form.title || 'Form')}
					onExportCsv={exportCsv}
					onExportJson={exportJson}
					onExportPdf={exportPdf}
					onClose={() => setShowExportModal(false)}
				/>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* Share modal                                                      */}
			{/* ---------------------------------------------------------------- */}
			{showShareModal && (
				<ShareModal
					slug={String(form.slug || formId)}
					title={String(form.title || 'Form')}
					onClose={() => setShowShareModal(false)}
				/>
			)}
		</div>
	)
}

// ============================================================================
// StatCard Component
// ============================================================================

interface ResponseOverviewData {
	lastResponseAt: number | null
	avgDuration: number | null
	medianDuration: number | null
	mobilePct: number | null
	lowFillFields: { field: FormField; filled: number; missing: number; pct: number }[]
	requiredGaps: { field: FormField; missing: number }[]
	topField: { field: FormField; filled: number; missing: number; pct: number } | null
}

function ResponseOverview({
	totalResponses,
	completionRate,
	dropOff,
	overview,
}: {
	totalResponses: number
	completionRate: number
	dropOff: number
	overview: ResponseOverviewData
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
				<ResponseMetric label="Median" value={overview.medianDuration ? formatDuration(overview.medianDuration) : '—'} helper="Completion time" />
				<ResponseMetric label="Mobile" value={overview.mobilePct == null ? '—' : `${overview.mobilePct}%`} helper="Respondents" />
			</div>
		</section>
	)
}

function ResponseMetric({ label, value, helper, tone = 'neutral' }: { label: string; value: string; helper: string; tone?: 'neutral' | 'good' | 'warn' }) {
	const valueClass = tone === 'good' ? 'text-emerald-700 dark:text-emerald-300' : tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-950 dark:text-gray-100'
	return (
		<div className="min-w-0 md:border-l md:border-slate-100 md:pl-4 md:dark:border-gray-800">
			<p className="text-[11px] font-medium text-slate-400 dark:text-gray-500">{label}</p>
			<p className={`mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight ${valueClass}`}>{value}</p>
			<p className="truncate text-[11px] text-slate-400 dark:text-gray-600">{helper}</p>
		</div>
	)
}

function StatCard({
	icon,
	iconBg,
	iconColor,
	label,
	value,
	trend,
}: {
	icon: React.ReactNode
	iconBg: string
	iconColor: string
	label: string
	value: string
	trend?: 'up' | 'down' | 'flat'
}) {
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 shadow-sm">
			<div className="flex items-start justify-between mb-3">
				<div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>
					{icon}
				</div>
				{trend && (
					<span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
						trend === 'up' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
						trend === 'down' ? 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400' :
						'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
					}`}>
						{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
					</span>
				)}
			</div>
			<p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums tracking-tight">{value}</p>
			<p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
		</div>
	)
}

// ============================================================================
// Empty State
// ============================================================================

function FollowUpView({
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
		const dataFields = responseFields(fields)
		const requiredFields = dataFields.filter(field => field.required)
		const parsed = responses.map(response => ({
			response,
			data: parseResponseData(response),
			meta: parseResponseMeta(response),
			completion: responseCompletionPct(fields, parseResponseData(response)),
		}))
		const incomplete = parsed
			.map(item => ({
				...item,
				missingFields: requiredFields.filter(field => !isFilledValue(item.data[field.id])),
			}))
			.filter(item => item.missingFields.length > 0)
			.slice(0, 8)

		const durations = parsed
			.map(item => item.meta?.duration)
			.filter((value): value is number => typeof value === 'number' && value > 0 && value < 86400)
		const slowThreshold = durations.length > 0 ? Math.max(300, median(durations) * 1.75) : 300
		const slow = parsed
			.filter(item => typeof item.meta?.duration === 'number' && item.meta.duration > slowThreshold)
			.sort((a, b) => (Number(b.meta?.duration) || 0) - (Number(a.meta?.duration) || 0))
			.slice(0, 6)

		const lowFillFields = dataFields
			.map(field => {
				const filled = parsed.filter(item => isFilledValue(item.data[field.id])).length
				return {
					field,
					filled,
					missing: Math.max(0, responses.length - filled),
					pct: responses.length > 0 ? Math.round((filled / responses.length) * 100) : 0,
				}
			})
			.filter(item => item.pct < 75)
			.sort((a, b) => a.pct - b.pct)
			.slice(0, 6)

		const identityFields = dataFields.filter(field => ['email', 'phone'].includes(field.type) || /email|phone|name/i.test(field.label))
		const duplicateGroups = identityFields.flatMap(field => {
			const counts = new Map<string, Record<string, unknown>[]>()
			for (const item of parsed) {
				const value = item.data[field.id]?.trim().toLowerCase()
				if (!value) continue
				counts.set(value, [...(counts.get(value) || []), item.response])
			}
			return Array.from(counts.entries())
				.filter(([, items]) => items.length > 1)
				.map(([value, items]) => ({ field, value, responses: items }))
		}).slice(0, 6)

		return { incomplete, slow, lowFillFields, duplicateGroups, slowThreshold }
	}, [fields, responses])

	const hasWork = review.incomplete.length > 0 || review.slow.length > 0 || review.lowFillFields.length > 0 || review.duplicateGroups.length > 0

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
							KoraForms scans required gaps, slow submissions, low-fill fields, and duplicate-looking respondents.
						</p>
					</div>
					<div className="grid grid-cols-4 gap-2 text-center">
						<QueueCount label="Incomplete" value={review.incomplete.length} />
						<QueueCount label="Slow" value={review.slow.length} />
						<QueueCount label="Fields" value={review.lowFillFields.length} />
						<QueueCount label="Dupes" value={review.duplicateGroups.length} />
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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

function ReviewSection({ title, description, empty, children }: { title: string; description: string; empty: string; children: React.ReactNode }) {
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
	onOpen,
}: {
	response: Record<string, unknown>
	title: string
	detail: string
	badge: string
	onOpen: () => void
}) {
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
			<span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{badge}</span>
		</button>
	)
}

function EmptyState({
	formId,
	navigate,
	form,
}: {
	formId: string
	navigate: (path: string) => void
	form: Record<string, unknown>
}) {
	const [copied, setCopied] = useState(false)

	const copyLink = () => {
		const slug = String(form.slug || formId)
		const url = `${window.location.origin}/f/${slug}`
		navigator.clipboard.writeText(url)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	return (
		<div className="flex flex-col items-center justify-center py-16 animate-fade-in">
			{/* Icon */}
			<div className="relative mb-8">
				<div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 flex items-center justify-center shadow-lg shadow-gray-100/50 dark:shadow-none">
					<Inbox className="h-10 w-10 text-gray-300 dark:text-gray-600" />
				</div>
			</div>

			{/* Message */}
			<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No responses yet</h2>
			<p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mb-8 leading-relaxed">
				Share your form to start collecting data. New submissions will appear here automatically — even when you are offline.
			</p>

			{/* Buttons */}
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

			{/* Steps */}
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

			{/* Offline banner */}
			<div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 px-4 py-2.5 mb-8">
				<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
				<span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Ready to collect offline</span>
			</div>

			{/* Analytics teaser */}
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

// ============================================================================
// Export Modal
// ============================================================================

function ExportModal({
	fields,
	responseCount,
	formTitle,
	onExportCsv,
	onExportJson,
	onExportPdf,
	onClose,
}: {
	fields: FormField[]
	responseCount: number
	formTitle: string
	onExportCsv: (fieldIds?: string[], sourceResponses?: Record<string, unknown>[], includeMetadata?: boolean) => void
	onExportJson: (fieldIds?: string[], sourceResponses?: Record<string, unknown>[], includeMetadata?: boolean) => void
	onExportPdf: () => void
	onClose: () => void
}) {
	const [format, setFormat] = useState<ExportFormat>('csv')
	const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(
		new Set(responseFields(fields).map(f => f.id))
	)
	const [includeMetadata, setIncludeMetadata] = useState(true)

	const dataFields = responseFields(fields)

	const toggleField = (id: string) => {
		setSelectedFieldIds(prev => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const handleExport = () => {
		const ids = Array.from(selectedFieldIds)
		if (format === 'csv') onExportCsv(ids, undefined, includeMetadata)
		else onExportJson(ids, undefined, includeMetadata)
		onClose()
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
			<div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
			<div className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-surface-elevated-dark rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Export responses</h2>
					<button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors">
						<X className="h-4 w-4 text-gray-400" />
					</button>
				</div>

				<div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
					{/* Format tabs */}
					<div>
						<label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Format</label>
						<div className="flex gap-2">
							{(['csv', 'json'] as const).map(f => (
								<button
									key={f}
									onClick={() => setFormat(f)}
									className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
										format === f
											? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800'
											: 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
									}`}
								>
									{f === 'csv' ? (
										<span className="inline-flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" />CSV</span>
									) : (
										<span className="inline-flex items-center gap-1.5"><FileJson className="h-3.5 w-3.5" />JSON</span>
									)}
								</button>
							))}
						</div>
					</div>

					{/* Fields */}
					<div>
						<label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Fields</label>
						<div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 p-3">
							{dataFields.map(f => (
								<label key={f.id} className="flex items-center gap-2 cursor-pointer py-0.5">
									<input
										type="checkbox"
										checked={selectedFieldIds.has(f.id)}
										onChange={() => toggleField(f.id)}
										className="rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500/20"
									/>
									<span className="text-sm text-gray-700 dark:text-gray-300 truncate">{f.label || f.id}</span>
								</label>
							))}
						</div>
					</div>

					{/* Include metadata */}
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={includeMetadata}
							onChange={e => setIncludeMetadata(e.target.checked)}
							className="rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500/20"
						/>
						<span className="text-sm text-gray-700 dark:text-gray-300">Include submission date and status</span>
					</label>

					{/* Warning */}
					<div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 px-4 py-3">
						<p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
							This export may contain personal information.
						</p>
					</div>

					{/* Summary */}
					<div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
						<span>Generated on this device</span>
						<span className="tabular-nums">{format.toUpperCase()} · {responseCount} responses · {selectedFieldIds.size} fields</span>
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
					<button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
						Cancel
					</button>
					<button
						onClick={handleExport}
						className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors shadow-sm"
					>
						<Download className="h-4 w-4" />
						Export {responseCount} responses
					</button>
				</div>
			</div>
		</div>
	)
}

// ============================================================================
// Response Slide-Out Panel
// ============================================================================

function ResponseSlideOut({
	responseId,
	responses,
	fields,
	onClose,
	onNavigate,
	onDelete,
}: {
	responseId: string
	responses: Record<string, unknown>[]
	fields: FormField[]
	onClose: () => void
	onNavigate: (id: string) => void
	onDelete: (id: string) => void
}) {
	const currentIndex = responses.findIndex(r => r.id === responseId)
	const response = responses[currentIndex]
	const hasPrev = currentIndex > 0
	const hasNext = currentIndex < responses.length - 1
	const responseNumber = responses.length - currentIndex

	let data: Record<string, unknown> = {}
	try { data = JSON.parse(String(response?.data || '{}')) } catch { /* ignore */ }

	const meta = data._meta as { duration?: number; ua?: string; screen?: string; startedAt?: number } | undefined
	const uaInfo = meta?.ua ? parseUA(meta.ua) : null
	const submittedAt = response?.submittedAt ? new Date(Number(response.submittedAt)) : null

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
			else if (e.key === 'ArrowUp' && hasPrev) onNavigate(String(responses[currentIndex - 1]?.id))
			else if (e.key === 'ArrowDown' && hasNext) onNavigate(String(responses[currentIndex + 1]?.id))
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [currentIndex, hasPrev, hasNext, onClose, onNavigate, responses])

	const copyToClipboard = () => {
		const lines: string[] = []
		lines.push(`Response #${responseNumber}`)
		if (submittedAt) lines.push(`Submitted: ${submittedAt.toLocaleString()}`)
		lines.push('')
		for (const field of responseFields(fields)) {
			const value = data[field.id]
			const formatted = formatResponseValue(field, value)
			lines.push(`${fieldLabel(field, data, fields)}: ${formatted.kind === 'empty' ? '(empty)' : formatted.values.join(', ')}`)
		}
		if (meta?.duration) { lines.push(''); lines.push(`Duration: ${formatDuration(Math.round(meta.duration))}`) }
		if (uaInfo) lines.push(`Device: ${uaInfo.device} | Browser: ${uaInfo.browser} | OS: ${uaInfo.os}`)
		navigator.clipboard.writeText(lines.join('\n'))
	}

	if (!response) return null

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300"
				onClick={onClose}
			/>

			{/* Slide-out panel */}
			<div className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] bg-white dark:bg-surface-elevated-dark shadow-2xl flex flex-col animate-slide-in-right">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
					<div className="min-w-0">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
							Response #{responseNumber}
						</h2>
						{submittedAt && (
							<p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
								{submittedAt.toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {submittedAt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
							</p>
						)}
					</div>
					<button
						onClick={onClose}
						className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors shrink-0"
					>
						<X className="h-4 w-4 text-gray-400" />
					</button>
				</div>

				{/* Navigation */}
				<div className="flex items-center justify-between px-6 py-2 border-b border-gray-50 dark:border-gray-800/50 shrink-0">
					<span className="text-[11px] text-gray-400 tabular-nums">{currentIndex + 1} of {responses.length}</span>
					<div className="flex items-center gap-1">
						<button
							onClick={() => hasPrev && onNavigate(String(responses[currentIndex - 1]?.id))}
							disabled={!hasPrev}
							className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
						<button
							onClick={() => hasNext && onNavigate(String(responses[currentIndex + 1]?.id))}
							disabled={!hasNext}
							className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						>
							<ChevronRight className="h-4 w-4" />
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto px-6 py-5">
					{/* Metadata bar */}
					{meta && (
						<div className="flex flex-wrap items-center gap-3 mb-5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
							{meta.duration != null && meta.duration > 0 && (
								<span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
									<Timer className="h-3.5 w-3.5 text-gray-400" />
									{formatDuration(Math.round(meta.duration))}
								</span>
							)}
							{uaInfo && (
								<>
									<span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
										{uaInfo.device === 'Mobile' ? <Smartphone className="h-3.5 w-3.5 text-gray-400" /> : <Monitor className="h-3.5 w-3.5 text-gray-400" />}
										{uaInfo.device}
									</span>
									<span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
										<Globe className="h-3.5 w-3.5 text-gray-400" />
										{uaInfo.browser} / {uaInfo.os}
									</span>
								</>
							)}
							{meta.screen && (
								<span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
									<Monitor className="h-3.5 w-3.5 text-gray-400" />
									{meta.screen}
								</span>
							)}
						</div>
					)}

					{/* Divider label */}
					<div className="flex items-center gap-2 mb-4">
						<span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Answers</span>
						<div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
					</div>

					{/* Field answers */}
					<div className="space-y-4">
						{responseFields(fields).map(field => {
							const value = data[field.id]
							const formatted = formatResponseValue(field, value)
							return (
								<div key={field.id} className="rounded-xl bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 p-4">
									<p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
										{fieldLabel(field, data, fields)}
										{field.required && <span className="text-red-400 ml-0.5">*</span>}
									</p>
									{formatted.kind === 'list' ? (
										<div className="flex flex-wrap gap-1.5">
											{formatted.values.map(item => (
												<span key={item} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700">
													{item}
												</span>
											))}
										</div>
									) : formatted.kind === 'text' ? (
										<p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap break-words">
											{formatted.values[0]}
										</p>
									) : (
										<p className="text-sm text-gray-300 dark:text-gray-600 italic">Empty</p>
									)}
								</div>
							)
						})}
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 shrink-0">
					<div className="flex items-center gap-1.5">
						<button
							onClick={copyToClipboard}
							className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						>
							<Copy className="h-3.5 w-3.5" />
							Copy
						</button>
						<button
							onClick={() => { if (window.confirm('Delete this response?')) onDelete(String(response.id)) }}
							className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
						>
							<Trash2 className="h-3.5 w-3.5" />
							Delete
						</button>
					</div>
					<button
						onClick={onClose}
						className="inline-flex items-center rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 transition-colors shadow-sm"
					>
						Done
					</button>
				</div>
			</div>

		</>
	)
}

// ============================================================================
// Chart Helper Components (used by AnalyticsView and FieldInsightsView)
// ============================================================================

interface TooltipState { x: number; y: number; content: string }

function ChartTooltip({ tooltip }: { tooltip: TooltipState | null }) {
	if (!tooltip) return null
	return (
		<div
			className="pointer-events-none absolute z-50 rounded-lg bg-gray-900 dark:bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-white dark:text-gray-900 shadow-lg whitespace-nowrap transition-opacity duration-150"
			style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%) translateY(-8px)' }}
		>
			{tooltip.content}
			<div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
		</div>
	)
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
	if (data.length < 2) return null
	const w = 64; const h = 20
	const max = Math.max(...data, 1); const min = Math.min(...data, 0)
	const range = max - min || 1
	const points = data.map((v, i) => {
		const x = (i / (data.length - 1)) * w
		const y = h - ((v - min) / range) * (h - 2) - 1
		return `${x},${y}`
	})
	return (
		<svg width={w} height={h} className={className} viewBox={`0 0 ${w} ${h}`}>
			<polyline points={points.join(' ')} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-brand-500" />
		</svg>
	)
}

function SummaryCard({ label, value, trend, sparkData }: { label: string; value: string; trend: number | null; sparkData: number[] }) {
	const trendPositive = trend !== null && trend > 0
	const trendNegative = trend !== null && trend < 0
	const trendZero = trend !== null && trend === 0
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-4 shadow-sm flex flex-col gap-2">
			<span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</span>
			<div className="flex items-end justify-between gap-2">
				<div className="flex items-baseline gap-2 min-w-0">
					<span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums truncate">{value}</span>
					{trend !== null && (
						<span className={`text-xs font-semibold tabular-nums flex items-center gap-0.5 ${
							trendPositive ? 'text-emerald-600 dark:text-emerald-400' : trendNegative ? 'text-red-500 dark:text-red-400' : 'text-gray-400'
						}`}>
							{trendPositive && <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0"><path d="M5 1 L9 6 L1 6 Z" fill="currentColor" /></svg>}
							{trendNegative && <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0"><path d="M5 9 L9 4 L1 4 Z" fill="currentColor" /></svg>}
							{trendZero ? '0%' : `${trend > 0 ? '+' : ''}${trend}%`}
						</span>
					)}
				</div>
				<Sparkline data={sparkData} className="shrink-0 opacity-60" />
			</div>
		</div>
	)
}

// ============================================================================
// Bar Chart (responses over time)
// ============================================================================

function ResponsesBarChart({ data }: { data: { date: Date; count: number; label: string }[] }) {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null)
	if (data.length === 0) return null
	const maxCount = Math.max(...data.map(d => d.count), 1)
	const yTicks = useMemo(() => {
		if (maxCount <= 4) return Array.from({ length: maxCount + 1 }, (_, i) => i)
		const step = Math.ceil(maxCount / 4)
		const ticks: number[] = []
		for (let v = 0; v <= maxCount; v += step) ticks.push(v)
		if (ticks[ticks.length - 1] !== maxCount && maxCount - (ticks[ticks.length - 1] ?? 0) > step * 0.3) ticks.push(maxCount)
		return ticks
	}, [maxCount])
	const chartHeight = 200; const chartPadLeft = 40; const chartPadRight = 12; const chartPadTop = 8; const chartPadBottom = 28
	const innerH = chartHeight - chartPadTop - chartPadBottom; const barGap = 2
	const xLabelStep = Math.max(1, Math.ceil(data.length / 8))
	const chartRef = 'responses-over-time-chart'

	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 relative shadow-sm">
			<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Responses Over Time</h3>
			<div className="relative" data-chart={chartRef} style={{ height: chartHeight }}>
				<ChartTooltip tooltip={tooltip} />
				<svg width="100%" height={chartHeight} viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none" className="overflow-visible" style={{ width: '100%' }}>
					{yTicks.map(tick => {
						const y = chartPadTop + innerH - (tick / maxCount) * innerH
						return <line key={tick} x1={chartPadLeft} x2={100 - chartPadRight} y1={y} y2={y} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
					})}
				</svg>
				<div className="absolute inset-0 flex" style={{ paddingLeft: chartPadLeft, paddingRight: chartPadRight, paddingTop: chartPadTop, paddingBottom: chartPadBottom }}>
					<div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between" style={{ paddingTop: chartPadTop, paddingBottom: chartPadBottom, width: chartPadLeft }}>
						{[...yTicks].reverse().map(tick => (
							<span key={tick} className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums text-right pr-2 leading-none">{tick}</span>
						))}
					</div>
					<div className="flex-1 flex items-end" style={{ gap: barGap }}>
						{data.map((d, i) => {
							const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0
							return (
								<div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full relative group"
									onMouseMove={e => {
										const rect = e.currentTarget.getBoundingClientRect()
										const parentRect = e.currentTarget.closest(`[data-chart="${chartRef}"]`)?.getBoundingClientRect()
										if (parentRect) {
											setTooltip({
												x: rect.left + rect.width / 2 - parentRect.left,
												y: chartPadTop + innerH - (pct / 100) * innerH,
												content: `${shortDate(d.date)}: ${d.count} response${d.count !== 1 ? 's' : ''}`,
											})
										}
									}}
									onMouseLeave={() => setTooltip(null)}
								>
									<div className="w-full rounded-t-[3px] bg-brand-500/80 group-hover:bg-brand-500 transition-all duration-200 min-h-[2px]" style={{ height: `${Math.max(pct, d.count > 0 ? 2 : 0)}%` }} />
									{i % xLabelStep === 0 && <span className="absolute -bottom-5 text-[9px] text-gray-400 dark:text-gray-500 whitespace-nowrap">{shortDate(d.date)}</span>}
								</div>
							)
						})}
					</div>
				</div>
			</div>
		</div>
	)
}

// ============================================================================
// Calendar Heatmap
// ============================================================================

function CalendarHeatmap({ responses }: { responses: Record<string, unknown>[] }) {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null)
	const { weeks, maxCount, monthLabels } = useMemo(() => {
		const counts: Record<string, number> = {}
		for (const r of responses) {
			if (r.submittedAt) { const key = dateKey(new Date(Number(r.submittedAt))); counts[key] = (counts[key] ?? 0) + 1 }
		}
		const today = new Date(); today.setHours(0, 0, 0, 0)
		const totalWeeks = 52; const totalDays = totalWeeks * 7
		const endDay = new Date(today); const startDay = new Date(today)
		startDay.setDate(startDay.getDate() - totalDays + 1)
		const startDow = startDay.getDay(); startDay.setDate(startDay.getDate() - startDow)
		const weeksArr: { date: Date; key: string; count: number; dow: number }[][] = []
		let currentWeek: { date: Date; key: string; count: number; dow: number }[] = []
		const cursor = new Date(startDay)
		while (cursor <= endDay || currentWeek.length > 0) {
			const key = dateKey(cursor); const dow = cursor.getDay()
			currentWeek.push({ date: new Date(cursor), key, count: counts[key] ?? 0, dow })
			if (dow === 6 || cursor.getTime() === endDay.getTime()) { weeksArr.push(currentWeek); currentWeek = [] }
			cursor.setDate(cursor.getDate() + 1)
			if (cursor > endDay && currentWeek.length === 0) break
		}
		const max = Math.max(...Object.values(counts), 1)
		const months: { label: string; weekIndex: number }[] = []
		let lastMonth = -1
		for (let wi = 0; wi < weeksArr.length; wi++) {
			const firstDayOfWeek = weeksArr[wi]?.[0]
			if (firstDayOfWeek) { const m = firstDayOfWeek.date.getMonth(); if (m !== lastMonth) { months.push({ label: firstDayOfWeek.date.toLocaleDateString(undefined, { month: 'short' }), weekIndex: wi }); lastMonth = m } }
		}
		return { weeks: weeksArr, maxCount: max, monthLabels: months }
	}, [responses])

	const cellSize = 11; const cellGap = 3; const dayLabelWidth = 30; const topPad = 20
	const gridWidth = dayLabelWidth + weeks.length * (cellSize + cellGap) + cellSize
	const gridHeight = topPad + 7 * (cellSize + cellGap)

	function heatColor(count: number): string {
		if (count === 0) return 'fill-gray-100 dark:fill-gray-800'
		const ratio = count / maxCount
		if (ratio <= 0.15) return 'fill-brand-100 dark:fill-brand-900/50'
		if (ratio <= 0.3) return 'fill-brand-200 dark:fill-brand-800/60'
		if (ratio <= 0.5) return 'fill-brand-300 dark:fill-brand-700/70'
		if (ratio <= 0.75) return 'fill-brand-400 dark:fill-brand-600'
		return 'fill-brand-600 dark:fill-brand-500'
	}

	const dayLabels = [{ dow: 0, label: 'Sun' }, { dow: 1, label: 'Mon' }, { dow: 2, label: 'Tue' }, { dow: 3, label: 'Wed' }, { dow: 4, label: 'Thu' }, { dow: 5, label: 'Fri' }, { dow: 6, label: 'Sat' }]

	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 relative shadow-sm">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Activity</h3>
					<p className="text-[11px] text-gray-400 dark:text-gray-500">Last year</p>
				</div>
				<span className="text-[11px] text-gray-400 dark:text-gray-500">{responses.length} total</span>
			</div>
			<div className="relative overflow-x-auto rounded-xl border border-slate-100 px-4 py-3 dark:border-gray-800">
				<ChartTooltip tooltip={tooltip} />
				<svg viewBox={`0 0 ${gridWidth} ${gridHeight}`} className="block w-full min-w-[760px] overflow-visible">
					{monthLabels.map(m => <text key={`${m.label}-${m.weekIndex}`} x={dayLabelWidth + m.weekIndex * (cellSize + cellGap)} y={10} className="fill-gray-400 dark:fill-gray-500 text-[9px]" fontSize="9">{m.label}</text>)}
					{dayLabels.filter(({ dow }) => dow % 2 === 1).map(({ dow, label }) => <text key={dow} x={0} y={topPad + dow * (cellSize + cellGap) + cellSize - 1} className="fill-gray-400 dark:fill-gray-500 text-[9px]" fontSize="9">{label}</text>)}
					{weeks.map((week, wi) => week.map(day => (
						<rect key={day.key} x={dayLabelWidth + wi * (cellSize + cellGap)} y={topPad + day.dow * (cellSize + cellGap)} width={cellSize} height={cellSize} rx={2.5} className={`${heatColor(day.count)} transition-colors duration-200 cursor-default`}
							onMouseMove={e => { const rect = e.currentTarget.getBoundingClientRect(); const parentRect = e.currentTarget.closest('.relative')?.getBoundingClientRect(); if (parentRect) setTooltip({ x: rect.left + rect.width / 2 - parentRect.left, y: rect.top - parentRect.top, content: `${shortDate(day.date)}: ${day.count} response${day.count !== 1 ? 's' : ''}` }) }}
							onMouseLeave={() => setTooltip(null)}
						/>
					)))}
				</svg>
			</div>
			<div className="flex items-center gap-1.5 mt-3 text-[9px] text-gray-400 dark:text-gray-500">
				<span>Less</span>
				{[0, 0.15, 0.3, 0.5, 0.75, 1].map((ratio, i) => <svg key={i} width={cellSize} height={cellSize}><rect width={cellSize} height={cellSize} rx={2} className={heatColor(Math.round(ratio * maxCount))} /></svg>)}
				<span>More</span>
			</div>
		</div>
	)
}

// ============================================================================
// Categorical Bar Chart & Histogram
// ============================================================================

function CategoricalBarChart({ counts, total }: { counts: [string, number][]; total: number }) {
	const maxCount = counts[0]?.[1] ?? 1
	const brandShades = ['bg-brand-600 dark:bg-brand-500', 'bg-brand-500 dark:bg-brand-400', 'bg-brand-400 dark:bg-brand-400/80', 'bg-brand-300 dark:bg-brand-300/70', 'bg-brand-200 dark:bg-brand-300/50']
	return (
		<div className="space-y-2.5">
			{counts.map(([label, count], i) => {
				const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0
				const pctOfTotal = total > 0 ? Math.round((count / total) * 100) : 0
				const shade = brandShades[Math.min(i, brandShades.length - 1)] ?? brandShades[brandShades.length - 1]
				return (
					<div key={label}>
						<div className="flex items-center justify-between mb-1">
							<span className="text-sm text-gray-700 dark:text-gray-300 truncate mr-2">{label}</span>
							<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">{count} ({pctOfTotal}%)</span>
						</div>
						<div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
							<div className={`h-full rounded-full transition-all duration-500 ${shade}`} style={{ width: `${widthPct}%` }} />
						</div>
					</div>
				)
			})}
		</div>
	)
}

function MiniHistogram({ values }: { values: number[] }) {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null)
	const bins = useMemo(() => {
		if (values.length === 0) return []
		const sorted = [...values].sort((a, b) => a - b)
		const min = sorted[0] ?? 0; const max = sorted[sorted.length - 1] ?? 0
		const binCount = 5; const range = max - min || 1; const step = range / binCount
		const result: { from: number; to: number; count: number }[] = []
		for (let i = 0; i < binCount; i++) {
			const from = min + step * i; const to = i === binCount - 1 ? max + 0.001 : min + step * (i + 1)
			const count = sorted.filter(v => v >= from && v < to).length
			result.push({ from, to: i === binCount - 1 ? max : to, count })
		}
		return result
	}, [values])
	if (bins.length === 0) return null
	const maxBin = Math.max(...bins.map(b => b.count), 1)
	return (
		<div className="relative mt-3">
			<ChartTooltip tooltip={tooltip} />
			<div className="flex items-end gap-1 h-16">
				{bins.map((bin, i) => {
					const pct = (bin.count / maxBin) * 100
					const fromLabel = Number.isInteger(bin.from) ? bin.from.toString() : bin.from.toFixed(1)
					const toLabel = Number.isInteger(bin.to) ? bin.to.toString() : bin.to.toFixed(1)
					return (
						<div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative"
							onMouseEnter={e => { const rect = e.currentTarget.getBoundingClientRect(); const parentRect = e.currentTarget.closest('.relative')?.getBoundingClientRect(); if (parentRect) setTooltip({ x: rect.left + rect.width / 2 - parentRect.left, y: rect.top - parentRect.top + (64 - (pct / 100) * 64), content: `${fromLabel} - ${toLabel}: ${bin.count}` }) }}
							onMouseLeave={() => setTooltip(null)}
						>
							<div className="w-full rounded-t-sm bg-brand-400/70 group-hover:bg-brand-500 transition-all duration-200 min-h-[2px]" style={{ height: `${Math.max(pct, bin.count > 0 ? 4 : 0)}%` }} />
						</div>
					)
				})}
			</div>
			<div className="flex justify-between mt-1">
				<span className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">{Number.isInteger(bins[0]?.from ?? 0) ? (bins[0]?.from ?? 0).toString() : (bins[0]?.from ?? 0).toFixed(1)}</span>
				<span className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">{Number.isInteger(bins[bins.length - 1]?.to ?? 0) ? (bins[bins.length - 1]?.to ?? 0).toString() : (bins[bins.length - 1]?.to ?? 0).toFixed(1)}</span>
			</div>
		</div>
	)
}

// ============================================================================
// Field Breakdown Card (per-field analysis)
// ============================================================================

interface CategoricalAnalysis { field: FormField; type: 'categorical'; counts: [string, number][]; total: number; fillRate: number }
interface NumericAnalysis { field: FormField; type: 'numeric'; sum: number; avg: number; min: number; max: number; median: number; count: number; fillRate: number; values: number[] }
interface TextAnalysis { field: FormField; type: 'text'; total: number; fillRate: number; uniqueCount: number; topValues: [string, number][] }
type FieldAnalysis = CategoricalAnalysis | NumericAnalysis | TextAnalysis

function filledCountForAnalysis(analysis: FieldAnalysis): number {
	return analysis.type === 'numeric' ? analysis.count : analysis.total
}

function FieldBreakdownCard({ analysis, totalResponses }: { analysis: FieldAnalysis; totalResponses: number }) {
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 shadow-sm">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate mr-2">{staticFieldLabel(analysis.field)}</h3>
				<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">{analysis.fillRate}% fill rate</span>
			</div>
			{analysis.type === 'categorical' && <CategoricalBarChart counts={analysis.counts} total={totalResponses} />}
			{analysis.type === 'numeric' && (
				<div>
					<div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
						{([['Sum', analysis.sum.toLocaleString()], ['Average', analysis.avg.toFixed(1)], ['Median', analysis.median.toFixed(1)], ['Min', analysis.min.toLocaleString()], ['Max', analysis.max.toLocaleString()]] as const).map(([label, value]) => (
							<div key={label}>
								<span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">{label}</span>
								<p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
							</div>
						))}
					</div>
					<MiniHistogram values={analysis.values} />
				</div>
			)}
			{analysis.type === 'text' && (
				<div>
					<div className="flex gap-6 text-sm mb-3">
						<div><span className="text-gray-400 dark:text-gray-500 text-xs">Responses</span><p className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{analysis.total}</p></div>
						<div><span className="text-gray-400 dark:text-gray-500 text-xs">Unique</span><p className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{analysis.uniqueCount}</p></div>
					</div>
					{analysis.topValues.length > 0 && (
						<div>
							<span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">Top values</span>
							<div className="mt-1.5 space-y-1">
								{analysis.topValues.map(([val, count]) => (
									<div key={val} className="flex items-center justify-between text-sm">
										<span className="text-gray-700 dark:text-gray-300 truncate mr-2">{val}</span>
										<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">{count}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

// ============================================================================
// Donut Chart
// ============================================================================

function DonutChart({ data, title }: { data: [string, number][]; title: string }) {
	const total = data.reduce((s, d) => s + d[1], 0)
	if (total === 0) return null
	const colors = ['stroke-brand-500', 'stroke-emerald-500', 'stroke-amber-500', 'stroke-purple-500', 'stroke-rose-500', 'stroke-cyan-500']
	const bgColors = ['bg-brand-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500']
	const radius = 40; const circumference = 2 * Math.PI * radius; let offset = 0
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 shadow-sm">
			<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
			<div className="flex items-center gap-6">
				<svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
					{data.map(([label, count], i) => {
						const pct = count / total; const dashLen = pct * circumference; const dashGap = circumference - dashLen; const currentOffset = offset; offset += dashLen
						return <circle key={label} cx="50" cy="50" r={radius} fill="none" strokeWidth="12" className={colors[i % colors.length]} strokeDasharray={`${dashLen} ${dashGap}`} strokeDashoffset={-currentOffset} transform="rotate(-90 50 50)" />
					})}
					<text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-gray-900 dark:fill-gray-100 text-lg font-bold" fontSize="16">{total}</text>
				</svg>
				<div className="space-y-1.5 min-w-0">
					{data.map(([label, count], i) => (
						<div key={label} className="flex items-center gap-2 text-sm">
							<div className={`w-2.5 h-2.5 rounded-full shrink-0 ${bgColors[i % bgColors.length]}`} />
							<span className="text-gray-700 dark:text-gray-300 truncate">{label}</span>
							<span className="text-xs text-gray-400 tabular-nums ml-auto shrink-0">{count} ({Math.round((count / total) * 100)}%)</span>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

// ============================================================================
// NPS Gauge
// ============================================================================

function NpsGauge({ nps, promoters, passives, detractors, total, fieldLabel }: { nps: number; promoters: number; passives: number; detractors: number; total: number; fieldLabel: string }) {
	const pPct = Math.round((promoters / total) * 100); const paPct = Math.round((passives / total) * 100); const dPct = Math.round((detractors / total) * 100)
	let scoreColor = 'text-red-500'; let scoreBg = 'bg-red-50 dark:bg-red-900/20'
	if (nps >= 50) { scoreColor = 'text-emerald-600 dark:text-emerald-400'; scoreBg = 'bg-emerald-50 dark:bg-emerald-900/20' }
	else if (nps >= 0) { scoreColor = 'text-amber-600 dark:text-amber-400'; scoreBg = 'bg-amber-50 dark:bg-amber-900/20' }
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 shadow-sm">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">NPS Score</h3>
				<span className="text-[10px] text-gray-400 truncate ml-2">{fieldLabel}</span>
			</div>
			<div className="flex items-center gap-5">
				<div className={`w-20 h-20 rounded-2xl ${scoreBg} flex items-center justify-center shrink-0`}>
					<span className={`text-3xl font-bold ${scoreColor} tabular-nums`}>{nps}</span>
				</div>
				<div className="flex-1 space-y-2">
					<div className="flex items-center gap-2 text-xs"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /><span className="text-gray-600 dark:text-gray-400">Promoters (9-10)</span><span className="ml-auto tabular-nums text-gray-500">{promoters} ({pPct}%)</span></div>
					<div className="flex items-center gap-2 text-xs"><div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" /><span className="text-gray-600 dark:text-gray-400">Passives (7-8)</span><span className="ml-auto tabular-nums text-gray-500">{passives} ({paPct}%)</span></div>
					<div className="flex items-center gap-2 text-xs"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" /><span className="text-gray-600 dark:text-gray-400">Detractors (0-6)</span><span className="ml-auto tabular-nums text-gray-500">{detractors} ({dPct}%)</span></div>
				</div>
			</div>
			<div className="flex h-2.5 rounded-full overflow-hidden mt-4">
				{dPct > 0 && <div className="bg-red-500" style={{ width: `${dPct}%` }} />}
				{paPct > 0 && <div className="bg-amber-400" style={{ width: `${paPct}%` }} />}
				{pPct > 0 && <div className="bg-emerald-500" style={{ width: `${pPct}%` }} />}
			</div>
			<p className="text-[10px] text-gray-400 mt-2">{total} responses</p>
		</div>
	)
}

// ============================================================================
// Drop-off Funnel
// ============================================================================

function DropoffFunnel({ data }: { data: { label: string; filled: number; pct: number }[] }) {
	if (data.length === 0) return null
	const weakest = [...data].sort((a, b) => a.pct - b.pct)[0]
	const reviewCount = data.filter(d => d.pct < 75).length
	const watchCount = data.filter(d => d.pct >= 75 && d.pct < 90).length
	return (
		<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-5 shadow-sm">
			<div className="mb-4 flex items-start justify-between gap-4">
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Field completion</h3>
					<p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Spot where respondents slow down or skip questions.</p>
				</div>
				{weakest && reviewCount === 0 && watchCount === 0 && (
					<span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
						All healthy
					</span>
				)}
				{(reviewCount > 0 || watchCount > 0) && (
					<span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${reviewCount > 0 ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}>
						{reviewCount > 0 ? `${reviewCount} review` : `${watchCount} watch`}
					</span>
				)}
			</div>
			<div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60 dark:border-gray-800 dark:bg-gray-900/35">
				{data.map((d, i) => {
					const isDropoff = i > 0 && d.pct < (data[i - 1]?.pct ?? 100) - 10
					const status = d.pct >= 90 ? 'Healthy' : d.pct >= 75 ? 'Watch' : 'Review'
					const statusClass = d.pct >= 90
						? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
						: d.pct >= 75
							? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
							: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
					const barClass = d.pct >= 90
						? 'bg-emerald-400 dark:bg-emerald-500'
						: d.pct >= 75
							? 'bg-amber-400 dark:bg-amber-500'
							: 'bg-brand-500 dark:bg-brand-400'
					return (
						<div key={`${d.label}-${i}`} className="border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-gray-800">
							<div className="grid grid-cols-[1fr_auto] gap-3">
								<div className="min-w-0 pr-2">
									<div className="flex min-w-0 items-center gap-2">
										<span className="w-5 text-[11px] text-gray-400 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
										<span className={`truncate text-[13px] font-semibold ${isDropoff ? 'text-brand-700 dark:text-brand-300' : 'text-gray-800 dark:text-gray-200'}`}>{d.label}</span>
									</div>
									<p className="mt-0.5 pl-7 text-[11px] text-gray-400 dark:text-gray-500">{d.filled} filled · {Math.max(0, data[0]!.filled - d.filled)} fewer than first field</p>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{status}</span>
									<span className="w-9 text-right text-[12px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">{d.pct}%</span>
								</div>
							</div>
							<div className="mt-2 ml-7 h-1.5 overflow-hidden rounded-full bg-white dark:bg-gray-800">
								<div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${d.pct}%` }} />
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

// ============================================================================
// AnalyticsView (full analytics dashboard under the Analytics sub-tab)
// ============================================================================

function AnalyticsView({ fields, responses }: { fields: FormField[]; responses: Record<string, unknown>[] }) {
	const [range, setRange] = useState<TimeRange>('30d')
	const [filters, setFilters] = useState<{ fieldId: string; value: string }[]>([])

	const filtered = useMemo(() => {
		let result = responses
		const days = daysForRange(range)
		if (days !== null) {
			const cutoff = startOfDaysAgo(days)
			result = result.filter(r => { if (!r.submittedAt) return true; return Number(r.submittedAt) >= cutoff })
		}
		if (filters.length > 0) {
			result = result.filter(r => {
				let data: Record<string, string> = {}
				try { data = JSON.parse(String(r.data || '{}')) } catch { return false }
				return filters.every(f => { const v = data[f.fieldId] ?? ''; return v.toLowerCase().includes(f.value.toLowerCase()) })
			})
		}
		return result
	}, [responses, range, filters])

	const previousPeriod = useMemo(() => {
		const days = daysForRange(range)
		if (days === null) return []
		const cutoffCurrent = startOfDaysAgo(days); const cutoffPrev = startOfDaysAgo(days * 2)
		return responses.filter(r => { if (!r.submittedAt) return false; const ts = Number(r.submittedAt); return ts >= cutoffPrev && ts < cutoffCurrent })
	}, [responses, range])

	const allData = useMemo(() => filtered.map(r => { try { return JSON.parse(String(r.data || '{}')) as Record<string, string> } catch { return {} as Record<string, string> } }), [filtered])
	const prevData = useMemo(() => previousPeriod.map(r => { try { return JSON.parse(String(r.data || '{}')) as Record<string, string> } catch { return {} as Record<string, string> } }), [previousPeriod])

	const dailyCounts = useMemo(() => {
		const counts: Record<string, number> = {}
		for (const r of filtered) { if (r.submittedAt) { const key = dateKey(new Date(Number(r.submittedAt))); counts[key] = (counts[key] ?? 0) + 1 } }
		const days = daysForRange(range); const numDays = days ?? 90
		const result: { date: Date; count: number; label: string }[] = []; const today = new Date(); today.setHours(0, 0, 0, 0)
		for (let i = numDays - 1; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const key = dateKey(d); result.push({ date: d, count: counts[key] ?? 0, label: key }) }
		return result
	}, [filtered, range])

	const sparkline7 = useMemo(() => dailyCounts.slice(-7).map(d => d.count), [dailyCounts])
	const totalResponses = filtered.length
	const prevTotalResponses = previousPeriod.length

	const trendPct = (current: number, previous: number): number | null => {
		const days = daysForRange(range)
		if (days === null) return null
		if (previous === 0 && current === 0) return 0
		if (previous === 0) return 100
		return Math.round(((current - previous) / previous) * 100)
	}

	const completionRate = useMemo(() => {
		const requiredFields = responseFields(fields).filter(f => f.required)
		if (requiredFields.length === 0) return totalResponses > 0 ? 100 : 0
		let complete = 0
		for (const d of allData) { if (requiredFields.every(f => { const v = d[f.id]; return v !== undefined && v !== null && v !== '' })) complete++ }
		return totalResponses > 0 ? Math.round((complete / totalResponses) * 100) : 0
	}, [allData, fields, totalResponses])

	const prevCompletionRate = useMemo(() => {
		const requiredFields = responseFields(fields).filter(f => f.required)
		if (requiredFields.length === 0) return previousPeriod.length > 0 ? 100 : 0
		let complete = 0
		for (const d of prevData) { if (requiredFields.every(f => { const v = d[f.id]; return v !== undefined && v !== null && v !== '' })) complete++ }
		return previousPeriod.length > 0 ? Math.round((complete / previousPeriod.length) * 100) : 0
	}, [prevData, fields, previousPeriod.length])

	const avgFillRate = useMemo(() => {
		const dataFields = responseFields(fields)
		if (dataFields.length === 0 || totalResponses === 0) return 0
		let totalFill = 0
		for (const field of dataFields) { const filled = allData.filter(d => { const v = d[field.id]; return v !== undefined && v !== null && v !== '' }).length; totalFill += filled / totalResponses }
		return Math.round((totalFill / dataFields.length) * 100)
	}, [allData, fields, totalResponses])

	const prevAvgFillRate = useMemo(() => {
		const dataFields = responseFields(fields)
		if (dataFields.length === 0 || previousPeriod.length === 0) return 0
		let totalFill = 0
		for (const field of dataFields) { const filled = prevData.filter(d => { const v = d[field.id]; return v !== undefined && v !== null && v !== '' }).length; totalFill += filled / previousPeriod.length }
		return Math.round((totalFill / dataFields.length) * 100)
	}, [prevData, fields, previousPeriod.length])

	const activeDays = useMemo(() => { const days = new Set<string>(); for (const r of filtered) { if (r.submittedAt) days.add(dateKey(new Date(Number(r.submittedAt)))) }; return days.size }, [filtered])
	const prevActiveDays = useMemo(() => { const days = new Set<string>(); for (const r of previousPeriod) { if (r.submittedAt) days.add(dateKey(new Date(Number(r.submittedAt)))) }; return days.size }, [previousPeriod])

	const avgCompletionTime = useMemo(() => {
		const durations: number[] = []
		for (const d of allData) { const meta = (d as Record<string, unknown>)._meta as { duration?: number } | undefined; if (meta?.duration && meta.duration > 0 && meta.duration < 86400) durations.push(meta.duration) }
		if (durations.length === 0) return null
		return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
	}, [allData])

	const npsData = useMemo(() => {
		const npsFields = fields.filter(f => { if (f.type !== 'scale' && f.type !== 'rating') return false; const label = f.label.toLowerCase(); return label.includes('nps') || label.includes('recommend') || label.includes('likely') })
		if (npsFields.length === 0) return null
		const field = npsFields[0]!; const scores = allData.map(d => Number(d[field.id])).filter(n => !isNaN(n) && n >= 0 && n <= 10)
		if (scores.length === 0) return null
		const promoters = scores.filter(s => s >= 9).length; const passives = scores.filter(s => s >= 7 && s <= 8).length; const detractors = scores.filter(s => s <= 6).length
		const nps = Math.round(((promoters - detractors) / scores.length) * 100)
		return { nps, promoters, passives, detractors, total: scores.length, fieldLabel: staticFieldLabel(field) }
	}, [allData, fields])

	const funnelData = useMemo(() => {
		const dataFields = responseFields(fields)
		if (dataFields.length === 0 || totalResponses === 0) return []
		return dataFields.map(field => { const filled = allData.filter(d => { const v = d[field.id]; return v !== undefined && v !== null && v !== '' }).length; return { label: staticFieldLabel(field), filled, pct: Math.round((filled / totalResponses) * 100) } })
	}, [allData, fields, totalResponses])

	const deviceBreakdown = useMemo(() => {
		const browsers: Record<string, number> = {}; const devices: Record<string, number> = {}; const oses: Record<string, number> = {}
		for (const d of allData) { const meta = (d as Record<string, unknown>)._meta as { ua?: string } | undefined; if (meta?.ua) { const parsed = parseUA(meta.ua); browsers[parsed.browser] = (browsers[parsed.browser] ?? 0) + 1; devices[parsed.device] = (devices[parsed.device] ?? 0) + 1; oses[parsed.os] = (oses[parsed.os] ?? 0) + 1 } }
		const toSorted = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1]) as [string, number][]
		return { browsers: toSorted(browsers), devices: toSorted(devices), oses: toSorted(oses), hasData: Object.keys(browsers).length > 0 }
	}, [allData])

	const crossInsights = useMemo(() => computeCrossInsights(fields, allData), [fields, allData])

	const completionSparkline = useMemo(() => {
		const requiredFields = responseFields(fields).filter(f => f.required); const last7 = dailyCounts.slice(-7)
		if (requiredFields.length === 0) return last7.map(d => (d.count > 0 ? 100 : 0))
		const byDay: Record<string, Record<string, string>[]> = {}
		for (let i = 0; i < filtered.length; i++) { const r = filtered[i]; if (r?.submittedAt) { const key = dateKey(new Date(Number(r.submittedAt))); if (!byDay[key]) byDay[key] = []; const d = allData[i]; if (d) byDay[key].push(d) } }
		return last7.map(d => { const dayResponses = byDay[d.label] ?? []; if (dayResponses.length === 0) return 0; let complete = 0; for (const data of dayResponses) { if (requiredFields.every(f => { const v = data[f.id]; return v !== undefined && v !== null && v !== '' })) complete++ }; return Math.round((complete / dayResponses.length) * 100) })
	}, [allData, dailyCounts, fields, filtered])

	const fillRateSparkline = useMemo(() => {
		const last7 = dailyCounts.slice(-7)
		const dataFields = responseFields(fields)
		const byDay: Record<string, Record<string, string>[]> = {}
		for (let i = 0; i < filtered.length; i++) { const r = filtered[i]; if (r?.submittedAt) { const key = dateKey(new Date(Number(r.submittedAt))); if (!byDay[key]) byDay[key] = []; const d = allData[i]; if (d) byDay[key].push(d) } }
		return last7.map(d => { const dayResponses = byDay[d.label] ?? []; if (dayResponses.length === 0 || dataFields.length === 0) return 0; let totalFill = 0; for (const field of dataFields) { const filled = dayResponses.filter(data => { const v = data[field.id]; return v !== undefined && v !== null && v !== '' }).length; totalFill += filled / dayResponses.length }; return Math.round((totalFill / dataFields.length) * 100) })
	}, [allData, dailyCounts, fields, filtered])

	return (
		<div className="space-y-5 animate-fade-in">
			{/* Time range selector */}
			<div className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-1 w-fit">
				{TIME_RANGE_OPTIONS.map(opt => (
					<button key={opt.value} onClick={() => setRange(opt.value)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${range === opt.value ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
						{opt.label}
					</button>
				))}
			</div>

			{/* Response filters */}
			<div className="flex flex-wrap items-center gap-2">
				{filters.map((f, i) => {
					const field = fields.find(fld => fld.id === f.fieldId)
					return (
						<span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 px-2.5 py-1.5 text-xs font-medium">
							{field?.label || f.fieldId}: {f.value}
							<button onClick={() => setFilters(filters.filter((_, j) => j !== i))} className="p-0.5 hover:text-red-500 transition-colors">&times;</button>
						</span>
					)
				})}
				<div className="relative">
					<select value="" onChange={e => { if (!e.target.value) return; const fieldId = e.target.value; const val = prompt(`Filter "${fields.find(f => f.id === fieldId)?.label || fieldId}" contains:`); if (val) setFilters([...filters, { fieldId, value: val }]); e.target.value = '' }} className="text-xs rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-transparent px-2.5 py-1.5 text-gray-500 dark:text-gray-400 outline-none cursor-pointer">
						<option value="">+ Filter</option>
						{responseFields(fields).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
					</select>
				</div>
				{filters.length > 0 && <button onClick={() => setFilters([])} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Clear all</button>}
			</div>

			{/* Summary cards */}
			<div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
				<SummaryCard label="Total Responses" value={totalResponses.toLocaleString()} trend={trendPct(totalResponses, prevTotalResponses)} sparkData={sparkline7} />
				<SummaryCard label="Completion Rate" value={`${completionRate}%`} trend={trendPct(completionRate, prevCompletionRate)} sparkData={completionSparkline} />
				<SummaryCard label="Avg. Fill Rate" value={`${avgFillRate}%`} trend={trendPct(avgFillRate, prevAvgFillRate)} sparkData={fillRateSparkline} />
				<SummaryCard label="Avg. Time" value={avgCompletionTime !== null ? formatDuration(avgCompletionTime) : '—'} trend={null} sparkData={[]} />
				<SummaryCard label="Active Days" value={String(activeDays)} trend={trendPct(activeDays, prevActiveDays)} sparkData={sparkline7.map(v => (v > 0 ? 1 : 0))} />
			</div>

			<ResponsesBarChart data={dailyCounts} />
			<CalendarHeatmap responses={filtered} />

			{(funnelData.length > 0 || npsData) && (
				<div className={`grid grid-cols-1 gap-4 ${npsData ? 'xl:grid-cols-[1.1fr_0.9fr]' : ''}`}>
					{funnelData.length > 0 && <DropoffFunnel data={funnelData} />}
					{npsData && (
					<NpsGauge nps={npsData.nps} promoters={npsData.promoters} passives={npsData.passives} detractors={npsData.detractors} total={npsData.total} fieldLabel={npsData.fieldLabel} />
					)}
				</div>
			)}

			{deviceBreakdown.hasData && (
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Respondent Insights</h3>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<DonutChart data={deviceBreakdown.devices} title="Devices" />
						<DonutChart data={deviceBreakdown.browsers} title="Browsers" />
						<DonutChart data={deviceBreakdown.oses} title="Operating Systems" />
					</div>
				</div>
			)}

			{crossInsights.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Cross-Question Insights</h3>
					<div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark overflow-hidden divide-y divide-gray-100 dark:divide-gray-800 shadow-sm">
						{crossInsights.map((insight, i) => (
							<div key={i} className="px-4 py-3 flex items-start gap-3">
								<div className="shrink-0 w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-600 dark:text-violet-400 text-sm font-bold">{insight.percentage}%</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm text-gray-800 dark:text-gray-200">
										People who answered <span className="font-semibold text-brand-600 dark:text-brand-400">&ldquo;{insight.sourceValue}&rdquo;</span> for <span className="text-gray-500">{insight.sourceLabel}</span> also chose <span className="font-semibold text-violet-600 dark:text-violet-400">&ldquo;{insight.targetValue}&rdquo;</span> for <span className="text-gray-500">{insight.targetLabel}</span>
									</p>
									<p className="text-[11px] text-gray-400 mt-0.5">{insight.coCount} of {insight.sourceCount} respondents</p>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

// ============================================================================
// FieldInsightsView (per-field analysis under the "Field insights" sub-tab)
// ============================================================================

function FieldInsightsView({ fields, responses }: { fields: FormField[]; responses: Record<string, unknown>[] }) {
	const [query, setQuery] = useState('')
	const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
	const allData = useMemo(() => {
		return responses.map(parseResponseData)
	}, [responses])

	const totalResponses = responses.length

	const fieldAnalytics = useMemo((): FieldAnalysis[] => {
		const dataFields = responseFields(fields)
		return dataFields.map((field): FieldAnalysis => {
			const values = allData.map(d => d[field.id] ?? '').filter(v => v !== '')
			const total = values.length
			const fillRate = totalResponses > 0 ? Math.round((total / totalResponses) * 100) : 0

			if (['select', 'radio', 'checkbox', 'yesno'].includes(field.type)) {
				const counts: Record<string, number> = {}
				for (const v of values) {
					const parts = field.type === 'checkbox' ? v.split(',') : [v]
					for (const p of parts) { const trimmed = p.trim(); if (trimmed) counts[trimmed] = (counts[trimmed] ?? 0) + 1 }
				}
				const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]) as [string, number][]
				return { field, type: 'categorical', counts: sorted, total, fillRate }
			}

			if (['number', 'rating', 'scale'].includes(field.type)) {
				const nums = values.map(Number).filter(n => !isNaN(n))
				if (nums.length > 0) {
					const sum = nums.reduce((a, b) => a + b, 0); const avg = sum / nums.length
					const min = Math.min(...nums); const max = Math.max(...nums); const med = median(nums)
					return { field, type: 'numeric', sum, avg, min, max, median: med, count: nums.length, fillRate, values: nums }
				}
			}

			const uniqueSet = new Set(values)
			const valueCounts: Record<string, number> = {}
			for (const v of values) { valueCounts[v] = (valueCounts[v] ?? 0) + 1 }
			const topValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5) as [string, number][]
			return { field, type: 'text', total, fillRate, uniqueCount: uniqueSet.size, topValues }
		})
	}, [allData, fields, totalResponses])

	useEffect(() => {
		if (fieldAnalytics.length === 0) {
			if (selectedFieldId !== null) setSelectedFieldId(null)
			return
		}
		if (!selectedFieldId || !fieldAnalytics.some(analysis => analysis.field.id === selectedFieldId)) {
			setSelectedFieldId(fieldAnalytics[0]!.field.id)
		}
	}, [fieldAnalytics, selectedFieldId])

	if (fieldAnalytics.length === 0) {
		return (
			<div className="text-center py-16">
				<p className="text-sm text-gray-400 dark:text-gray-500">No analyzable fields found.</p>
			</div>
		)
	}

	const sortedAnalytics = fieldAnalytics
		.map((analysis, index) => ({ analysis, index }))
		.sort((a, b) => a.analysis.fillRate - b.analysis.fillRate || a.index - b.index)
		.map(item => item.analysis)

	const filteredAnalytics = sortedAnalytics.filter(analysis => {
		const label = staticFieldLabel(analysis.field).toLowerCase()
		return label.includes(query.trim().toLowerCase())
	})

	const selectedAnalysis =
		fieldAnalytics.find(analysis => analysis.field.id === selectedFieldId) ||
		filteredAnalytics[0] ||
		sortedAnalytics[0]!
	const avgFillRate = Math.round(fieldAnalytics.reduce((sum, analysis) => sum + analysis.fillRate, 0) / fieldAnalytics.length)
	const reviewCount = fieldAnalytics.filter(analysis => analysis.fillRate < 75).length
	const watchCount = fieldAnalytics.filter(analysis => analysis.fillRate >= 75 && analysis.fillRate < 90).length
	const strongest = [...fieldAnalytics].sort((a, b) => b.fillRate - a.fillRate)[0]!
	const weakest = sortedAnalytics[0]!

	return (
		<div className="space-y-5 animate-fade-in">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h3 className="text-[18px] font-bold tracking-[-0.01em] text-slate-950 dark:text-gray-100">Field insights</h3>
					<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Understand every question without scanning every response manually.</p>
				</div>
				<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{fieldAnalytics.length} fields · {totalResponses} responses</span>
			</div>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<FieldInsightMetric label="Average fill" value={`${avgFillRate}%`} tone={avgFillRate >= 90 ? 'good' : avgFillRate >= 75 ? 'watch' : 'review'} detail="Across answer fields" />
				<FieldInsightMetric label="Needs review" value={String(reviewCount)} tone={reviewCount > 0 ? 'review' : 'good'} detail={watchCount > 0 ? `${watchCount} watch` : 'No weak fields'} />
				<FieldInsightMetric label="Strongest field" value={`${strongest.fillRate}%`} tone="good" detail={staticFieldLabel(strongest.field)} />
				<FieldInsightMetric label="Lowest field" value={`${weakest.fillRate}%`} tone={weakest.fillRate >= 90 ? 'good' : weakest.fillRate >= 75 ? 'watch' : 'review'} detail={staticFieldLabel(weakest.field)} />
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
				<aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
					<div className="relative mb-3">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
						<input
							value={query}
							onChange={event => setQuery(event.target.value)}
							placeholder="Search fields..."
							className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[13px] outline-none transition-all placeholder:text-slate-400 focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:focus:bg-surface-elevated-dark"
						/>
					</div>
					<div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
						{filteredAnalytics.length === 0 ? (
							<div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-[13px] text-slate-400 dark:border-gray-800">
								No matching fields.
							</div>
						) : filteredAnalytics.map((analysis, index) => (
							<FieldInsightRow
								key={analysis.field.id}
								analysis={analysis}
								index={index}
								selected={selectedAnalysis.field.id === analysis.field.id}
								onSelect={() => setSelectedFieldId(analysis.field.id)}
							/>
						))}
					</div>
				</aside>

				<section className="space-y-4">
					<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="min-w-0">
								<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Selected field</p>
								<h4 className="mt-1 text-[20px] font-bold tracking-[-0.01em] text-slate-950 dark:text-gray-100">{staticFieldLabel(selectedAnalysis.field)}</h4>
								<p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">{filledCountForAnalysis(selectedAnalysis)} filled responses from {totalResponses} submissions.</p>
							</div>
							<div className="flex items-center gap-3">
								<FieldStatusBadge fillRate={selectedAnalysis.fillRate} />
								<span className="text-[24px] font-bold tabular-nums text-slate-950 dark:text-gray-100">{selectedAnalysis.fillRate}%</span>
							</div>
						</div>
						<div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800">
							<div className={`h-full rounded-full ${fieldHealthBarClass(selectedAnalysis.fillRate)}`} style={{ width: `${selectedAnalysis.fillRate}%` }} />
						</div>
					</div>

					<FieldBreakdownCard analysis={selectedAnalysis} totalResponses={totalResponses} />
				</section>
			</div>
		</div>
	)
}

function fieldInsightTone(fillRate: number): 'good' | 'watch' | 'review' {
	if (fillRate >= 90) return 'good'
	if (fillRate >= 75) return 'watch'
	return 'review'
}

function fieldHealthBarClass(fillRate: number): string {
	const tone = fieldInsightTone(fillRate)
	if (tone === 'good') return 'bg-emerald-400 dark:bg-emerald-500'
	if (tone === 'watch') return 'bg-amber-400 dark:bg-amber-500'
	return 'bg-brand-500 dark:bg-brand-400'
}

function FieldStatusBadge({ fillRate }: { fillRate: number }) {
	const tone = fieldInsightTone(fillRate)
	const label = tone === 'good' ? 'Healthy' : tone === 'watch' ? 'Watch' : 'Review'
	const className = tone === 'good'
		? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
		: tone === 'watch'
			? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
			: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
	return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>{label}</span>
}

function FieldInsightMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'good' | 'watch' | 'review' }) {
	const toneClass = tone === 'good'
		? 'text-emerald-600 dark:text-emerald-400'
		: tone === 'watch'
			? 'text-amber-600 dark:text-amber-400'
			: 'text-brand-600 dark:text-brand-400'
	return (
		<div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-surface-elevated-dark">
			<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">{label}</p>
			<p className={`mt-2 text-[24px] font-bold tracking-[-0.01em] tabular-nums ${toneClass}`}>{value}</p>
			<p className="mt-1 truncate text-[12px] text-slate-500 dark:text-gray-400">{detail}</p>
		</div>
	)
}

function FieldInsightRow({ analysis, index, selected, onSelect }: { analysis: FieldAnalysis; index: number; selected: boolean; onSelect: () => void }) {
	const label = staticFieldLabel(analysis.field)
	return (
		<button
			onClick={onSelect}
			className={`w-full rounded-xl border px-3.5 py-3 text-left transition-all ${
				selected
					? 'border-brand-200 bg-brand-50/70 shadow-sm dark:border-brand-800 dark:bg-brand-900/15'
					: 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white dark:border-gray-800 dark:bg-gray-900/45 dark:hover:bg-gray-900'
			}`}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex min-w-0 items-center gap-2">
						<span className="text-[11px] text-slate-400 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
						<span className="truncate text-[13px] font-semibold text-slate-800 dark:text-gray-200">{label}</span>
					</div>
					<p className="mt-1 text-[11px] text-slate-400 dark:text-gray-500">{filledCountForAnalysis(analysis)} filled · {analysis.type}</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<FieldStatusBadge fillRate={analysis.fillRate} />
					<span className="w-9 text-right text-[12px] font-semibold tabular-nums text-slate-500 dark:text-gray-400">{analysis.fillRate}%</span>
				</div>
			</div>
			<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white dark:bg-gray-800">
				<div className={`h-full rounded-full ${fieldHealthBarClass(analysis.fillRate)}`} style={{ width: `${analysis.fillRate}%` }} />
			</div>
		</button>
	)
}
