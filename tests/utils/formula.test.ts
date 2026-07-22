import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateFormula } from '../../src/utils/formula'
import type { FormField } from '../../src/types'

const fields: FormField[] = [
	{ id: 'guests', type: 'number', label: 'Number of guests' },
	{ id: 'rate', type: 'number', label: 'Ticket price' },
	{ id: 'attending', type: 'yes_no', label: 'Will you attend?' },
	{ id: 'name', type: 'text', label: 'Your Name' },
]

const values = {
	guests: '3',
	rate: '25',
	attending: 'yes',
	name: 'Ada',
}

test('formula evaluator handles arithmetic without dynamic code execution', () => {
	assert.equal(evaluateFormula('1 + 2 * 3', values, fields), '7')
	assert.equal(evaluateFormula('({Number of guests} + 1) * {Ticket price}', values, fields), '100')
	assert.equal(evaluateFormula('{guests} / 2', values, fields), '1.5')
})

test('formula evaluator handles aggregates and conditionals', () => {
	assert.equal(evaluateFormula('SUM({Number of guests}, {Ticket price}, 2)', values, fields), '30')
	assert.equal(evaluateFormula('AVG({Number of guests}, {Ticket price})', values, fields), '14')
	assert.equal(evaluateFormula('MIN({Number of guests}, {Ticket price})', values, fields), '3')
	assert.equal(evaluateFormula('MAX({Number of guests}, {Ticket price})', values, fields), '25')
	assert.equal(evaluateFormula('COUNT({Number of guests}, apples, {Ticket price})', values, fields), '2')
	assert.equal(evaluateFormula('IF({Will you attend?} == "yes", 10, 0)', values, fields), '10')
	assert.equal(evaluateFormula('IF({Number of guests} > 5, "large", "small")', values, fields), 'small')
})

test('formula evaluator handles string concatenation', () => {
	assert.equal(evaluateFormula('CONCAT("Hello ", {Your Name})', values, fields), 'Hello Ada')
})

test('formula evaluator rejects malformed arithmetic and non-finite results', () => {
	assert.equal(evaluateFormula('1 + alert(1)', values, fields), '1 + alert(1)')
	assert.equal(evaluateFormula('10 / 0', values, fields), '')
	assert.equal(evaluateFormula('(1 + 2', values, fields), '')
})
