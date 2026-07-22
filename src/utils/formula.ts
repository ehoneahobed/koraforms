import type { FormField } from '../types'

/**
 * Evaluate a calculated-field formula against current form values.
 *
 * Supported syntax:
 *   Field references: {Question Label}; legacy field ids are still accepted
 *   Arithmetic: +, -, *, /, parentheses
 *   Functions: SUM(...), AVG(...), MIN(...), MAX(...), COUNT(...)
 *   Conditionals: IF({field} == "yes", 10, 0)
 *   Strings: CONCAT({field1}, " ", {field2})
 */
export function evaluateFormula(
	formula: string,
	values: Record<string, string>,
	fields: FormField[],
): string {
	if (!formula) return ''

	try {
		const expr = replaceFieldReferences(formula, values, fields).trim()
		if (!expr) return ''

		const concatArgs = extractFunctionArgs(expr, 'CONCAT')
		if (concatArgs) {
			return splitArgs(concatArgs).map(stringValue).join('')
		}

		const ifArgs = extractFunctionArgs(expr, 'IF')
		if (ifArgs) {
			const args = splitArgs(ifArgs)
			if (args.length < 3) return ''
			const resultExpr = evaluateSimpleCondition(args[0]!) ? args[1]! : args[2]!
			return evaluateFormulaResult(resultExpr)
		}

		const aggregate = expr.match(/^(SUM|AVG|MIN|MAX|COUNT)\((.*)\)$/i)
		if (aggregate) {
			const fn = aggregate[1]!.toUpperCase()
			const nums = splitArgs(aggregate[2]!)
				.map(arg => evaluateNumber(arg))
				.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
			switch (fn) {
				case 'SUM':
					return formatNumber(nums.reduce((a, b) => a + b, 0))
				case 'AVG':
					return nums.length > 0 ? formatNumber(nums.reduce((a, b) => a + b, 0) / nums.length) : '0'
				case 'MIN':
					return nums.length > 0 ? formatNumber(Math.min(...nums)) : '0'
				case 'MAX':
					return nums.length > 0 ? formatNumber(Math.max(...nums)) : '0'
				case 'COUNT':
					return String(nums.length)
			}
		}

		return evaluateFormulaResult(expr)
	} catch {
		return ''
	}
}

function replaceFieldReferences(
	formula: string,
	values: Record<string, string>,
	fields: FormField[],
): string {
	return formula.replace(/\{([^}]+)\}/g, (_match, rawKey) => {
		const key = String(rawKey).trim()
		if (values[key] !== undefined) return values[key]!
		const normalized = normalizeFieldKey(key)
		const field = fields.find(f =>
			f.id === key ||
			normalizeFieldKey(f.id) === normalized ||
			normalizeFieldKey(f.label) === normalized
		)
		return field ? (values[field.id] || '0') : '0'
	})
}

function normalizeFieldKey(value: string): string {
	return value.toLowerCase().trim().replace(/\s+/g, '_')
}

function extractFunctionArgs(expr: string, name: string): string | null {
	const prefix = `${name}(`
	if (!expr.toUpperCase().startsWith(prefix)) return null
	if (!expr.endsWith(')')) return null
	return expr.slice(prefix.length, -1)
}

function evaluateFormulaResult(expr: string): string {
	const trimmed = expr.trim()
	if (isQuoted(trimmed)) return stripQuotes(trimmed)
	const number = evaluateNumber(trimmed)
	if (typeof number === 'number' && Number.isFinite(number)) return formatNumber(number)
	if (looksLikeArithmeticExpression(trimmed)) return ''
	return trimmed
}

function evaluateNumber(expr: string): number | null {
	const parser = new ArithmeticParser(expr)
	return parser.parse()
}

class ArithmeticParser {
	private index = 0

	constructor(private readonly source: string) {}

	parse(): number | null {
		const result = this.parseExpression()
		this.skipWhitespace()
		if (result === null || this.index !== this.source.length || !Number.isFinite(result)) return null
		return result
	}

	private parseExpression(): number | null {
		let value = this.parseTerm()
		if (value === null) return null
		while (true) {
			this.skipWhitespace()
			const op = this.peek()
			if (op !== '+' && op !== '-') return value
			this.index += 1
			const right = this.parseTerm()
			if (right === null) return null
			value = op === '+' ? value + right : value - right
		}
	}

	private parseTerm(): number | null {
		let value = this.parseFactor()
		if (value === null) return null
		while (true) {
			this.skipWhitespace()
			const op = this.peek()
			if (op !== '*' && op !== '/') return value
			this.index += 1
			const right = this.parseFactor()
			if (right === null) return null
			value = op === '*' ? value * right : value / right
		}
	}

	private parseFactor(): number | null {
		this.skipWhitespace()
		const ch = this.peek()
		if (ch === '+' || ch === '-') {
			this.index += 1
			const value = this.parseFactor()
			return value === null ? null : ch === '-' ? -value : value
		}
		if (ch === '(') {
			this.index += 1
			const value = this.parseExpression()
			this.skipWhitespace()
			if (this.peek() !== ')') return null
			this.index += 1
			return value
		}
		return this.parseNumber()
	}

	private parseNumber(): number | null {
		this.skipWhitespace()
		const start = this.index
		while (/[0-9.]/.test(this.peek())) this.index += 1
		if (start === this.index) return null
		const token = this.source.slice(start, this.index)
		if (!/^\d+(\.\d+)?$|^\.\d+$/.test(token)) return null
		return Number(token)
	}

	private skipWhitespace(): void {
		while (/\s/.test(this.peek())) this.index += 1
	}

	private peek(): string {
		return this.source[this.index] || ''
	}
}

// Split comma-separated arguments respecting parentheses and quotes.
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
		if (ch === '(') depth += 1
		if (ch === ')') depth -= 1
		if (ch === ',' && depth === 0) {
			args.push(current.trim())
			current = ''
			continue
		}
		current += ch
	}
	if (current.trim()) args.push(current.trim())
	return args
}

// Evaluate simple conditions like: 5 == 5, "yes" == "yes", 10 > 5.
function evaluateSimpleCondition(condition: string): boolean {
	const operators = ['==', '!=', '>=', '<=', '>', '<'] as const
	for (const op of operators) {
		const parts = splitCondition(condition, op)
		if (!parts) continue
		const [left, right] = parts
		if (op === '==' || op === '!=') {
			const matches = stringValue(left) === stringValue(right)
			return op === '==' ? matches : !matches
		}
		const leftNumber = evaluateNumber(left)
		const rightNumber = evaluateNumber(right)
		if (leftNumber === null || rightNumber === null) return false
		if (op === '>=') return leftNumber >= rightNumber
		if (op === '<=') return leftNumber <= rightNumber
		if (op === '>') return leftNumber > rightNumber
		if (op === '<') return leftNumber < rightNumber
	}
	return false
}

function splitCondition(condition: string, operator: string): [string, string] | null {
	const index = condition.indexOf(operator)
	if (index < 0) return null
	return [
		condition.slice(0, index).trim(),
		condition.slice(index + operator.length).trim(),
	]
}

function stringValue(value: string): string {
	const trimmed = value.trim()
	return isQuoted(trimmed) ? stripQuotes(trimmed) : trimmed
}

function isQuoted(value: string): boolean {
	return (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))
}

function stripQuotes(value: string): string {
	return value.slice(1, -1)
}

function formatNumber(value: number): string {
	return String(Math.round(value * 100) / 100)
}

function looksLikeArithmeticExpression(value: string): boolean {
	return /^[\d+\-*/.()\s]+$/.test(value)
}
