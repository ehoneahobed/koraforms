import { defineConfig } from 'korajs/config'

export default defineConfig({
	schema: './src/schema.ts',
	dev: {
		port: 5173,
		sync: {
			enabled: true,
			port: 3001,
			store: 'sqlite',
		},
		watch: {
			enabled: true,
			debounceMs: 300,
		},
	},
})
