import type { FormField } from '../../types'
import { median, responseFields, staticFieldLabel } from './utils'

export interface CategoricalAnalysis {
	field: FormField
	type: 'categorical'
	counts: [string, number][]
	total: number
	fillRate: number
}

export interface NumericAnalysis {
	field: FormField
	type: 'numeric'
	sum: number
	avg: number
	min: number
	max: number
	median: number
	count: number
	fillRate: number
	values: number[]
}

export interface TextAnalysis {
	field: FormField
	type: 'text'
	total: number
	fillRate: number
	uniqueCount: number
	topValues: [string, number][]
}

export type FieldAnalysis = CategoricalAnalysis | NumericAnalysis | TextAnalysis
export type FieldInsightTone = 'good' | 'watch' | 'review'
export type FieldSuggestionSeverity = 'high' | 'medium' | 'low'

export interface FieldSuggestion {
	id: string
	fieldId: string
	fieldLabel: string
	severity: FieldSuggestionSeverity
	title: string
	reason: string
	action: string
}

export function buildFieldAnalyses(
	fields: FormField[],
	allData: Record<string, string>[],
	totalResponses: number,
): FieldAnalysis[] {
	return responseFields(fields).map((field): FieldAnalysis => {
		const values = allData.map(data => data[field.id] ?? '').filter(value => value !== '')
		const total = values.length
		const fillRate = totalResponses > 0 ? Math.round((total / totalResponses) * 100) : 0

		if (['select', 'radio', 'checkbox', 'yesno'].includes(field.type)) {
			const counts: Record<string, number> = {}
			for (const value of values) {
				const parts = field.type === 'checkbox' ? value.split(',') : [value]
				for (const part of parts) {
					const trimmed = part.trim()
					if (trimmed) counts[trimmed] = (counts[trimmed] ?? 0) + 1
				}
			}
			const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]) as [string, number][]
			return { field, type: 'categorical', counts: sorted, total, fillRate }
		}

		if (['number', 'rating', 'scale'].includes(field.type)) {
			const nums = values.map(Number).filter(number => !Number.isNaN(number))
			if (nums.length > 0) {
				const sum = nums.reduce((acc, value) => acc + value, 0)
				return {
					field,
					type: 'numeric',
					sum,
					avg: sum / nums.length,
					min: Math.min(...nums),
					max: Math.max(...nums),
					median: median(nums),
					count: nums.length,
					fillRate,
					values: nums,
				}
			}
		}

		const valueCounts: Record<string, number> = {}
		for (const value of values) {
			valueCounts[value] = (valueCounts[value] ?? 0) + 1
		}
		const topValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5) as [string, number][]
		return {
			field,
			type: 'text',
			total,
			fillRate,
			uniqueCount: new Set(values).size,
			topValues,
		}
	})
}

export function filledCountForAnalysis(analysis: FieldAnalysis): number {
	return analysis.type === 'numeric' ? analysis.count : analysis.total
}

export function fieldInsightTone(fillRate: number): FieldInsightTone {
	if (fillRate >= 90) return 'good'
	if (fillRate >= 75) return 'watch'
	return 'review'
}

export function fieldHealthBarClass(fillRate: number): string {
	const tone = fieldInsightTone(fillRate)
	if (tone === 'good') return 'bg-emerald-400 dark:bg-emerald-500'
	if (tone === 'watch') return 'bg-amber-400 dark:bg-amber-500'
	return 'bg-brand-500 dark:bg-brand-400'
}

export function buildSmartFieldSuggestions(
	analyses: readonly FieldAnalysis[],
	totalResponses: number,
): FieldSuggestion[] {
	const suggestions: FieldSuggestion[] = []
	if (totalResponses === 0) return suggestions

	for (const analysis of analyses) {
		const fieldLabel = staticFieldLabel(analysis.field)
		if (analysis.field.required && analysis.fillRate < 75) {
			suggestions.push({
				id: `${analysis.field.id}:required-low-fill`,
				fieldId: analysis.field.id,
				fieldLabel,
				severity: analysis.fillRate < 50 ? 'high' : 'medium',
				title: 'Required field is slowing completion',
				reason: `${analysis.fillRate}% of respondents filled "${fieldLabel}".`,
				action: 'Clarify the label, move it later, or make it optional if it is not essential.',
			})
		}

		if (!analysis.field.required && totalResponses >= 5 && analysis.fillRate <= 20) {
			suggestions.push({
				id: `${analysis.field.id}:optional-unused`,
				fieldId: analysis.field.id,
				fieldLabel,
				severity: 'medium',
				title: 'Optional field is rarely used',
				reason: `${analysis.fillRate}% fill rate across ${totalResponses} responses.`,
				action: 'Remove it or move it behind a section if it is only useful for edge cases.',
			})
		}

		if (analysis.type === 'text' && analysis.total >= 8 && analysis.topValues.length >= 2) {
			const repeated = analysis.topValues.filter(([, count]) => count >= 2)
			const repeatedTotal = repeated.reduce((sum, [, count]) => sum + count, 0)
			if (repeated.length >= 2 && repeatedTotal / analysis.total >= 0.6) {
				suggestions.push({
					id: `${analysis.field.id}:text-to-choice`,
					fieldId: analysis.field.id,
					fieldLabel,
					severity: 'low',
					title: 'Free-text answers repeat often',
					reason: `${repeated.length} answers account for ${Math.round((repeatedTotal / analysis.total) * 100)}% of filled values.`,
					action: 'Consider changing this field to multiple choice or dropdown.',
				})
			}
		}
	}

	const severityOrder: Record<FieldSuggestionSeverity, number> = { high: 0, medium: 1, low: 2 }
	return suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.fieldLabel.localeCompare(b.fieldLabel))
}
