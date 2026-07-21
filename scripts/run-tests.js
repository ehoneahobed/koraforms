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

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...testFiles], {
	stdio: 'inherit',
})

process.exit(result.status ?? 1)
