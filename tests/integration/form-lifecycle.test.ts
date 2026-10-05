import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from 'korajs'
import schema from '../../src/schema'
import { buildStatusPayload } from '../../src/features/forms/shell'

test('a closed form can be reopened as live or as a draft', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'koraforms-status-'))
	const app = createApp({ schema, store: { adapter: 'better-sqlite3', name: join(dir, 'creator') } })
	try {
		await app.ready
		const form = await app.forms.insert({ title: 'Survey', ownerId: 'u1' })
		for (const status of ['published', 'closed', 'published', 'closed', 'draft'] as const) {
			await app.forms.update(form.id, buildStatusPayload(status, 'survey', 'Survey'))
			assert.equal((await app.forms.findById(form.id))?.status, status)
		}
	} finally {
		await app.close()
		rmSync(dir, { recursive: true, force: true })
	}
})
