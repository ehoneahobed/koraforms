import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HybridLogicalClock, createOperation } from '@korajs/core'
import { createSqliteServerStore } from '@korajs/server'
import schema from '../../src/schema'

// The real KoraForms server: a link-preview crawler (Accept */*, no Sec-Fetch-*)
// requesting a shared form link gets the form's own title and description.

function get(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
	return new Promise((done, fail) => {
		const req = request(url, { headers }, (res) => {
			const chunks: Buffer[] = []
			res.on('data', (chunk: Buffer) => chunks.push(chunk))
			res.on('end', () => done({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }))
		})
		req.on('error', fail)
		req.end()
	})
}

async function seed(dbPath: string): Promise<void> {
	const store = createSqliteServerStore({ filename: dbPath })
	await store.setSchema(schema)
	const node = '11111111-1111-4111-8111-111111111111'
	const clock = new HybridLogicalClock(node)
	const forms: Array<[string, Record<string, unknown>]> = [
		['f-pub', { title: 'Pump 3 handover', description: 'Check the seals before restart.', slug: 'pump-3', status: 'published', ownerId: 'u1' }],
		['f-draft', { title: 'Secret draft', description: 'not yet', slug: 'draft-1', status: 'draft', ownerId: 'u1' }],
	]
	let seq = 0
	for (const [recordId, data] of forms) {
		seq += 1
		await store.applyRemoteOperation(await createOperation({
			nodeId: node, type: 'insert', collection: 'forms', recordId, data, previousData: null,
			sequenceNumber: seq, causalDeps: [], schemaVersion: schema.version,
		}, clock))
	}
	await store.close()
}

test('shared form links preview the published form; drafts keep the generic card', { timeout: 60_000 }, async () => {
	const dir = mkdtempSync(join(tmpdir(), 'koraforms-preview-'))
	const dist = join(dir, 'dist')
	mkdirSync(dist)
	writeFileSync(join(dist, 'index.html'), '<!doctype html><html><head><title>KoraForms</title><meta name="description" content="Build forms that work anywhere" /></head><body></body></html>')
	const dbPath = join(dir, 'server.db')
	await seed(dbPath)
	const port = 4300 + Math.floor(Math.random() * 500)
	// cwd is the fixture directory (the server serves ./dist), so the loader is passed by URL.
	const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), join(process.cwd(), 'server.ts')], {
		cwd: dir,
		env: {
			...process.env,
			NODE_ENV: 'test',
			PORT: String(port),
			DB_PATH: dbPath,
			ALLOW_EPHEMERAL_SQLITE: 'true',
			BLOB_STORE_PATH: join(dir, 'blobs'),
			KORA_AUTH_SECRET: 'koraforms-preview-test-secret-at-least-thirty-two-bytes',
			PUBLIC_URL: 'https://forms.example',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	let log = ''
	child.stdout.on('data', (chunk) => { log += chunk })
	child.stderr.on('data', (chunk) => { log += chunk })
	try {
		const base = `http://127.0.0.1:${port}`
		const started = Date.now()
		for (;;) {
			try {
				if ((await get(`${base}/health`, {})).status === 200) break
			} catch {}
			if (Date.now() - started > 40_000) throw new Error(`server did not start:\n${log}`)
			await new Promise((resolve) => setTimeout(resolve, 250))
		}
		const crawler = { 'user-agent': 'facebookexternalhit/1.1', accept: '*/*' }
		const pub = await get(`${base}/f/pump-3`, crawler)
		assert.equal(pub.status, 200)
		assert.match(pub.body, /<title>Pump 3 handover<\/title>/)
		assert.match(pub.body, /<meta property="og:title" content="Pump 3 handover" \/>/)
		assert.match(pub.body, /<meta name="description" content="Check the seals before restart\." \/>/)
		assert.match(pub.body, /<link rel="canonical" href="https:\/\/forms\.example\/f\/pump-3" \/>/)
		const byId = await get(`${base}/f/f-pub`, crawler)
		assert.match(byId.body, /<title>KoraForms<\/title>/, 'id paths are not previewed: the public form API resolves slugs only')
		const draft = await get(`${base}/f/draft-1`, crawler)
		assert.equal(draft.status, 200)
		assert.match(draft.body, /<title>KoraForms<\/title>/)
		assert.doesNotMatch(draft.body, /Secret draft/)
		const draftById = await get(`${base}/f/f-draft`, crawler)
		assert.doesNotMatch(draftById.body, /Secret draft/)
		const results = await get(`${base}/f/pump-3/results`, crawler)
		assert.match(results.body, /<title>KoraForms<\/title>/, 'results are not public for this form')
	} finally {
		child.kill('SIGTERM')
		await new Promise((resolve) => child.once('exit', resolve))
		rmSync(dir, { recursive: true, force: true })
	}
})
