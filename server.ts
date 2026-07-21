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
	version: 5,
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
			schemaVersion: 5,
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
					if (!slug) {
						return withCors({ status: 404, body: { error: 'Not found' } })
					}

					// POST = password verification
					if (req.method === 'POST') {
						try {
							const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
							const { password } = body as { password?: string }
							const [form] = await store.queryCollection('forms', {
								where: { slug, status: 'published' },
								limit: 1,
							})
							if (!form) return withCors({ status: 404, body: { error: 'Form not found' } })
							const formSettings = JSON.parse(String(form.settings || '{}'))
							if (!formSettings.password || formSettings.password === password) {
								// Strip password from settings before sending
								delete formSettings.password
								return withCors({ status: 200, body: { ...form, settings: JSON.stringify(formSettings) } })
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
					try {
						const [form] = await store.queryCollection('forms', {
							where: { slug, status: 'published' },
							limit: 1,
						})
						if (!form) {
							return withCors({ status: 404, body: { error: 'Form not found' } })
						}
						// Check for password protection
						const formSettings = JSON.parse(String(form.settings || '{}'))
						if (formSettings.password) {
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
						return withCors({ status: 200, body: form })
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
					const slug = req.url?.match(/\/api\/public\/forms\/([^/]+)\/results/)?.[1]
					if (!slug) return withCors({ status: 404, body: { error: 'Not found' } })
					try {
						const [form] = await store.queryCollection('forms', {
							where: { slug: decodeURIComponent(slug), status: 'published' },
							limit: 1,
						})
						if (!form) {
							return withCors({ status: 404, body: { error: 'Form not found' } })
						}
						const formSettings = JSON.parse(String(form.settings || '{}'))
						if (!formSettings.publicResults) {
							return withCors({ status: 403, body: { error: 'Results are not public for this form' } })
						}
						const responses = await store.queryCollection('responses', {
							where: { formId: String(form.id) },
						})
						return withCors({
							status: 200,
							body: {
								form: { id: form.id, title: form.title, description: form.description, fields: form.fields, theme: form.theme },
								responses: responses.map(r => ({ data: r.data, submittedAt: r.submittedAt })),
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
						// Enforce response limits and scheduling
						try {
							const settings = JSON.parse(String(form.settings || '{}'))
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
							schemaVersion: 5,
						}, clock)
						await store.applyRemoteOperation(op)
						// Fire webhooks and email notifications (fire-and-forget)
						try {
							const whSettings = JSON.parse(String(form.settings || '{}'))
							const formFields = JSON.parse(String(form.fields || '[]'))
							const fieldsMap: Record<string, { label: string; type: string }> = {}
							for (const f of formFields) {
								fieldsMap[f.id] = { label: f.label, type: f.type }
							}
							const formInfo = {
								id: String(form.id),
								title: String(form.title),
								slug: String(form.slug || ''),
							}
							if (whSettings.webhooks?.length) {
								fireWebhooks(whSettings.webhooks, formInfo, data, fieldsMap).catch(console.error)
							}
							if (whSettings.notifyEmail) {
								sendEmailNotification(whSettings.notifyEmail, formInfo, data, fieldsMap).catch(console.error)
							}
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

// ---------------------------------------------------------------------------
// Email notification (via SMTP or Resend API)
// ---------------------------------------------------------------------------

async function sendEmailNotification(
	toEmail: string,
	form: { id: string; title: string; slug: string },
	responseData: string,
	fieldsMap: Record<string, { label: string; type: string }>,
): Promise<void> {
	const data = JSON.parse(responseData)
	const baseUrl = process.env.PUBLIC_URL || 'https://forms.korajs.dev'

	// Build a plain-text summary of the response
	const lines: string[] = []
	for (const [fieldId, value] of Object.entries(data)) {
		if (fieldId === '_meta') continue
		const info = fieldsMap[fieldId]
		const label = info?.label || fieldId
		lines.push(`${label}: ${String(value)}`)
	}
	const responseSummary = lines.join('\n')
	const viewUrl = `${baseUrl}/forms/${form.id}/responses`

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
					subject: `New response: ${form.title}`,
					html: `
						<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px">
							<h2 style="color:#1a1a1a;font-size:18px;margin:0 0 4px">New response received</h2>
							<p style="color:#666;font-size:14px;margin:0 0 20px">${form.title}</p>
							<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 20px">
								${lines.map(l => {
									const [label, ...rest] = l.split(': ')
									return `<div style="margin:0 0 8px"><span style="color:#6b7280;font-size:12px;display:block">${label}</span><span style="color:#1a1a1a;font-size:14px">${rest.join(': ')}</span></div>`
								}).join('')}
							</div>
							<a href="${viewUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500">View all responses</a>
							<p style="color:#9ca3af;font-size:11px;margin:20px 0 0">Sent by KoraForms</p>
						</div>
					`,
				}),
			})
			if (res.ok) {
				console.log(`Email notification sent to ${toEmail} for form "${form.title}"`)
				return
			}
			console.warn('Resend API error:', res.status, await res.text())
		} catch (err) {
			console.warn('Email notification failed:', err)
		}
		return
	}

	// Fallback: log the notification (no email service configured)
	console.log(`[EMAIL] New response notification for "${form.title}" → ${toEmail}\n${responseSummary}`)
}

async function fireWebhooks(
	webhooks: WebhookConfig[],
	form: { id: string; title: string; slug: string },
	responseData: string,
	fieldsMap: Record<string, { label: string; type: string }>,
): Promise<void> {
	const payload = {
		event: 'response.created',
		form,
		response: {
			submittedAt: Date.now(),
			data: JSON.parse(responseData),
			fields: fieldsMap,
		},
	}

	for (const hook of webhooks) {
		if (hook.active === false) continue
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				const res = await fetch(hook.url, {
					method: hook.method || 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(hook.headers || {}),
					},
					body: JSON.stringify(payload),
				})
				if (res.ok) break
			} catch {
				if (attempt < 2) {
					await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
				}
			}
		}
	}
}
