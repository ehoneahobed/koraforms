import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { WebSocketServer } from 'ws'
import { createSqliteServerStore, createPostgresServerStore } from '@korajs/server'
import { KoraSyncServer } from '@korajs/server'
import { WsServerTransport } from '@korajs/server'
import {
	BuiltInAuthRoutes,
	TokenManager,
	createSqliteUserStore,
	createPostgresUserStore,
} from '@korajs/auth/server'
import type { ServerStore } from '@korajs/server'
import type { UserStore } from '@korajs/auth/server'

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

async function main(): Promise<void> {
	const { store, userStore } = await createStores()

	const tokenManager = new TokenManager({
		secret: process.env.AUTH_SECRET || 'koraforms-dev-secret-change-in-production',
	})

	const authRoutes = new BuiltInAuthRoutes({
		userStore,
		tokenManager,
	})

	// -----------------------------------------------------------------------
	// Sync server with auth
	// -----------------------------------------------------------------------

	const syncServer = new KoraSyncServer({
		store,
		auth: authRoutes.toSyncAuthProvider(),
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

	function getToken(req: import('node:http').IncomingMessage): string | undefined {
		const auth = req.headers.authorization
		if (auth?.startsWith('Bearer ')) return auth.slice(7)
		return undefined
	}

	function getClientIp(req: import('node:http').IncomingMessage): string {
		const forwarded = req.headers['x-forwarded-for']
		if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim()
		return req.socket.remoteAddress || '127.0.0.1'
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

		// --- Auth routes ---
		try {
			if (url.pathname === '/auth/signup' && method === 'POST') {
				const body = JSON.parse(await readBody(req))
				const result = await authRoutes.handleSignUp(body, getClientIp(req))
				sendJson(res, result.status, result.body)
				return
			}

			if (url.pathname === '/auth/signin' && method === 'POST') {
				const body = JSON.parse(await readBody(req))
				const result = await authRoutes.handleSignIn(body, getClientIp(req))
				sendJson(res, result.status, result.body)
				return
			}

			if (url.pathname === '/auth/refresh' && method === 'POST') {
				const body = JSON.parse(await readBody(req))
				const result = await authRoutes.handleRefresh(body)
				sendJson(res, result.status, result.body)
				return
			}

			if (url.pathname === '/auth/signout' && method === 'POST') {
				const token = getToken(req)
				if (!token) { sendJson(res, 401, { error: 'Unauthorized' }); return }
				const body = JSON.parse(await readBody(req))
				const result = await authRoutes.handleSignOut(token, body)
				sendJson(res, result.status, result.body)
				return
			}

			if (url.pathname === '/auth/me' && method === 'GET') {
				const token = getToken(req)
				if (!token) { sendJson(res, 401, { error: 'Unauthorized' }); return }
				const result = await authRoutes.handleGetMe(token)
				sendJson(res, result.status, result.body)
				return
			}

			if (url.pathname === '/auth/devices' && method === 'GET') {
				const token = getToken(req)
				if (!token) { sendJson(res, 401, { error: 'Unauthorized' }); return }
				const result = await authRoutes.handleListDevices(token)
				sendJson(res, result.status, result.body)
				return
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			const stack = err instanceof Error ? err.stack : undefined
			console.error('Auth route error:', message)
			if (stack) console.error(stack)
			sendJson(res, 500, { error: message || 'Internal server error' })
			return
		}

		// --- Public form OG meta injection for /f/:slug ---
		const formMatch = url.pathname.match(/^\/f\/([^/]+)$/)
		if (formMatch) {
			const slug = formMatch[1]
			const indexPath = join(distDir, 'index.html')
			if (existsSync(indexPath)) {
				let html = readFileSync(indexPath, 'utf-8')
				// Try to look up form by slug from the server store for OG tags
				try {
					const rows = await store.query<{ title: string; description: string }>(
						'SELECT title, description FROM forms WHERE slug = ? AND status = ? LIMIT 1',
						[slug, 'published'],
					)
					if (rows.length > 0) {
						const formData = rows[0]!
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
					// If query fails (e.g., no forms table yet), just serve vanilla index.html
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
