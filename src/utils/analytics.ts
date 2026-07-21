import type { FormField, FieldType } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldAnalytics {
	fieldId: string
	fieldLabel: string
	fieldType: FieldType
	totalResponses: number
	data: ChartData
}

export type ChartData =
	| { type: 'distribution'; items: { label: string; count: number; percentage: number }[] }
	| { type: 'numeric'; min: number; max: number; mean: number; median: number; histogram: { bucket: string; count: number }[] }
	| { type: 'rating'; distribution: number[]; average: number }
	| { type: 'text'; wordFrequency: { word: string; count: number }[]; avgLength: number; responseCount: number }
	| { type: 'timeline'; points: { date: string; count: number }[] }
	| { type: 'boolean'; yes: number; no: number }

// ---------------------------------------------------------------------------
// Stopwords for text analysis
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
	'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
	'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
	'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
	'should', 'may', 'might', 'can', 'shall', 'it', 'its', 'this', 'that',
	'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he',
	'him', 'his', 'she', 'her', 'they', 'them', 'their', 'not', 'no', 'so',
	'if', 'then', 'just', 'very', 'also', 'from', 'as', 'more', 'about',
])

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export function computeFieldAnalytics(
	field: FormField,
	responseValues: string[],
): FieldAnalytics {
	const base = {
		fieldId: field.id,
		fieldLabel: field.label,
		fieldType: field.type,
		totalResponses: responseValues.length,
	}

	switch (field.type) {
		case 'select':
		case 'radio':
			return { ...base, data: computeDistribution(responseValues, field.options) }
		case 'checkbox':
			return { ...base, data: computeCheckboxDistribution(responseValues, field.options) }
		case 'rating':
			return { ...base, data: computeRating(responseValues, 5) }
		case 'scale':
			return { ...base, data: computeNumeric(responseValues) }
		case 'number':
			return { ...base, data: computeNumeric(responseValues) }
		case 'yesno':
			return { ...base, data: computeBoolean(responseValues) }
		case 'date':
		case 'time':
			return { ...base, data: computeDistribution(responseValues) }
		default:
			return { ...base, data: computeTextSummary(responseValues) }
	}
}

// ---------------------------------------------------------------------------
// Distribution (select, radio, date, time)
// ---------------------------------------------------------------------------

function computeDistribution(values: string[], options?: string): ChartData & { type: 'distribution' } {
	const counts = new Map<string, number>()

	// Pre-populate with known options if available
	if (options) {
		for (const opt of options.split(',').map((s) => s.trim()).filter(Boolean)) {
			counts.set(opt, 0)
		}
	}

	const nonEmpty = values.filter((v) => v.trim())
	for (const val of nonEmpty) {
		counts.set(val, (counts.get(val) || 0) + 1)
	}

	const total = nonEmpty.length || 1
	const items = Array.from(counts.entries())
		.map(([label, count]) => ({
			label,
			count,
			percentage: Math.round((count / total) * 100),
		}))
		.sort((a, b) => b.count - a.count)

	return { type: 'distribution', items }
}

// ---------------------------------------------------------------------------
// Checkbox distribution (multi-select, comma-separated values)
// ---------------------------------------------------------------------------

function computeCheckboxDistribution(values: string[], options?: string): ChartData & { type: 'distribution' } {
	const counts = new Map<string, number>()

	if (options) {
		for (const opt of options.split(',').map((s) => s.trim()).filter(Boolean)) {
			counts.set(opt, 0)
		}
	}

	let totalSelections = 0
	for (const val of values) {
		if (!val.trim()) continue
		const selected = val.split(',').map((s) => s.trim()).filter(Boolean)
		for (const s of selected) {
			counts.set(s, (counts.get(s) || 0) + 1)
			totalSelections++
		}
	}

	const total = totalSelections || 1
	const items = Array.from(counts.entries())
		.map(([label, count]) => ({
			label,
			count,
			percentage: Math.round((count / total) * 100),
		}))
		.sort((a, b) => b.count - a.count)

	return { type: 'distribution', items }
}

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

function computeRating(values: string[], maxStars: number): ChartData & { type: 'rating' } {
	const distribution = new Array(maxStars).fill(0) as number[]
	let sum = 0
	let count = 0

	for (const val of values) {
		const n = parseInt(val, 10)
		if (n >= 1 && n <= maxStars) {
			distribution[n - 1] = (distribution[n - 1] ?? 0) + 1
			sum += n
			count++
		}
	}

	return {
		type: 'rating',
		distribution,
		average: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
	}
}

// ---------------------------------------------------------------------------
// Numeric (number, scale)
// ---------------------------------------------------------------------------

function computeNumeric(values: string[]): ChartData & { type: 'numeric' } {
	const nums = values
		.map((v) => parseFloat(v))
		.filter((n) => !isNaN(n))
		.sort((a, b) => a - b)

	if (nums.length === 0) {
		return { type: 'numeric', min: 0, max: 0, mean: 0, median: 0, histogram: [] }
	}

	const min = nums[0]!
	const max = nums[nums.length - 1]!
	const sum = nums.reduce((a, b) => a + b, 0)
	const mean = Math.round((sum / nums.length) * 100) / 100
	const mid = Math.floor(nums.length / 2)
	const median = nums.length % 2 === 0
		? Math.round(((nums[mid - 1]! + nums[mid]!) / 2) * 100) / 100
		: nums[mid]!

	// Build histogram with ~5-10 buckets
	const range = max - min
	const bucketCount = Math.min(10, Math.max(3, Math.ceil(Math.sqrt(nums.length))))
	const bucketSize = range / bucketCount || 1
	const histogram: { bucket: string; count: number }[] = []

	for (let i = 0; i < bucketCount; i++) {
		const low = min + i * bucketSize
		const high = i === bucketCount - 1 ? max + 0.01 : min + (i + 1) * bucketSize
		const count = nums.filter((n) => n >= low && n < high).length
		histogram.push({
			bucket: `${Math.round(low * 10) / 10}–${Math.round((high - 0.01) * 10) / 10}`,
			count,
		})
	}

	return { type: 'numeric', min, max, mean, median, histogram }
}

// ---------------------------------------------------------------------------
// Boolean (yesno)
// ---------------------------------------------------------------------------

function computeBoolean(values: string[]): ChartData & { type: 'boolean' } {
	let yes = 0
	let no = 0
	for (const val of values) {
		const lower = val.toLowerCase().trim()
		if (lower === 'yes' || lower === 'true' || lower === '1') yes++
		else if (lower === 'no' || lower === 'false' || lower === '0') no++
	}
	return { type: 'boolean', yes, no }
}

// ---------------------------------------------------------------------------
// Text summary
// ---------------------------------------------------------------------------

function computeTextSummary(values: string[]): ChartData & { type: 'text' } {
	const nonEmpty = values.filter((v) => v.trim())
	const totalLen = nonEmpty.reduce((sum, v) => sum + v.length, 0)
	const avgLength = nonEmpty.length > 0 ? Math.round(totalLen / nonEmpty.length) : 0

	// Word frequency
	const wordCounts = new Map<string, number>()
	for (const val of nonEmpty) {
		const words = val.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
		for (const word of words) {
			if (word.length < 2 || STOPWORDS.has(word)) continue
			wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
		}
	}

	const wordFrequency = Array.from(wordCounts.entries())
		.map(([word, count]) => ({ word, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 15)

	return { type: 'text', wordFrequency, avgLength, responseCount: nonEmpty.length }
}

// ---------------------------------------------------------------------------
// Cross-question analysis (contingency / co-occurrence)
// ---------------------------------------------------------------------------

export interface CrossInsight {
	sourceField: string
	sourceLabel: string
	sourceValue: string
	targetField: string
	targetLabel: string
	targetValue: string
	coCount: number
	sourceCount: number
	percentage: number // % of sourceValue respondents who chose targetValue
}

/**
 * Find top cross-question insights across all field pairs.
 * For each (fieldA value → fieldB value), computes co-occurrence percentage.
 * Returns the most interesting insights (high co-occurrence, non-trivial).
 */
export function computeCrossInsights(
	fields: FormField[],
	responses: Record<string, string>[],
	maxInsights = 10,
): CrossInsight[] {
	// Only analyze choice-type fields (select, radio, checkbox, yesno, rating)
	const choiceFields = fields.filter(f =>
		['select', 'radio', 'checkbox', 'yesno', 'rating', 'scale'].includes(f.type),
	)

	if (choiceFields.length < 2 || responses.length < 3) return []

	const insights: CrossInsight[] = []

	for (let i = 0; i < choiceFields.length; i++) {
		for (let j = 0; j < choiceFields.length; j++) {
			if (i === j) continue
			const srcField = choiceFields[i]!
			const tgtField = choiceFields[j]!

			// Group responses by source value
			const groups = new Map<string, string[]>()
			for (const resp of responses) {
				const srcVal = (resp[srcField.id] || '').trim()
				const tgtVal = (resp[tgtField.id] || '').trim()
				if (!srcVal || !tgtVal) continue
				// For checkbox fields, split by comma
				const srcValues = srcField.type === 'checkbox' ? srcVal.split(',').map(s => s.trim()) : [srcVal]
				for (const sv of srcValues) {
					if (!groups.has(sv)) groups.set(sv, [])
					groups.get(sv)!.push(tgtVal)
				}
			}

			// For each source value, find dominant target value
			for (const [srcVal, tgtValues] of groups) {
				if (tgtValues.length < 2) continue // need at least 2 respondents
				const tgtCounts = new Map<string, number>()
				for (const tv of tgtValues) {
					// For checkbox, split and count each
					const tvs = tgtField.type === 'checkbox' ? tv.split(',').map(s => s.trim()) : [tv]
					for (const t of tvs) {
						tgtCounts.set(t, (tgtCounts.get(t) || 0) + 1)
					}
				}
				const [topValue, topCount] = [...tgtCounts.entries()].sort((a, b) => b[1] - a[1])[0]!
				const pct = Math.round((topCount / tgtValues.length) * 100)

				// Only include interesting insights (>60% co-occurrence, at least 2 responses)
				if (pct >= 60 && topCount >= 2) {
					insights.push({
						sourceField: srcField.id,
						sourceLabel: srcField.label,
						sourceValue: srcVal,
						targetField: tgtField.id,
						targetLabel: tgtField.label,
						targetValue: topValue,
						coCount: topCount,
						sourceCount: tgtValues.length,
						percentage: pct,
					})
				}
			}
		}
	}

	// Sort by interestingness: higher co-occurrence % and sample size
	return insights
		.sort((a, b) => (b.percentage * Math.log(b.sourceCount)) - (a.percentage * Math.log(a.sourceCount)))
		.slice(0, maxInsights)
}

// ---------------------------------------------------------------------------
// Response timeline
// ---------------------------------------------------------------------------

export function computeResponseTimeline(
	responses: { submittedAt: number }[],
	granularity: 'hour' | 'day' | 'week' = 'day',
): { date: string; count: number }[] {
	if (responses.length === 0) return []

	const buckets = new Map<string, number>()

	for (const r of responses) {
		const d = new Date(r.submittedAt)
		let key: string
		if (granularity === 'hour') {
			key = `${d.toLocaleDateString()} ${d.getHours()}:00`
		} else if (granularity === 'week') {
			// Start of week (Sunday)
			const day = d.getDay()
			const start = new Date(d)
			start.setDate(start.getDate() - day)
			key = start.toLocaleDateString()
		} else {
			key = d.toLocaleDateString()
		}
		buckets.set(key, (buckets.get(key) || 0) + 1)
	}

	return Array.from(buckets.entries())
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}
