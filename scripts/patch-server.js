/**
 * Temporary patches for Kora beta packages.
 *
 * These patches are intentionally narrow and idempotent. They keep KoraForms on
 * framework-owned data paths while we wait for the upstream packages to publish
 * the same fixes.
 *
 * 1. @korajs/server body parsing bug.
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
 * 2. @korajs/store beta.6 IndexedDB fallback persistence bug.
 *
 * Issue: IndexedDbAdapter.writeSnapshot() calls inner.exportDatabase() before
 * saving the logical SQL dump. The browser sqlite-wasm worker currently returns
 * "Export not yet supported in browser worker", so persistence fails before the
 * dump fallback is written.
 *
 * Fix: save the logical dump first, then attempt the binary export. If the
 * export remains unsupported, the already-saved dump is still durable and can be
 * restored by restoreFromDumpFallback() on the next open, even when there is no
 * binary snapshot key.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

patchServerBodyParsing()
patchStoreIndexedDbFallback('node_modules/@korajs/store/dist/adapters/indexeddb.js')
patchStoreIndexedDbFallback('node_modules/@korajs/store/dist/adapters/indexeddb.cjs')

function patchServerBodyParsing() {
	const file = resolve('node_modules/@korajs/server/dist/index.js')
	if (!existsSync(file)) {
		console.log('Patch skipped — @korajs/server dist file not found')
		return
	}

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
		return
	}

	code = code.replace(old, fix)
	writeFileSync(file, code)
	console.log('Applied readBodyBuffer resume() patch')
}

function patchStoreIndexedDbFallback(relativePath) {
	const file = resolve(relativePath)
	if (!existsSync(file)) {
		console.log(`Patch skipped — ${relativePath} not found`)
		return
	}

	let code = readFileSync(file, 'utf8')

	const saveDumpCall = 'await saveDumpToIndexedDB(this.dbName, dump);'
	const restoreWithoutBinaryPatched = [
		'const persisted = await loadFromIndexedDB(this.dbName);',
		'    if (!persisted) {',
		'      await this.restoreFromDumpFallback();',
		'      return;',
		'    }',
	].join('\n')
	let changed = false

	if (!code.includes(restoreWithoutBinaryPatched)) {
		const oldOpenRestore = [
			'const persisted = await loadFromIndexedDB(this.dbName);',
			'    if (!persisted) return;',
		].join('\n')
		const fixOpenRestore = restoreWithoutBinaryPatched

		if (code.includes(oldOpenRestore)) {
			code = code.replace(oldOpenRestore, fixOpenRestore)
			changed = true
		} else {
			console.log(`Patch warning — ${relativePath} open() restore path already fixed or changed`)
		}
	}

	const writeSnapshotPatched = [
		'async writeSnapshot() {',
		'    const dump = await this.exportDump();',
		`    ${saveDumpCall}`,
		'    try {',
	].join('\n')

	const old = [
		'async writeSnapshot() {',
		'    const data = await this.inner.exportDatabase();',
		'    await saveToIndexedDB(this.dbName, data);',
		'    const dump = await this.exportDump();',
		`    ${saveDumpCall}`,
		'  }',
	].join('\n')

	const fix = [
		'async writeSnapshot() {',
		'    const dump = await this.exportDump();',
		`    ${saveDumpCall}`,
		'    try {',
		'      const data = await this.inner.exportDatabase();',
		'      await saveToIndexedDB(this.dbName, data);',
		'    } catch (error) {',
		'      if (!isUnsupportedBrowserWorkerExport(error)) throw error;',
		'      await deleteFromIndexedDB(this.dbName);',
		`      ${saveDumpCall}`,
		'    }',
		'  }',
	].join('\n')

	if (!code.includes(writeSnapshotPatched) && code.includes(old)) {
		code = code.replace(old, fix)
		code = insertUnsupportedExportHelper(code)
		changed = true
	} else if (!code.includes(writeSnapshotPatched)) {
		console.log(`Patch not needed — ${relativePath} writeSnapshot already fixed or changed`)
	}

	if (!changed) {
		console.log(`Patch not needed — ${relativePath} IndexedDB fallback already patched`)
		return
	}

	writeFileSync(file, code)
	console.log(`Applied IndexedDB fallback persistence patch to ${relativePath}`)
}

function insertUnsupportedExportHelper(code) {
	const helper = [
		'function isUnsupportedBrowserWorkerExport(error) {',
		'  return error instanceof Error && /Export failed: Export not yet supported in browser worker/.test(error.message);',
		'}',
		'',
	].join('\n')

	if (code.includes('function isUnsupportedBrowserWorkerExport(error)')) {
		return code
	}

	const marker = `function ensureSafeIdentifier(identifier) {`
	if (!code.includes(marker)) {
		return code
	}

	return code.replace(marker, `${helper}${marker}`)
}
