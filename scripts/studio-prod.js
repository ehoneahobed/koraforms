/**
 * Launch Kora Studio connected to the production sync server.
 *
 * Usage:
 *   pnpm studio:prod
 *
 * Set KORA_STUDIO_EMAIL and KORA_STUDIO_PASSWORD env vars (or in .env)
 * to authenticate and see all collections (forms + responses).
 * Without credentials, studio connects anonymously and only sees responses.
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Load .env manually (no dotenv dependency)
try {
	const env = readFileSync('.env', 'utf8')
	for (const line of env.split('\n')) {
		const match = line.match(/^([A-Z_]+)=(.+)$/)
		if (match && !process.env[match[1]]) {
			process.env[match[1]] = match[2]
		}
	}
} catch { /* no .env file */ }

const PROD_URL = 'wss://forms.korajs.dev/kora-sync'
const AUTH_URL = 'https://forms.korajs.dev'
const email = process.env.KORA_STUDIO_EMAIL
const password = process.env.KORA_STUDIO_PASSWORD

let tokenArg = ''

if (email && password) {
	try {
		const res = await fetch(`${AUTH_URL}/auth/signin`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password }),
		})
		const data = await res.json()
		if (data.accessToken) {
			tokenArg = ` --token ${data.accessToken}`
			console.log(`Authenticated as ${email}`)
		} else {
			console.warn(`Auth failed: ${data.error || 'unknown error'} — connecting anonymously`)
		}
	} catch (err) {
		console.warn(`Auth request failed — connecting anonymously`)
	}
} else {
	console.log('No KORA_STUDIO_EMAIL/PASSWORD set — connecting anonymously (responses only)')
	console.log('Tip: add KORA_STUDIO_EMAIL and KORA_STUDIO_PASSWORD to .env for full access')
}

const cmd = `npx kora studio --connect ${PROD_URL} --schema ./src/schema.ts${tokenArg}`
execSync(cmd, { stdio: 'inherit' })
