import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

function findTests(dir) {
	const files = []
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry)
		const stat = statSync(path)
		if (stat.isDirectory()) files.push(...findTests(path))
		else if (entry.endsWith('.test.ts')) files.push(path)
	}
	return files
}

const testFiles = findTests('tests')
if (testFiles.length === 0) {
	console.error('No test files found.')
	process.exit(1)
}

// A per-test timeout, so one test that never finishes fails on its own instead of hiding the rest.
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-timeout=60000', ...testFiles], {
	stdio: 'inherit',
})

process.exit(result.status ?? 1)
