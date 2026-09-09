import { existsSync, readdirSync, copyFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

function crossOriginIsolation(): Plugin {
	const embedderPolicy = process.env.KORA_COEP_POLICY === 'require-corp' ? 'require-corp' : 'credentialless'

	function applyHeaders(res: { setHeader(name: string, value: string): void }) {
		res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
		res.setHeader('Cross-Origin-Embedder-Policy', embedderPolicy)
		res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
	}

	return {
		name: 'cross-origin-isolation',
		configureServer(server) {
			server.middlewares.use((_req, res, next) => {
				applyHeaders(res)
				next()
			})
		},
		configurePreviewServer(server) {
			server.middlewares.use((_req, res, next) => {
				applyHeaders(res)
				next()
			})
		},
	}
}

function sqliteWasmHotfix(): Plugin {
	return {
		name: 'sqlite-wasm-hotfix',
		apply: 'build',
		closeBundle() {
			const assetsDir = resolve('dist', 'assets')
			if (!existsSync(assetsDir)) return

			for (const file of readdirSync(assetsDir)) {
				if (/^sqlite3-.+\.wasm$/.test(file)) {
					copyFileSync(join(assetsDir, file), join(assetsDir, 'sqlite3.wasm'))
					break
				}
			}

			const proxyFile = resolve(
				'node_modules',
				'@sqlite.org',
				'sqlite-wasm',
				'sqlite-wasm',
				'jswasm',
				'sqlite3-opfs-async-proxy.js',
			)
			if (existsSync(proxyFile)) {
				copyFileSync(proxyFile, join(assetsDir, 'sqlite3-opfs-async-proxy.js'))
			}
		},
	}
}

export default defineConfig({
	plugins: [react(), tailwindcss(), crossOriginIsolation(), sqliteWasmHotfix()],
	worker: {
		format: 'es',
	},
	optimizeDeps: {
		exclude: ['@sqlite.org/sqlite-wasm', '@korajs/store'],
		include: ['yjs'],
	},
	resolve: {
		dedupe: ['yjs'],
		alias: {
			'@korajs/store/better-sqlite3': resolve(__dirname, 'src/shims/kora-better-sqlite3.browser.ts'),
		},
	},
	build: {
		modulePreload: {
			resolveDependencies(filename, deps) {
				// Public form visits should not preload TipTap or the Kora/sqlite runtime.
				if (filename.includes('PublicFormPage') || filename.includes('index-')) {
					return deps.filter(dep =>
						!dep.includes('vendor-editor') &&
						!dep.includes('publicKoraBootstrap') &&
						!dep.includes('AuthenticatedAppShell') &&
						!dep.includes('sqlite3') &&
						!/korajs|@korajs/.test(dep)
					)
				}
				return deps
			},
		},
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes('node_modules')) return
					// Avoid matching `@korajs/react` when detecting the React packages.
					if (
						/[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id) &&
						!id.includes('@korajs')
					) {
						return 'vendor-react'
					}
					if (id.includes('@tiptap') || id.includes('prosemirror') || id.includes('orderedmap')) {
						return 'vendor-editor'
					}
				},
			},
		},
	},
	server: {
		allowedHosts: true,
		fs: {
			// Allow serving files from linked Kora monorepo (pnpm link)
			allow: ['..'],
		},
		proxy: {
			'/kora-sync': {
				target: 'ws://localhost:3001',
				ws: true,
				rewriteWsOrigin: true,
			},
			'/auth': {
				target: 'http://localhost:3001',
				changeOrigin: true,
			},
			'/api': {
				target: 'http://localhost:3001',
				changeOrigin: true,
			},
		},
	},
})
