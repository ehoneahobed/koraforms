import type { FormField, FieldType } from '../../types'
import { pipeValues } from '../../types'
import {
	getResponseFields,
	parseResponseData as parsePersistedResponseData,
	parseResponseMeta as parsePersistedResponseMeta,
} from '../../domain/forms'

export type TimeRange = '7d' | '14d' | '30d' | '90d' | 'all'

export interface ParsedUserAgent {
	browser: string
	os: string
	device: string
}

export interface FormattedResponseValue {
	kind: 'empty' | 'text' | 'list'
	values: string[]
}

export function daysForRange(range: TimeRange): number | null {
	if (range === '7d') return 7
	if (range === '14d') return 14
	if (range === '30d') return 30
	if (range === '90d') return 90
	return null
}

export function startOfDaysAgo(daysAgo: number): number {
	const d = new Date()
	d.setHours(0, 0, 0, 0)
	d.setDate(d.getDate() - daysAgo + 1)
	return d.getTime()
}

export function shortDate(d: Date): string {
	return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function dateKey(d: Date): string {
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}

export function median(nums: number[]): number {
	if (nums.length === 0) return 0
	const sorted = [...nums].sort((a, b) => a - b)
	const mid = Math.floor(sorted.length / 2)
	if (sorted.length % 2 === 0) {
		return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
	}
	return sorted[mid] ?? 0
}

export function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`
	const m = Math.floor(seconds / 60)
	const s = seconds % 60
	if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
	const h = Math.floor(m / 60)
	return `${h}h ${m % 60}m`
}

export function formatTimeSince(timestamp: number, now = Date.now()): string {
	const seconds = Math.floor((now - timestamp) / 1000)
	if (seconds < 60) return 'just now'
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.floor(hours / 24)
	if (days < 7) return `${days}d ago`
	return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export function parseUA(ua: string): ParsedUserAgent {
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
	if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) device = 'Tablet'
	else if (/Mobile|Android.*Mobile|iPhone/i.test(ua)) device = 'Mobile'
	return { browser, os, device }
}

export function responseFields(fields: FormField[]): FormField[] {
	return getResponseFields(fields)
}

export function parseResponseData(response: Record<string, unknown>): Record<string, string> {
	return parsePersistedResponseData(response.data)
}

export function parseResponseMeta(response: Record<string, unknown>): { duration?: number; ua?: string; screen?: string; startedAt?: number } | undefined {
	return parsePersistedResponseMeta(response.data)
}

export function isFilledValue(value: unknown): boolean {
	return value !== undefined && value !== null && String(value).trim() !== ''
}

export function responseCompletionPct(fields: FormField[], data: Record<string, string>): number {
	const requiredFields = responseFields(fields).filter(field => field.required)
	if (requiredFields.length === 0) return 100
	const filled = requiredFields.filter(field => isFilledValue(data[field.id])).length
	return Math.round((filled / requiredFields.length) * 100)
}

export function fieldLabel(field: FormField, data: Record<string, unknown>, fields: FormField[]): string {
	const stringData = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value == null ? '' : String(value)]))
	return pipeValues(field.label || field.id, stringData, fields)
}

export function staticFieldLabel(field: FormField): string {
	const label = field.label || field.id
	return label
		.replace(/([A-Za-z0-9][A-Za-z0-9\s'/-]*?)\s*\{\{([^}]+)\}\}/g, (_match, before, token) => {
			const tokenLabel = String(token).trim()
			const strippedPrefix = String(before).replace(new RegExp(`${escapeRegExp(tokenLabel)}\\s*$`, 'i'), '').trimEnd()
			return `${strippedPrefix} ${tokenLabel}`.trim()
		})
		.replace(/\{\{([^}]+)\}\}/g, (_match, token) => String(token).trim())
		.replace(/\s+/g, ' ')
		.trim()
}

export function formatResponseValue(field: Pick<FormField, 'type'>, value: unknown): FormattedResponseValue {
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

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function isCategoricalField(type: FieldType): boolean {
	return ['select', 'radio', 'checkbox', 'yesno'].includes(type)
}

export function isNumericField(type: FieldType): boolean {
	return ['number', 'rating', 'scale'].includes(type)
}
