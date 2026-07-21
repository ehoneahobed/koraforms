import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
	createSqliteServerStore,
	createPostgresServerStore,
	createProductionServer,
	MixedAuthProvider,
} from '@korajs/server'
import {
	createKoraAuthServer,
	createSqliteUserStore,
	createPostgresUserStore,
} from '@korajs/auth/server'
import { defineSchema, t, createOperation, HybridLogicalClock } from '@korajs/core'
import type { ServerStore } from '@korajs/server'
import type { UserStore } from '@korajs/auth/server'
import type { ProductionHttpRouteRequest, ProductionHttpRouteResponse } from '@korajs/server'

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
				theme: t.string().default('blue'),
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const { store, userStore } = await createStores()

	await store.setSchema(koraFormsSchema)
	console.log('Materialized collection tables initialized')

	const auth = createKoraAuthServer({
		userStore,
		jwtSecret: process.env.KORA_AUTH_SECRET || 'koraforms-dev-secret-change-in-production',
	})

	const port = Number(process.env.PORT) || 3001
	const distDir = resolve('./dist')

	// CORS headers for dev mode (client on different port)
	const corsHeaders: Record<string, string> = process.env.NODE_ENV !== 'production'
		? {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		}
		: {}

	function withCors(response: ProductionHttpRouteResponse): ProductionHttpRouteResponse {
		return { ...response, headers: { ...response.headers, ...corsHeaders } }
	}

	// -----------------------------------------------------------------------
	// Production server — handles static files, WebSocket sync, CORS, health
	// check, metrics, admin dashboard, and backup endpoints automatically.
	// -----------------------------------------------------------------------
	const server = createProductionServer({
		store,
		port,
		staticDir: distDir,
		syncPath: '/kora-sync',
		syncOptions: {
			// Authenticated users get full access. Anonymous users (public form
			// respondents) get scoped write access to 'responses' only.
			auth: new MixedAuthProvider({
				primary: auth.auth,
				anonymousScopes: { responses: {} },
			}),
			schemaVersion: 4,
		},
		httpRoutes: [
			// Auth routes — signup, signin, refresh, signout, me, devices
			{
				path: '/auth',
				async handle(req) {
					if (req.method === 'OPTIONS') {
						return withCors({ status: 204 })
					}
					try {
						return withCors(await auth.handleRequest(req) as ProductionHttpRouteResponse)
					} catch (err) {
						console.error('Auth route error:', err)
						return withCors({ status: 500, body: { error: 'Internal auth error' } })
					}
				},
			},
			// Public API: get published form by slug
			{
				path: '/api/public/forms',
				async handle(req: ProductionHttpRouteRequest): Promise<ProductionHttpRouteResponse> {
					const slug = req.path.replace('/api/public/forms/', '').replace(/\/$/, '')
					if (!slug || req.method !== 'GET') {
						return withCors({ status: 404, body: { error: 'Not found' } })
					}
					try {
						const [form] = await store.queryCollection('forms', {
							where: { slug, status: 'published' },
							limit: 1,
						})
						if (form) {
							return withCors({ status: 200, body: form })
						}
						return withCors({ status: 404, body: { error: 'Form not found' } })
					} catch {
						return withCors({ status: 500, body: { error: 'Internal server error' } })
					}
				},
			},
			// Public API: submit a response via REST (no Kora sync needed)
			{
				path: '/api/public/responses',
				async handle(req: ProductionHttpRouteRequest): Promise<ProductionHttpRouteResponse> {
					if (req.method === 'OPTIONS') return withCors({ status: 204 })
					if (req.method !== 'POST') {
						return withCors({ status: 405, body: { error: 'Method not allowed' } })
					}
					try {
						const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
						const { formId, data } = body as { formId: string; data: string }
						if (!formId || !data) {
							return withCors({ status: 400, body: { error: 'formId and data are required' } })
						}
						// Look up form by ID or slug
						let [form] = await store.queryCollection('forms', {
							where: { id: formId, status: 'published' },
							limit: 1,
						})
						if (!form) {
							;[form] = await store.queryCollection('forms', {
								where: { slug: formId, status: 'published' },
								limit: 1,
							})
						}
						if (!form) {
							return withCors({ status: 404, body: { error: 'Form not found' } })
						}
						// Create and apply an insert operation for the response
						const nodeId = store.getNodeId()
						const clock = new HybridLogicalClock(nodeId)
						const vv = store.getVersionVector()
						const seqNum = (vv.get(nodeId) ?? 0) + 1
						const op = await createOperation({
							nodeId,
							type: 'insert',
							collection: 'responses',
							recordId: randomUUID(),
							data: {
								formId: String(form.id),
								data,
								submittedBy: '',
								submittedAt: Date.now(),
							},
							previousData: null,
							sequenceNumber: seqNum,
							causalDeps: [],
							schemaVersion: 4,
						}, clock)
						await store.applyRemoteOperation(op)
						return withCors({ status: 201, body: { success: true } })
					} catch (err) {
						console.error('Public response submission error:', err)
						return withCors({ status: 500, body: { error: 'Internal server error' } })
					}
				},
			},
		],
		operationalAuth: {
			adminToken: process.env.KORA_ADMIN_TOKEN,
			metricsToken: process.env.KORA_METRICS_TOKEN,
			backupToken: process.env.KORA_BACKUP_TOKEN,
		},
	})

	const url = await server.start()
	console.log(`KoraForms running at ${url}`)
}

main().catch((err) => {
	console.error('Failed to start KoraForms server:', err)
	process.exit(1)
})
