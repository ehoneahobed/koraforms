import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { WebSocketServer } from 'ws'
import { createSqliteServerStore, createPostgresServerStore, MixedAuthProvider } from '@korajs/server'
import { KoraSyncServer } from '@korajs/server'
import { WsServerTransport } from '@korajs/server'
import {
	createKoraAuthServer,
	createSqliteUserStore,
	createPostgresUserStore,
} from '@korajs/auth/server'
import { defineSchema, t } from '@korajs/core'
import type { ServerStore } from '@korajs/server'
import type { UserStore } from '@korajs/auth/server'

// ---------------------------------------------------------------------------
// KoraForms schema (shared between client and server for materialized tables)
// ---------------------------------------------------------------------------

const koraFormsSchema = defineSchema({
	version: 4,
	collections: {
		forms: {
			fields: {
				title: t.string(),
				description: t.string().default(''),
				fields: t.string().default('[]'),
				status: t.enum(['draft', 'published', 'closed']).default('draft').transitions({
					draft: ['published', 'closed'],
					published: ['draft', 'closed'],
					closed: [],
				}),
				theme: t.string().default('indigo'),
				responseCount: t.number().default(0).merge('counter'),
				ownerId: t.string().default(''),
				slug: t.string().default(''),
				createdAt: t.timestamp().auto(),
			},
			indexes: ['status', 'createdAt', 'ownerId', 'slug'],
			constraints: [{
				type: 'unique',
				fields: ['slug'],
				where: { status: { $ne: 'draft' } },
				onConflict: 'first-write-wins',
			}],
		},
		responses: {
			fields: {
				formId: t.string(),
				data: t.string().default('{}'),
				submittedBy: t.string().default(''),
				submittedAt: t.timestamp().auto(),
			},
			indexes: ['formId', 'submittedAt'],
		},
	},
})

// ---------------------------------------------------------------------------
// Storage & Auth setup
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL
const usePostgres = DATABASE_URL && DATABASE_URL.startsWith('postgres')

async function createStores(): Promise<{ store: ServerStore; userStore: UserStore }> {
	if (usePostgres) {
		console.log('Using PostgreSQL storage (DATABASE_URL detected)')
		const store = await createPostgresServerStore({ connectionString: DATABASE_URL })
		const userStore = await createPostgresUserStore({ connectionString: DATABASE_URL })
		return { store, userStore }
	}

	const dbPath = process.env.DB_PATH || './koraforms-server.db'
	console.log(`Using SQLite storage (${dbPath})`)
	const store = createSqliteServerStore({ filename: dbPath })
	const userStore = await createSqliteUserStore({ filename: dbPath })
	return { store, userStore }
}

/** Convert Node IncomingMessage to KoraAuthHttpRequest for handleRequest() */
function toAuthRequest(
	req: import('node:http').IncomingMessage,
	url: URL,
	body?: unknown,
): import('@korajs/auth/server').KoraAuthHttpRequest {
	const forwarded = req.headers['x-forwarded-for']
	const ip = typeof forwarded === 'string' ? forwarded.split(',')[0]!.trim() : req.socket.remoteAddress || '127.0.0.1'
	return {
		method: req.method || 'GET',
		path: url.pathname,
		body,
		headers: req.headers as Record<string, string | string[] | undefined>,
		query: Object.fromEntries(url.searchParams.entries()),
		ip,
	}
}

async function main(): Promise<void> {
	const { store, userStore } = await createStores()

	// Enable materialized collection tables for efficient indexed queries.
	// This creates actual 'forms' and 'responses' tables alongside the operations log,
	// and backfills them from existing operations if any.
	await store.setSchema(koraFormsSchema)
	console.log('Materialized collection tables initialized')

	const auth = createKoraAuthServer({
		userStore,
		jwtSecret: process.env.KORA_AUTH_SECRET || 'koraforms-dev-secret-change-in-production',
	})

	// -----------------------------------------------------------------------
	// Sync server with auth (supports both authenticated + anonymous users)
	// -----------------------------------------------------------------------

	// Authenticated users get full access. Anonymous users (public form
	// respondents) get scoped access: they can only sync the 'responses'
	// collection. This preserves full offline-first for everyone — a
	// respondent in a remote area saves locally and syncs when connected.
	const syncServer = new KoraSyncServer({
		store,
		auth: new MixedAuthProvider({
			primary: auth.auth,
			anonymousScopes: { responses: {} },
		}),
	})

	// -----------------------------------------------------------------------
	// MIME types
	// -----------------------------------------------------------------------

	const MIME_TYPES: Record<string, string> = {
		'.html': 'text/html',
		'.js': 'text/javascript',
		'.css': 'text/css',
		'.json': 'application/json',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.svg': 'image/svg+xml',
		'.ico': 'image/x-icon',
		'.wasm': 'application/wasm',
		'.woff': 'font/woff',
		'.woff2': 'font/woff2',
		'.map': 'application/json',
	}

	// -----------------------------------------------------------------------
	// HTTP helpers
	// -----------------------------------------------------------------------

	function readBody(req: import('node:http').IncomingMessage): Promise<string> {
		return new Promise((resolve, reject) => {
			let body = ''
			req.on('data', (chunk: Buffer) => { body += chunk.toString() })
			req.on('end', () => resolve(body))
			req.on('error', reject)
		})
	}

	function sendJson(res: import('node:http').ServerResponse, status: number, data: unknown) {
		res.writeHead(status, {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
		})
		res.end(JSON.stringify(data))
	}


	function escapeHtml(str: string): string {
		return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
	}

	// -----------------------------------------------------------------------
	// HTTP server
	// -----------------------------------------------------------------------

	const port = Number(process.env.PORT) || 3001
	const distDir = resolve('./dist')

	const httpServer = createServer(async (req, res) => {
		// COOP/COEP headers for SharedArrayBuffer (OPFS persistence)
		res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
		res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')

		const url = new URL(req.url || '/', `http://${req.headers.host}`)
		const method = req.method?.toUpperCase() || 'GET'

		// --- Health check endpoint ---
		if (url.pathname === '/health') {
			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }))
			return
		}

		// --- CORS preflight ---
		if (method === 'OPTIONS') {
			res.writeHead(204, {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
				'Access-Control-Max-Age': '86400',
			})
			res.end()
			return
		}

		// --- Auth routes (delegated to createKoraAuthServer handleRequest) ---
		if (url.pathname.startsWith('/auth/')) {
			try {
				const body = method === 'POST' ? JSON.parse(await readBody(req)) : undefined
				const result = await auth.handleRequest(toAuthRequest(req, url, body))
				sendJson(res, result.status, result.body)
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				console.error('Auth route error:', message)
				sendJson(res, 500, { error: message || 'Internal server error' })
			}
			return
		}

		// --- Public API: get published form by slug ---
		const apiFormMatch = url.pathname.match(/^\/api\/public\/forms\/([^/]+)$/)
		if (apiFormMatch && method === 'GET') {
			const slug = apiFormMatch[1]
			try {
				// Indexed query on materialized 'forms' table — O(1) via slug + status indexes
				const [form] = await store.queryCollection('forms', {
					where: { slug, status: 'published' },
					limit: 1,
				})
				if (form) {
					sendJson(res, 200, form)
				} else {
					sendJson(res, 404, { error: 'Form not found' })
				}
			} catch (err) {
				console.error('Public form API error:', err)
				sendJson(res, 500, { error: 'Internal server error' })
			}
			return
		}

		// --- Public form OG meta injection for /f/:slug ---
		const formMatch = url.pathname.match(/^\/f\/([^/]+)$/)
		if (formMatch) {
			const slug = formMatch[1]
			const indexPath = join(distDir, 'index.html')
			if (existsSync(indexPath)) {
				let html = readFileSync(indexPath, 'utf-8')
				// Look up form by slug from the materialized table for OG tags
				try {
					const [formData] = await store.queryCollection('forms', {
						where: { slug, status: 'published' },
						limit: 1,
					})
					if (formData) {
						const publicUrl = process.env.PUBLIC_URL || `http://localhost:${port}`
						const ogTags = [
							`<meta property="og:title" content="${escapeHtml(String(formData.title))}" />`,
							`<meta property="og:description" content="${escapeHtml(String(formData.description || 'Fill out this form on KoraForms'))}" />`,
							`<meta property="og:url" content="${publicUrl}/f/${slug}" />`,
							`<meta property="og:type" content="website" />`,
							`<meta name="twitter:card" content="summary" />`,
							`<meta name="twitter:title" content="${escapeHtml(String(formData.title))}" />`,
							`<meta name="twitter:description" content="${escapeHtml(String(formData.description || 'Fill out this form on KoraForms'))}" />`,
						].join('\n    ')
						html = html.replace('</head>', `    ${ogTags}\n  </head>`)
					}
				} catch {
					// If materialization fails, just serve vanilla index.html
				}
				res.writeHead(200, { 'Content-Type': 'text/html' })
				res.end(html)
				return
			}
		}

		// --- Static files ---
		let filePath = join(distDir, url.pathname)

		// SPA fallback: serve index.html for non-file routes
		if (!extname(filePath)) {
			const indexPath = join(filePath, 'index.html')
			if (existsSync(indexPath)) {
				filePath = indexPath
			} else {
				filePath = join(distDir, 'index.html')
			}
		}

		if (!existsSync(filePath)) {
			filePath = join(distDir, 'index.html')
		}

		try {
			const stat = statSync(filePath)
			if (stat.isDirectory()) {
				filePath = join(filePath, 'index.html')
			}
		} catch {
			filePath = join(distDir, 'index.html')
		}

		if (!existsSync(filePath)) {
			res.writeHead(404)
			res.end('Not Found')
			return
		}

		const ext = extname(filePath)
		const contentType = MIME_TYPES[ext] || 'application/octet-stream'
		res.writeHead(200, { 'Content-Type': contentType })
		createReadStream(filePath).pipe(res)
	})

	// -----------------------------------------------------------------------
	// WebSocket upgrade for sync
	// -----------------------------------------------------------------------

	const wss = new WebSocketServer({ noServer: true })

	httpServer.on('upgrade', (req, socket, head) => {
		const url = new URL(req.url || '/', `http://${req.headers.host}`)
		if (url.pathname === '/kora-sync') {
			wss.handleUpgrade(req, socket, head, (ws) => {
				const transport = new WsServerTransport(ws)
				syncServer.handleConnection(transport)
			})
		} else {
			socket.destroy()
		}
	})

	// -----------------------------------------------------------------------
	// Start
	// -----------------------------------------------------------------------

	httpServer.listen(port, '0.0.0.0', () => {
		console.log(`KoraForms running at http://localhost:${port}`)
	})
}

main().catch((err) => {
	console.error('Failed to start KoraForms server:', err)
	process.exit(1)
})
