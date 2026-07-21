import type { FormField } from '../types'

/**
 * Evaluate a formula string against current form values.
 *
 * Supported syntax:
 *   Field references: {field_id}
 *   Arithmetic: +, -, *, /
 *   Functions: SUM(...), AVG(...), MIN(...), MAX(...), COUNT(...)
 *   Conditionals: IF({field} == "yes", 10, 0)
 *   String: CONCAT({field1}, " ", {field2})
 */
export function evaluateFormula(
	formula: string,
	values: Record<string, string>,
	fields: FormField[],
): string {
	if (!formula) return ''

	try {
		// Replace field references {field_id} with their values
		let expr = formula.replace(/\{(\w+)\}/g, (_match, fieldId) => {
			const val = values[fieldId]
			if (val !== undefined) return val
			// Try matching by label
			const field = fields.find(f => f.label.toLowerCase().replace(/\s+/g, '_') === fieldId.toLowerCase())
			return field ? (values[field.id] || '0') : '0'
		})

		// Handle CONCAT function
		const concatMatch = expr.match(/^CONCAT\((.+)\)$/i)
		if (concatMatch) {
			const parts = splitArgs(concatMatch[1]!)
			return parts.map(p => {
				const trimmed = p.trim()
				// Quoted string literal
				if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
					return trimmed.slice(1, -1)
				}
				return trimmed
			}).join('')
		}

		// Handle IF function: IF(condition, trueVal, falseVal)
		const ifMatch = expr.match(/^IF\((.+)\)$/i)
		if (ifMatch) {
			const args = splitArgs(ifMatch[1]!)
			if (args.length >= 3) {
				const condition = args[0]!.trim()
				const trueVal = args[1]!.trim()
				const falseVal = args[2]!.trim()
				const condResult = evaluateSimpleCondition(condition)
				const resultExpr = condResult ? trueVal : falseVal
				// Strip quotes if string literal
				if ((resultExpr.startsWith('"') && resultExpr.endsWith('"'))) {
					return resultExpr.slice(1, -1)
				}
				const num = parseFloat(resultExpr)
				return isNaN(num) ? resultExpr : String(num)
			}
		}

		// Handle aggregate functions
		const aggMatch = expr.match(/^(SUM|AVG|MIN|MAX|COUNT)\((.+)\)$/i)
		if (aggMatch) {
			const fn = aggMatch[1]!.toUpperCase()
			const args = splitArgs(aggMatch[2]!).map(a => parseFloat(a.trim())).filter(n => !isNaN(n))
			switch (fn) {
				case 'SUM': return String(args.reduce((a, b) => a + b, 0))
				case 'AVG': return args.length > 0 ? String(args.reduce((a, b) => a + b, 0) / args.length) : '0'
				case 'MIN': return args.length > 0 ? String(Math.min(...args)) : '0'
				case 'MAX': return args.length > 0 ? String(Math.max(...args)) : '0'
				case 'COUNT': return String(args.length)
			}
		}

		// Simple arithmetic expression
		// Only allow safe characters: digits, operators, parentheses, dots, spaces
		const safeExpr = expr.replace(/[^0-9+\-*/.() ]/g, '')
		if (safeExpr && safeExpr.trim()) {
			// Use Function constructor for safe arithmetic evaluation
			const result = new Function(`"use strict"; return (${safeExpr})`)()
			if (typeof result === 'number' && isFinite(result)) {
				// Round to 2 decimal places
				return String(Math.round(result * 100) / 100)
			}
		}

		return expr
	} catch {
		return ''
	}
}

// Split comma-separated arguments respecting parentheses and quotes
function splitArgs(str: string): string[] {
	const args: string[] = []
	let depth = 0
	let inQuote = false
	let quoteChar = ''
	let current = ''

	for (const ch of str) {
		if (inQuote) {
			current += ch
			if (ch === quoteChar) inQuote = false
			continue
		}
		if (ch === '"' || ch === "'") {
			inQuote = true
			quoteChar = ch
			current += ch
			continue
		}
		if (ch === '(') depth++
		if (ch === ')') depth--
		if (ch === ',' && depth === 0) {
			args.push(current)
			current = ''
			continue
		}
		current += ch
	}
	if (current) args.push(current)
	return args
}

// Evaluate simple condition like: 5 == 5, "yes" == "yes", 10 > 5
function evaluateSimpleCondition(condition: string): boolean {
	// Try ==
	let parts = condition.split('==')
	if (parts.length === 2) {
		return stripQuotes(parts[0]!.trim()) === stripQuotes(parts[1]!.trim())
	}
	// Try !=
	parts = condition.split('!=')
	if (parts.length === 2) {
		return stripQuotes(parts[0]!.trim()) !== stripQuotes(parts[1]!.trim())
	}
	// Try >=
	parts = condition.split('>=')
	if (parts.length === 2) {
		return parseFloat(parts[0]!.trim()) >= parseFloat(parts[1]!.trim())
	}
	// Try <=
	parts = condition.split('<=')
	if (parts.length === 2) {
		return parseFloat(parts[0]!.trim()) <= parseFloat(parts[1]!.trim())
	}
	// Try >
	parts = condition.split('>')
	if (parts.length === 2) {
		return parseFloat(parts[0]!.trim()) > parseFloat(parts[1]!.trim())
	}
	// Try <
	parts = condition.split('<')
	if (parts.length === 2) {
		return parseFloat(parts[0]!.trim()) < parseFloat(parts[1]!.trim())
	}
	return false
}

function stripQuotes(s: string): string {
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1)
	}
	return s
}
