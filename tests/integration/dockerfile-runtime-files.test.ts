import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'

// The runtime image copies only selected files from the builder stage. A file
// server.ts imports at runtime but the image lacks crashes the container at
// boot, which no other test notices. Walk server.ts's relative (value) imports
// and require each file to be covered by a runtime-stage COPY.
const root = process.cwd()

function runtimeCopies(): string[] {
	const dockerfile = readFileSync(join(root, 'Dockerfile'), 'utf8')
	const stages = dockerfile.split(/^FROM /m)
	const runtime = stages[stages.length - 1] ?? ''
	return [...runtime.matchAll(/^COPY --from=builder \/app\/(\S+)/gm)].map((m) => normalize(m[1] ?? ''))
}

function resolveImport(from: string, spec: string): string | null {
	const base = join(dirname(from), spec)
	for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
		if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
	}
	return null
}

function runtimeImports(entry: string): Set<string> {
	const seen = new Set<string>()
	const queue = [entry]
	while (queue.length > 0) {
		const file = queue.pop() as string
		if (seen.has(file)) continue
		seen.add(file)
		const source = readFileSync(file, 'utf8')
		// `import type` and `export type` are erased at runtime.
		for (const m of source.matchAll(/^\s*(?:import|export)\s+(?!type\s)(?:[^'"]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/gm)) {
			const resolved = resolveImport(file, m[1] ?? '')
			assert.ok(resolved, `${relative(root, file)} imports ${m[1]}, which does not exist`)
			queue.push(resolved)
		}
	}
	return seen
}

test('every file server.ts imports at runtime is copied into the Docker runtime image', () => {
	const copies = runtimeCopies()
	assert.ok(copies.length > 0, 'found runtime COPY lines')
	const missing = [...runtimeImports(join(root, 'server.ts'))]
		.map((file) => relative(root, file))
		.filter((file) => !copies.some((copy) => file === copy || file.startsWith(`${copy}/`)))
	assert.deepEqual(missing, [], `add these to the runtime stage of the Dockerfile: ${missing.join(', ')}`)
})
