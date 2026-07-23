import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './tests/e2e',
	// Public form tests exercise service workers and Kora's browser database on one origin.
	// Running them in parallel creates test-only storage contention between unrelated scenarios.
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://127.0.0.1:4175',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: 'pnpm run preview:e2e',
		url: 'http://127.0.0.1:4175',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
})
