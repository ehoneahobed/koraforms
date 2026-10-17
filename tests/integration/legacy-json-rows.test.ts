import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HybridLogicalClock, createOperation } from '@korajs/core'
import { createSqliteServerStore } from '@korajs/server'
import schema from '../../src/schema'
import { parseFormFields, parseFormSettings } from '../../src/domain/forms'
import { validatePublishedResponsePayload } from '../../src/domain/responseValidation'
import { evaluatePublicResponseAcceptance } from '../../src/domain/responseAcceptance'

// A form row written by builds before beta.13: the operation carries the
// question list and the settings as a JSON string of a JSON string, which the
// beta.13 server materializes as written.
test('a legacy row with doubly encoded json fields reads back and accepts responses', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'koraforms-legacy-'))
	const store = createSqliteServerStore({ filename: join(dir, 'server.db') })
	try {
		await store.setSchema(schema)
		const questions = [
			{ id: 'field_name', type: 'text', label: 'Full Name', required: true },
			{ id: 'field_email', type: 'email', label: 'Email', required: true },
		]
		const settings = { maxResponses: 2 }
		const op = await createOperation({
			nodeId: '11111111-1111-4111-8111-111111111111',
			type: 'insert',
			collection: 'forms',
			recordId: 'form-legacy',
			data: {
				title: 'Church Member Registration',
				status: 'published',
				slug: 'church',
				fields: JSON.stringify(JSON.stringify(questions)),
				settings: JSON.stringify(JSON.stringify(settings)),
			},
			previousData: null,
			sequenceNumber: 1,
			causalDeps: [],
			schemaVersion: 19,
		}, new HybridLogicalClock('legacy'))
		await store.applyRemoteOperation(op)

		const [row] = await store.queryCollection('forms', { where: { slug: 'church' } })
		assert.equal(typeof row?.fields, 'string', 'the server returns the stored string as written')
		const fields = parseFormFields(row?.fields)
		assert.deepEqual(fields.map(field => field.id), ['field_name', 'field_email'])
		assert.deepEqual(parseFormSettings(row?.settings), settings)

		// The response route validates against these fields and applies these settings.
		const valid = validatePublishedResponsePayload(fields, JSON.stringify({ field_name: 'Ada', field_email: 'ada@example.com' }))
		assert.equal(valid.valid, true, JSON.stringify(valid.issues))
		assert.equal(evaluatePublicResponseAcceptance(parseFormSettings(row?.settings), 2).accepted, false, 'the response limit still applies')
	} finally {
		await store.close()
		rmSync(dir, { recursive: true, force: true })
	}
})
