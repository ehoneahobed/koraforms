/**
 * Temporary patch for @korajs/server body parsing bug.
 *
 * Issue: readBodyBuffer() attaches data/end listeners but never calls
 * req.resume(), so the Node.js IncomingMessage stream stays paused and
 * POST bodies are silently lost (returns empty buffer → undefined body).
 *
 * Fix: add req.resume() after attaching listeners + error handler.
 *
 * This patch is safe to keep after the fix ships — it exits cleanly
 * when the vulnerable pattern is no longer present.
 *
 * Tracking: https://github.com/aspect-build/kora/issues/TBD
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve('node_modules/@korajs/server/dist/index.js')
let code = readFileSync(file, 'utf8')

const old = [
	'function readBodyBuffer(req) {',
	'    return new Promise((resolve) => {',
	'      const chunks = [];',
	'      req.on("data", (chunk) => chunks.push(chunk));',
	'      req.on("end", () => resolve(Buffer.concat(chunks)));',
	'    });',
	'  }',
].join('\n')

const fix = [
	'function readBodyBuffer(req) {',
	'    return new Promise((resolve) => {',
	'      const chunks = [];',
	'      req.on("data", (chunk) => chunks.push(chunk));',
	'      req.on("end", () => resolve(Buffer.concat(chunks)));',
	'      req.on("error", () => resolve(Buffer.alloc(0)));',
	'      if (!req.readableFlowing) req.resume();',
	'    });',
	'  }',
].join('\n')

if (!code.includes(old)) {
	console.log('Patch not needed — readBodyBuffer already fixed or changed')
	process.exit(0)
}

code = code.replace(old, fix)
writeFileSync(file, code)
console.log('Applied readBodyBuffer resume() patch (see scripts/patch-server.js)')
