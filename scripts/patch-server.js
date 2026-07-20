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
	console.log('Pattern not found — module may already be patched')
	process.exit(0)
}

code = code.replace(old, fix)
writeFileSync(file, code)
console.log('Patched readBodyBuffer with resume() fix')
