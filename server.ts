import { resolve } from 'node:path'
import { lookup } from 'node:dns/promises'
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
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
import { parseFormFields, parseFormSettings, safeJsonParse, serializeFormSettings } from './src/domain/forms'
import { FORM_PASSWORD_ALGORITHM, hasFormAccessPassword, stripFormAccessSecrets } from './src/domain/formPassword'
import { validatePublishedResponsePayload } from './src/domain/responseValidation'
import { buildSideEffectDeliveryJobs, isDeliverableWebhookUrl, isPublicWebhookIpAddress, normalizeWebhookConfig } from './src/domain/responseSideEffects'
import { buildOpsDiagnosticsSnapshot } from './src/domain/opsDiagnostics'

// ---------------------------------------------------------------------------
// KoraForms schema (shared between client and server for materialized tables)
// ---------------------------------------------------------------------------

const koraFormsSchema = defineSchema({
	version: 12,
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
				theme: t.string().default('red'),
				responseCount: t.number().default(0).merge('counter'),
				ownerId: t.string().default(''),
				slug: t.string().default(''),
				settings: t.string().default('{}'),
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
				clientSubmissionId: t.string().default(''),
				submittedAt: t.number(),
			},
			indexes: ['formId', 'clientSubmissionId', 'submittedAt'],
		},
		public_form_versions: {
			fields: {
				slug: t.string(),
				formId: t.string(),
				versionHash: t.string(),
				title: t.string(),
				description: t.string().default(''),
				fields: t.string().default('[]'),
				settings: t.string().default('{}'),
				theme: t.string().default('red'),
				status: t.enum(['published', 'revoked']).default('published'),
				cachedAt: t.number(),
				publishedAt: t.number(),
			},
			indexes: ['slug', 'formId', 'versionHash', 'status', 'cachedAt'],
			constraints: [{
				type: 'unique',
				fields: ['slug', 'versionHash'],
				onConflict: 'first-write-wins',
			}],
		},
		response_submissions: {
			fields: {
				formId: t.string(),
				slug: t.string().default(''),
				formVersionHash: t.string().default(''),
				data: t.string().default('{}'),
				clientSubmissionId: t.string(),
				localStatus: t.enum(['submitted_locally', 'syncing', 'accepted', 'rejected', 'failed']).default('submitted_locally'),
				attempts: t.number().default(0),
				lastError: t.string().default(''),
				submittedAt: t.number(),
				updatedAt: t.number(),
			},
			indexes: ['formId', 'slug', 'clientSubmissionId', 'localStatus', 'submittedAt'],
			constraints: [{
				type: 'unique',
				fields: ['formId', 'clientSubmissionId'],
				onConflict: 'first-write-wins',
			}],
		},
		public_form_progress: {
			fields: {
				slug: t.string(),
				formId: t.string(),
				answers: t.string().default('{}'),
				currentIndex: t.number().default(-1),
				resumeId: t.string().default(''),
				resumeUrl: t.string().default(''),
				savedAt: t.number(),
				updatedAt: t.number(),
			},
			indexes: ['slug', 'formId', 'resumeId', 'updatedAt'],
			constraints: [{
				type: 'unique',
				fields: ['slug'],
				onConflict: 'last-write-wins',
			}],
		},
		resume_links: {
			fields: {
				token: t.string(),
				formId: t.string(),
				slug: t.string(),
				data: t.string().default('{}'),
				status: t.enum(['active', 'expired', 'revoked']).default('active'),
				createdAt: t.number(),
				updatedAt: t.number(),
				expiresAt: t.number(),
			},
			indexes: ['token', 'formId', 'slug', 'status', 'expiresAt', 'updatedAt'],
			constraints: [{
				type: 'unique',
				fields: ['token'],
				onConflict: 'first-write-wins',
			}],
		},
		side_effect_deliveries: {
			fields: {
				responseId: t.string(),
				formId: t.string(),
				type: t.enum(['webhook', 'email']),
				target: t.string(),
				payload: t.string().default('{}'),
				status: t.enum(['pending', 'delivering', 'delivered', 'failed']).default('pending'),
				attempts: t.number().default(0),
				lastError: t.string().default(''),
				nextAttemptAt: t.number(),
				createdAt: t.number(),
				updatedAt: t.number(),
			},
			indexes: ['responseId', 'formId', 'type', 'status', 'nextAttemptAt', 'createdAt'],
		},
	},
})

type SideEffectDeliveryRecord = {
	id: string
	responseId: string
	formId: string
	type: 'webhook' | 'email'
	target: string
	payload: string
	status: 'pending' | 'delivering' | 'delivered' | 'failed'
	attempts: number
	lastError: string
	nextAttemptAt: number
	createdAt: number
	updatedAt: number
}

type ResumeLinkRecord = {
	id: string
	token: string
	formId: string
	slug: string
	data: string
	status: 'active' | 'expired' | 'revoked'
	createdAt: number
	updatedAt: number
	expiresAt: number
}

const SCHEMA_VERSION = 12
const RESUME_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_RESUME_PAYLOAD_BYTES = 128 * 1024
const MAX_PUBLIC_RESPONSE_BODY_BYTES = 2 * 1024 * 1024
const DEFAULT_PUBLIC_RESULTS_LIMIT = 100
const MAX_PUBLIC_RESULTS_LIMIT = 500
const WEBHOOK_TIMEOUT_MS = 10_000
const WEBHOOK_ERROR_BODY_LIMIT = 2048
const DEVELOPMENT_AUTH_SECRET = 'koraforms-dev-secret-change-in-production'

type RateLimitBucket =
	| 'auth'
	| 'public_form_read'
	| 'public_password'
	| 'public_partial_read'
	| 'public_partial_write'
	| 'public_results'
	| 'public_submit'

const RATE_LIMITS: Record<RateLimitBucket, { limit: number; windowMs: number }> = {
	auth: { limit: 30, windowMs: 60_000 },
	public_form_read: { limit: 120, windowMs: 60_000 },
	public_password: { limit: 8, windowMs: 5 * 60_000 },
	public_partial_read: { limit: 60, windowMs: 60_000 },
	public_partial_write: { limit: 30, windowMs: 60_000 },
	public_results: { limit: 60, windowMs: 60_000 },
	public_submit: { limit: 20, windowMs: 60_000 },
}

function createRateLimiter() {
	const buckets = new Map<string, { count: number; resetAt: number }>()

	return {
		check(bucket: RateLimitBucket, key: string): { limited: boolean; retryAfterSeconds: number } {
			const policy = RATE_LIMITS[bucket]
			const now = Date.now()
			const id = `${bucket}:${key || 'unknown'}`
			const current = buckets.get(id)
			if (!current || current.resetAt <= now) {
				buckets.set(id, { count: 1, resetAt: now + policy.windowMs })
				cleanupExpiredRateLimitBuckets(buckets, now)
				return { limited: false, retryAfterSeconds: 0 }
			}
			current.count += 1
			if (current.count <= policy.limit) return { limited: false, retryAfterSeconds: 0 }
			return {
				limited: true,
				retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
			}
		},
	}
}

function cleanupExpiredRateLimitBuckets(
	buckets: Map<string, { count: number; resetAt: number }>,
	now: number,
): void {
	if (buckets.size < 5000) return
	for (const [key, value] of buckets) {
		if (value.resetAt <= now) buckets.delete(key)
	}
}

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

function resolveAuthSecret(): string {
	const configured = process.env.KORA_AUTH_SECRET?.trim()
	if (process.env.NODE_ENV === 'production') {
		if (!configured || configured === DEVELOPMENT_AUTH_SECRET || configured.length < 32) {
			throw new Error('KORA_AUTH_SECRET must be set to a strong production secret before starting KoraForms.')
		}
		return configured
	}
	return configured || DEVELOPMENT_AUTH_SECRET
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const { store, userStore } = await createStores()
	const rateLimiter = createRateLimiter()
	const jwtSecret = resolveAuthSecret()

	await store.setSchema(koraFormsSchema)
	console.log('Materialized collection tables initialized')

	const auth = createKoraAuthServer({
		userStore,
		jwtSecret,
	})

	const port = Number(process.env.PORT) || 3001
	const distDir = resolve('./dist')
	const sideEffectProcessor = createSideEffectProcessor(store)
	sideEffectProcessor.start()

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

	function parseRequestBody<T extends Record<string, unknown>>(req: ProductionHttpRouteRequest): T | null {
		const body = typeof req.body === 'string' ? safeJsonParse<unknown>(req.body, null) : req.body
		if (!body || typeof body !== 'object' || Array.isArray(body)) return null
		return body as T
	}

	function rateLimit(req: ProductionHttpRouteRequest, bucket: RateLimitBucket): ProductionHttpRouteResponse | null {
		const result = rateLimiter.check(bucket, getClientAddress(req))
		if (!result.limited) return null
		return withCors({
			status: 429,
			headers: { 'Retry-After': String(result.retryAfterSeconds) },
			body: { error: 'Too many requests. Please try again shortly.' },
		})
	}

	function verifyFormAccessPassword(settings: ReturnType<typeof parseFormSettings>, password: string | undefined): boolean {
		if (!hasFormAccessPassword(settings)) return true
		if (!password) return false
		if (settings.passwordHash && settings.passwordSalt) {
			if (settings.passwordAlgorithm && settings.passwordAlgorithm !== FORM_PASSWORD_ALGORITHM) return false
			try {
				const iterations = settings.passwordIterations || 210_000
				const expected = Buffer.from(settings.passwordHash, 'base64')
				const salt = Buffer.from(settings.passwordSalt, 'base64')
				const actual = pbkdf2Sync(password, salt, iterations, expected.length, 'sha256')
				return expected.length === actual.length && timingSafeEqual(expected, actual)
			} catch {
				return false
			}
		}
		return settings.password === password
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
			// Authenticated users get full access. Public respondent submissions
			// are finalized through the validated public endpoint until Kora has
			// first-class anonymous operation validation/materialization.
			auth: new MixedAuthProvider({
				primary: auth.auth,
				anonymousScopes: {},
			}),
			schemaVersion: SCHEMA_VERSION,
		},
		httpRoutes: [
			// Auth routes — signup, signin, refresh, signout, me, devices
			{
				path: '/auth',
				async handle(req) {
					if (req.method === 'OPTIONS') {
						return withCors({ status: 204 })
					}
					const limited = rateLimit(req, 'auth')
					if (limited) return limited
					try {
						return withCors(await auth.handleRequest(req) as ProductionHttpRouteResponse)
					} catch (err) {
						console.error('Auth route error:', err)
						return withCors({ status: 500, body: { error: 'Internal auth error' } })
					}
				},
			},
			// Operational diagnostics — protected aggregate health snapshot.
			{
				path: '/api/ops/diagnostics',
				async handle(req: ProductionHttpRouteRequest): Promise<ProductionHttpRouteResponse> {
					if (req.method === 'OPTIONS') return withCors({ status: 204 })
					if (req.method !== 'GET') return withCors({ status: 405, body: { error: 'Method not allowed' } })
					if (!isAuthorizedOpsRequest(req)) {
						return withCors({ status: 401, body: { error: 'Unauthorized' } })
					}
					try {
						return withCors({ status: 200, body: await buildOpsDiagnostics(store) })
					} catch (err) {
						console.error('Operational diagnostics error:', err)
						return withCors({ status: 500, body: { error: 'Internal server error' } })
					}
				},
			},
			// Public API: save and retrieve partial responses (save & continue later)
			{
				path: '/api/public/partial',
				async handle(req: ProductionHttpRouteRequest): Promise<ProductionHttpRouteResponse> {
					if (req.method === 'OPTIONS') return withCors({ status: 204 })

					if (req.method === 'POST') {
						const limited = rateLimit(req, 'public_partial_write')
						if (limited) return limited
						try {
							const body = parseRequestBody<{ formId?: unknown; data?: unknown; resumeId?: unknown }>(req)
							if (!body) return withCors({ status: 400, body: { error: 'Invalid JSON body' } })
							const formId = typeof body.formId === 'string' ? body.formId : ''
							const data = typeof body.data === 'string' ? body.data : ''
							const existingId = typeof body.resumeId === 'string' ? body.resumeId : undefined
							if (!formId || !data) return withCors({ status: 400, body: { error: 'formId and data required' } })
							if (Buffer.byteLength(data, 'utf8') > MAX_RESUME_PAYLOAD_BYTES) {
								return withCors({ status: 413, body: { error: 'Saved progress is too large' } })
							}
							const parsedProgress = safeJsonParse<unknown>(data, null)
							if (!parsedProgress || typeof parsedProgress !== 'object' || Array.isArray(parsedProgress)) {
								return withCors({ status: 400, body: { error: 'Saved progress must be a JSON object' } })
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
							if (!form) return withCors({ status: 404, body: { error: 'Form not found' } })

							const slug = String(form.slug || form.id)
							const formRecordId = String(form.id)
							const now = Date.now()
							const expiresAt = now + RESUME_LINK_TTL_MS
							let resumeId = isValidResumeToken(existingId) ? existingId! : ''
							let existingRecord: ResumeLinkRecord | null = null
							if (resumeId) {
								const [record] = await store.queryCollection('resume_links', {
									where: { token: resumeId },
									limit: 1,
								}) as ResumeLinkRecord[]
								if (
									record &&
									record.formId === formRecordId &&
									record.slug === slug &&
									record.status === 'active' &&
									record.expiresAt > now
								) {
									existingRecord = record
								} else {
									resumeId = ''
								}
							}
							if (!resumeId) {
								resumeId = await createUniqueResumeToken(store)
							}

							if (existingRecord) {
								await updateServerRecord(store, 'resume_links', existingRecord.id, {
									data,
									updatedAt: now,
									expiresAt,
								})
							} else {
								await insertServerRecord(store, 'resume_links', randomUUID(), {
									token: resumeId,
									formId: formRecordId,
									slug,
									data,
									status: 'active',
									createdAt: now,
									updatedAt: now,
									expiresAt,
								})
							}

							const baseUrl = process.env.PUBLIC_URL || 'https://forms.korajs.dev'
							return withCors({
								status: 200,
								body: {
									resumeId,
									resumeUrl: `${baseUrl}/f/${slug}?resume=${resumeId}`,
								},
							})
						} catch {
							return withCors({ status: 500, body: { error: 'Internal server error' } })
						}
					}

					if (req.method === 'GET') {
						const limited = rateLimit(req, 'public_partial_read')
						if (limited) return limited
						const { path, query } = parseRoutePath(req.path)
						const resumeId = path.replace('/api/public/partial/', '').replace(/\/$/, '')
						const expectedSlug = query.get('slug') || query.get('formId') || ''
						if (!resumeId || resumeId === '/api/public/partial') {
							return withCors({ status: 400, body: { error: 'resumeId required' } })
						}
						if (!isValidResumeToken(resumeId) || !expectedSlug) {
							return withCors({ status: 400, body: { error: 'resumeId and slug required' } })
						}

						const [entry] = await store.queryCollection('resume_links', {
							where: { token: resumeId, status: 'active' },
							limit: 1,
						}) as ResumeLinkRecord[]
						if (!entry || entry.slug !== expectedSlug) {
							return withCors({ status: 404, body: { error: 'No saved progress found' } })
						}
						if (entry.expiresAt <= Date.now()) {
							await updateServerRecord(store, 'resume_links', entry.id, {
								status: 'expired',
								updatedAt: Date.now(),
							}).catch(() => {})
							return withCors({ status: 410, body: { error: 'Saved progress has expired' } })
						}

						return withCors({
							status: 200,
							body: {
								formId: entry.formId,
								data: entry.data,
								savedAt: entry.updatedAt,
								slug: entry.slug,
								expiresAt: entry.expiresAt,
							},
						})
					}

					return withCors({ status: 405, body: { error: 'Method not allowed' } })
				},
			},
			// Public API: get published form by slug
			{
				path: '/api/public/forms',
				async handle(req: ProductionHttpRouteRequest): Promise<ProductionHttpRouteResponse> {
					const slug = req.path.replace('/api/public/forms/', '').replace(/\/$/, '')
					if (!slug) {
						return withCors({ status: 404, body: { error: 'Not found' } })
					}

					// POST = password verification
					if (req.method === 'POST') {
						const limited = rateLimit(req, 'public_password')
						if (limited) return limited
						try {
							const body = parseRequestBody<{ password?: unknown }>(req)
							if (!body) return withCors({ status: 400, body: { error: 'Invalid JSON body' } })
							const password = typeof body.password === 'string' ? body.password : undefined
							const [form] = await store.queryCollection('forms', {
								where: { slug, status: 'published' },
								limit: 1,
							})
							if (!form) return withCors({ status: 404, body: { error: 'Form not found' } })
							const formSettings = parseFormSettings(form.settings)
							if (verifyFormAccessPassword(formSettings, password)) {
								return withCors({
									status: 200,
									body: {
										...form,
										settings: serializeFormSettings(stripFormAccessSecrets(formSettings)),
									},
								})
							}
							return withCors({ status: 403, body: { error: 'Incorrect password' } })
						} catch {
							return withCors({ status: 500, body: { error: 'Internal server error' } })
						}
					}

					if (req.method === 'OPTIONS') return withCors({ status: 204 })
					if (req.method !== 'GET') {
						return withCors({ status: 404, body: { error: 'Not found' } })
					}
					const limited = rateLimit(req, 'public_form_read')
					if (limited) return limited
					try {
						const [form] = await store.queryCollection('forms', {
							where: { slug, status: 'published' },
							limit: 1,
						})
						if (!form) {
							return withCors({ status: 404, body: { error: 'Form not found' } })
						}
						// Check for password protection
						const formSettings = parseFormSettings(form.settings)
						if (hasFormAccessPassword(formSettings)) {
							// Return only metadata — require POST with password for full form
							return withCors({
								status: 200,
								body: {
									id: form.id,
									title: form.title,
									description: form.description,
									theme: form.theme,
									passwordProtected: true,
								},
							})
						}
						return withCors({
							status: 200,
							body: { ...form, settings: serializeFormSettings(stripFormAccessSecrets(formSettings)) },
						})
					} catch {
						return withCors({ status: 500, body: { error: 'Internal server error' } })
					}
				},
			},
			// Public API: get public results for a form
			{
				path: '/api/public/forms/*/results',
				async handle(req: ProductionHttpRouteRequest): Promise<ProductionHttpRouteResponse> {
					if (req.method === 'OPTIONS') return withCors({ status: 204 })
					if (req.method !== 'GET') {
						return withCors({ status: 405, body: { error: 'Method not allowed' } })
					}
					const limited = rateLimit(req, 'public_results')
					if (limited) return limited
					const route = parseRoutePath(req.path)
					const slug = route.path.match(/\/api\/public\/forms\/([^/]+)\/results/)?.[1]
					if (!slug) return withCors({ status: 404, body: { error: 'Not found' } })
					const resultLimit = clampNumber(
						Number(route.query.get('limit') || DEFAULT_PUBLIC_RESULTS_LIMIT),
						1,
						MAX_PUBLIC_RESULTS_LIMIT,
					)
					try {
						const [form] = await store.queryCollection('forms', {
							where: { slug: decodeURIComponent(slug), status: 'published' },
							limit: 1,
						})
						if (!form) {
							return withCors({ status: 404, body: { error: 'Form not found' } })
						}
						const formSettings = parseFormSettings(form.settings)
						if (!formSettings.publicResults) {
							return withCors({ status: 403, body: { error: 'Results are not public for this form' } })
						}
						const responses = await store.queryCollection('responses', {
							where: { formId: String(form.id) },
							limit: resultLimit + 1,
						})
						const visibleResponses = responses.slice(0, resultLimit)
						return withCors({
							status: 200,
							body: {
								form: { id: form.id, title: form.title, description: form.description, fields: form.fields, theme: form.theme },
								responses: visibleResponses.map(r => ({ data: r.data, submittedAt: r.submittedAt })),
								pagination: {
									limit: resultLimit,
									returned: visibleResponses.length,
									hasMore: responses.length > resultLimit,
								},
							},
						})
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
					const limited = rateLimit(req, 'public_submit')
					if (limited) return limited
					try {
						const body = parseRequestBody<{ formId?: unknown; data?: unknown; clientSubmissionId?: unknown; clientSubmittedAt?: unknown }>(req)
						if (!body) return withCors({ status: 400, body: { error: 'Invalid JSON body' } })
						const formId = typeof body.formId === 'string' ? body.formId : ''
						const data = typeof body.data === 'string' ? body.data : ''
						const clientSubmissionId = typeof body.clientSubmissionId === 'string' ? body.clientSubmissionId.trim() : ''
						const clientSubmittedAt = typeof body.clientSubmittedAt === 'number' && Number.isFinite(body.clientSubmittedAt)
							? body.clientSubmittedAt
							: Date.now()
						if (!formId || !data) {
							return withCors({ status: 400, body: { error: 'formId and data are required' } })
						}
						if (Buffer.byteLength(data, 'utf8') > MAX_PUBLIC_RESPONSE_BODY_BYTES) {
							return withCors({ status: 413, body: { error: 'Response payload is too large' } })
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
						if (clientSubmissionId) {
							const [existing] = await store.queryCollection('responses', {
								where: { formId: String(form.id), clientSubmissionId },
								limit: 1,
							})
							if (existing) {
								return withCors({ status: 200, body: { success: true, duplicate: true } })
							}
						}
						const formFields = parseFormFields(form.fields)
						const validation = validatePublishedResponsePayload(formFields, data)
						if (!validation.valid) {
							return withCors({ status: 422, body: { error: 'Response failed validation', issues: validation.issues } })
						}
						// Enforce response limits and scheduling
						try {
							const settings = parseFormSettings(form.settings)
							if (settings.closesAt && Date.now() > settings.closesAt) {
								return withCors({ status: 403, body: { error: settings.closedMessage || 'This form is no longer accepting responses.' } })
							}
							if (settings.opensAt && Date.now() < settings.opensAt) {
								return withCors({ status: 403, body: { error: 'This form is not yet open for responses.' } })
							}
							if (settings.maxResponses && settings.maxResponses > 0) {
								const existing = await store.queryCollection('responses', {
									where: { formId: String(form.id) },
								})
								if (existing.length >= settings.maxResponses) {
									return withCors({ status: 403, body: { error: settings.closedMessage || 'This form has reached its maximum number of responses.' } })
								}
							}
						} catch {
							// settings parse error - allow submission
						}
						const responseId = randomUUID()
						await insertServerRecord(store, 'responses', responseId, {
							formId: String(form.id),
							data: validation.data,
							submittedBy: '',
							clientSubmissionId,
							submittedAt: clientSubmittedAt,
						})

						// Persist side-effect delivery jobs before attempting delivery.
						try {
							const whSettings = parseFormSettings(form.settings)
							const fieldsMap: Record<string, { label: string; type: string }> = {}
							for (const f of formFields) {
								fieldsMap[f.id] = { label: f.label, type: f.type }
							}
							const formInfo = {
								id: String(form.id),
								title: String(form.title),
								slug: String(form.slug || ''),
							}
							const jobs = buildSideEffectDeliveryJobs(
								whSettings,
								formInfo,
								validation.data,
								fieldsMap,
								process.env.PUBLIC_URL || 'https://forms.korajs.dev',
								clientSubmittedAt,
							)
							for (const job of jobs) {
								await insertServerRecord(store, 'side_effect_deliveries', randomUUID(), {
									responseId,
									formId: String(form.id),
									type: job.type,
									target: job.target,
									payload: JSON.stringify(job.payload),
									status: 'pending',
									attempts: 0,
									lastError: '',
									nextAttemptAt: Date.now(),
									createdAt: Date.now(),
									updatedAt: Date.now(),
								})
							}
							sideEffectProcessor.runSoon()
						} catch {
							// webhook/notification error — don't block response
						}
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

async function insertServerRecord(
	store: ServerStore,
	collection: string,
	recordId: string,
	data: Record<string, unknown>,
): Promise<void> {
	const nodeId = store.getNodeId()
	const clock = new HybridLogicalClock(nodeId)
	const vv = store.getVersionVector()
	const seqNum = (vv.get(nodeId) ?? 0) + 1
	const op = await createOperation({
		nodeId,
		type: 'insert',
		collection,
		recordId,
		data,
		previousData: null,
		sequenceNumber: seqNum,
		causalDeps: [],
		schemaVersion: SCHEMA_VERSION,
	}, clock)
	await store.applyRemoteOperation(op)
}

async function updateServerRecord(
	store: ServerStore,
	collection: string,
	recordId: string,
	data: Record<string, unknown>,
): Promise<void> {
	const previousData = await store.findRecord(collection, recordId)
	const nodeId = store.getNodeId()
	const clock = new HybridLogicalClock(nodeId)
	const vv = store.getVersionVector()
	const seqNum = (vv.get(nodeId) ?? 0) + 1
	const op = await createOperation({
		nodeId,
		type: 'update',
		collection,
		recordId,
		data,
		previousData,
		sequenceNumber: seqNum,
		causalDeps: [],
		schemaVersion: SCHEMA_VERSION,
	}, clock)
	await store.applyRemoteOperation(op)
}

function parseRoutePath(path: string): { path: string; query: URLSearchParams } {
	const [pathname = '', search = ''] = path.split('?')
	return { path: pathname, query: new URLSearchParams(search) }
}

function getClientAddress(req: ProductionHttpRouteRequest): string {
	const headers = req.headers || {}
	const forwardedFor = getHeaderValue(headers, 'x-forwarded-for')
	if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown'
	return getHeaderValue(headers, 'cf-connecting-ip')
		|| getHeaderValue(headers, 'x-real-ip')
		|| getHeaderValue(headers, 'fastly-client-ip')
		|| 'unknown'
}

function getHeaderValue(headers: Record<string, unknown>, name: string): string {
	const direct = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()]
	if (Array.isArray(direct)) return String(direct[0] || '')
	return typeof direct === 'string' ? direct : ''
}

function isAuthorizedOpsRequest(req: ProductionHttpRouteRequest): boolean {
	const expected = process.env.KORA_METRICS_TOKEN || process.env.KORA_ADMIN_TOKEN
	if (!expected) return process.env.NODE_ENV !== 'production'
	const authHeader = getHeaderValue(req.headers || {}, 'authorization')
	const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
	if (!token) return false
	return constantTimeStringEqual(token, expected)
}

function constantTimeStringEqual(actual: string, expected: string): boolean {
	const actualBuffer = Buffer.from(actual)
	const expectedBuffer = Buffer.from(expected)
	if (actualBuffer.length !== expectedBuffer.length) return false
	return timingSafeEqual(actualBuffer, expectedBuffer)
}

async function buildOpsDiagnostics(store: ServerStore) {
	const [
		allForms,
		responses,
		resumeLinks,
		sideEffects,
	] = await Promise.all([
		store.queryCollection('forms', { includeDeleted: false }),
		store.queryCollection('responses', { includeDeleted: false }),
		store.queryCollection('resume_links', { includeDeleted: false }),
		store.queryCollection('side_effect_deliveries', { includeDeleted: false }),
	])
	return buildOpsDiagnosticsSnapshot({
		forms: allForms as Array<{ status?: unknown }>,
		responses: responses as Array<{ clientSubmissionId?: unknown }>,
		resumeLinks: resumeLinks as Array<{ status?: unknown }>,
		sideEffects,
	})
}

function clampNumber(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min
	return Math.min(max, Math.max(min, Math.floor(value)))
}

function isValidResumeToken(token: string | undefined): token is string {
	return typeof token === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(token)
}

async function createUniqueResumeToken(store: ServerStore): Promise<string> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const token = randomBytes(32).toString('base64url')
		const [existing] = await store.queryCollection('resume_links', {
			where: { token },
			limit: 1,
		})
		if (!existing) return token
	}
	throw new Error('Unable to create a unique resume token')
}

main().catch((err) => {
	console.error('Failed to start KoraForms server:', err)
	process.exit(1)
})

// ---------------------------------------------------------------------------
// Webhook delivery (fire-and-forget with retries)
// ---------------------------------------------------------------------------

interface WebhookConfig {
	url: string
	method?: 'POST' | 'PUT'
	headers?: Record<string, string>
	active?: boolean
}

function createSideEffectProcessor(store: ServerStore): { start: () => void; runSoon: () => void } {
	let timer: NodeJS.Timeout | null = null
	let running = false

	const runSoon = () => {
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => {
			processDueDeliveries(store).catch(err => console.warn('Side-effect delivery processor failed:', err))
		}, 50)
	}

	const start = () => {
		runSoon()
		setInterval(runSoon, 30_000)
	}

	async function processDueDeliveries(currentStore: ServerStore): Promise<void> {
		if (running) return
		running = true
		try {
			const now = Date.now()
			const records = [
				...await currentStore.queryCollection('side_effect_deliveries', { where: { status: 'pending' }, limit: 50 }),
				...await currentStore.queryCollection('side_effect_deliveries', { where: { status: 'failed' }, limit: 50 }),
				...await currentStore.queryCollection('side_effect_deliveries', { where: { status: 'delivering' }, limit: 50 }),
			] as SideEffectDeliveryRecord[]
			const due = records
				.filter(record => Number(record.nextAttemptAt || 0) <= now)
				.slice(0, 50)

			for (const delivery of due) {
				await processDelivery(currentStore, delivery)
			}
		} finally {
			running = false
		}
	}

	return { start, runSoon }
}

async function processDelivery(store: ServerStore, delivery: SideEffectDeliveryRecord): Promise<void> {
	const attempts = Number(delivery.attempts || 0) + 1
	await updateServerRecord(store, 'side_effect_deliveries', delivery.id, {
		status: 'delivering',
		attempts,
		updatedAt: Date.now(),
		lastError: '',
	})

	try {
		if (delivery.type === 'email') {
			await deliverEmailNotification(delivery.target, safeJsonParse<Record<string, unknown>>(delivery.payload, {}))
		} else {
			await deliverWebhookNotification(safeJsonParse<Record<string, unknown>>(delivery.payload, {}))
		}
		await updateServerRecord(store, 'side_effect_deliveries', delivery.id, {
			status: 'delivered',
			attempts,
			lastError: '',
			updatedAt: Date.now(),
		})
	} catch (error) {
		const nextAttemptAt = Date.now() + retryDelayMs(attempts)
		await updateServerRecord(store, 'side_effect_deliveries', delivery.id, {
			status: 'failed',
			attempts,
			lastError: error instanceof Error ? error.message : 'Delivery failed',
			nextAttemptAt,
			updatedAt: Date.now(),
		})
	}
}

function retryDelayMs(attempts: number): number {
	const capped = Math.min(Math.max(attempts, 1), 8)
	return Math.min(60 * 60 * 1000, 1000 * Math.pow(2, capped - 1))
}

// ---------------------------------------------------------------------------
// Email notification (via Resend API, persisted delivery jobs)
// ---------------------------------------------------------------------------

async function deliverEmailNotification(
	toEmail: string,
	email: Record<string, unknown>,
): Promise<void> {
	const subject = typeof email.subject === 'string' ? email.subject : 'New response'
	const html = typeof email.html === 'string' ? email.html : ''
	const text = typeof email.text === 'string' ? email.text : ''

	// Try Resend API first (recommended for production)
	const resendKey = process.env.RESEND_API_KEY
	if (resendKey) {
		const fromEmail = process.env.EMAIL_FROM || 'KoraForms <notifications@koraforms.app>'
		try {
			const res = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${resendKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					from: fromEmail,
					to: [toEmail],
					subject,
					html,
					text,
				}),
			})
			if (res.ok) {
				console.log(`Email notification sent to ${toEmail}`)
				return
			}
			throw new Error(`Resend API error ${res.status}: ${await res.text()}`)
		} catch (err) {
			throw err instanceof Error ? err : new Error('Email notification failed')
		}
	}

	console.log(`[EMAIL] ${subject} → ${toEmail}\n${text}`)
}

async function deliverWebhookNotification(payload: Record<string, unknown>): Promise<void> {
	const hook = normalizeWebhookConfig(payload.webhook as WebhookConfig)
	if (!hook || !isDeliverableWebhookUrl(hook.url)) return
	await assertPublicWebhookDestination(hook.url)
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
	const res = await fetch(hook.url, {
		method: hook.method || 'POST',
		redirect: 'manual',
		signal: controller.signal,
		headers: {
			'Content-Type': 'application/json',
			...(hook.headers || {}),
		},
		body: JSON.stringify(payload.body || {}),
	}).finally(() => clearTimeout(timeout))
	if (res.status >= 300 && res.status < 400) {
		throw new Error('Webhook redirects are not followed')
	}
	if (!res.ok) {
		const body = await readCappedResponseText(res, WEBHOOK_ERROR_BODY_LIMIT)
		throw new Error(`Webhook delivery failed with status ${res.status}${body ? `: ${body}` : ''}`)
	}
}

async function assertPublicWebhookDestination(value: string): Promise<void> {
	const url = new URL(value)
	const addresses = await lookup(url.hostname, { all: true, verbatim: true })
	if (addresses.length === 0) {
		throw new Error('Webhook host did not resolve')
	}
	for (const address of addresses) {
		if (!isPublicWebhookIpAddress(address.address)) {
			throw new Error('Webhook destination resolves to a private or reserved network')
		}
	}
}

async function readCappedResponseText(res: Response, maxBytes: number): Promise<string> {
	if (!res.body) return ''
	const reader = res.body.getReader()
	const chunks: Uint8Array[] = []
	let total = 0
	try {
		while (total < maxBytes) {
			const { done, value } = await reader.read()
			if (done || !value) break
			const remaining = maxBytes - total
			const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value
			chunks.push(chunk)
			total += chunk.byteLength
			if (value.byteLength > remaining) break
		}
	} finally {
		reader.cancel().catch(() => {})
	}
	return Buffer.concat(chunks).toString('utf8').trim()
}
