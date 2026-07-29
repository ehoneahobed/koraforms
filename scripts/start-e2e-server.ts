import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const runtimeDir = resolve('.kora/e2e')

rmSync(runtimeDir, { recursive: true, force: true })
mkdirSync(runtimeDir, { recursive: true })

process.env.NODE_ENV ||= 'test'
process.env.PORT ||= '4175'
process.env.ALLOW_EPHEMERAL_SQLITE ||= 'true'
process.env.DB_PATH ||= resolve(runtimeDir, 'koraforms-e2e-server.db')
process.env.BLOB_STORE_PATH ||= resolve(runtimeDir, 'blobs')
process.env.KORA_AUTH_SECRET ||= 'koraforms-e2e-auth-secret-at-least-thirty-two-bytes'

await import('../server.ts')
