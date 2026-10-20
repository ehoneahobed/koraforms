/**
 * One-time forced full resync of every user's devices (2026-10-20).
 *
 * WHY: devices that ran earlier Kora canaries may still hold records they lost
 * read access to (a retraction-ordering bug fixed in Kora PR #54). Re-scoping does
 * not repair them because it judges the device's own values; a full resync from
 * delivery watermark 0 against the fixed server does, and keeps unsent writes.
 *
 * REMOVE once every active device has reconnected after this deploy (a few weeks):
 * delete this file, its call in server.ts and its test. The marker table
 * `koraforms_server_tasks` can be dropped then too.
 */
import type { FullResyncTarget } from '@korajs/server'

export const FULL_RESYNC_MARKER = 'kora-full-resync-2026-10-20'

/** Durable "this one-time task already ran" markers. */
export interface ServerTaskMarkers {
	has(name: string): Promise<boolean>
	set(name: string, completedAt: number): Promise<void>
	close(): Promise<void>
}

export interface FullResyncOnceOptions {
	markers: ServerTaskMarkers
	/** Every user id the auth store knows. */
	listUserIds: () => Promise<string[]>
	/**
	 * Persist a full-resync request (the server store's `requestFullResync`). Each device
	 * of the user re-downloads from watermark 0 at its next handshake.
	 */
	requestFullResync: ((target: FullResyncTarget) => Promise<number>) | undefined
	now?: () => number
}

export type FullResyncOnceResult =
	| { status: 'already-done' }
	| { status: 'requested'; users: number }

/**
 * Request a full resync for every user once. The marker is written only after every
 * request succeeded, so a failure is retried at the next start (re-requesting a user
 * is harmless: their devices resync once more). Throws on failure; the caller logs it.
 */
export async function runFullResyncOnce(options: FullResyncOnceOptions): Promise<FullResyncOnceResult> {
	const { markers, listUserIds, requestFullResync } = options
	if (await markers.has(FULL_RESYNC_MARKER)) return { status: 'already-done' }
	if (!requestFullResync) {
		throw new Error('The server store does not implement requestFullResync (FULL_RESYNC_UNSUPPORTED).')
	}
	const userIds = [...new Set(await listUserIds())].filter((id) => id.length > 0)
	for (const userId of userIds) {
		await requestFullResync({ userId })
	}
	await markers.set(FULL_RESYNC_MARKER, (options.now ?? Date.now)())
	return { status: 'requested', users: userIds.length }
}

const MARKER_TABLE = 'koraforms_server_tasks'

/** Markers in a tiny table of the server's PostgreSQL database. */
export async function createPostgresTaskMarkers(connectionString: string): Promise<ServerTaskMarkers> {
	const { default: postgres } = await import('postgres')
	const sql = postgres(connectionString, { max: 1, onnotice: () => {} })
	try {
		await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${MARKER_TABLE} (name TEXT PRIMARY KEY, completed_at BIGINT NOT NULL)`)
	} catch (error) {
		await sql.end({ timeout: 5 }).catch(() => {})
		throw error
	}
	return {
		async has(name) {
			const rows = await sql.unsafe(`SELECT 1 FROM ${MARKER_TABLE} WHERE name = $1`, [name])
			return rows.length > 0
		},
		async set(name, completedAt) {
			await sql.unsafe(
				`INSERT INTO ${MARKER_TABLE} (name, completed_at) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
				[name, completedAt],
			)
		},
		async close() {
			await sql.end({ timeout: 5 })
		},
	}
}

/** Markers in a tiny table of the server's SQLite database file. */
export async function createSqliteTaskMarkers(filename: string): Promise<ServerTaskMarkers> {
	const { default: Database } = await import('better-sqlite3')
	const db = new Database(filename)
	try {
		db.pragma('busy_timeout = 5000')
		db.exec(`CREATE TABLE IF NOT EXISTS ${MARKER_TABLE} (name TEXT PRIMARY KEY, completed_at INTEGER NOT NULL)`)
	} catch (error) {
		db.close()
		throw error
	}
	return {
		async has(name) {
			return db.prepare(`SELECT 1 FROM ${MARKER_TABLE} WHERE name = ?`).get(name) !== undefined
		},
		async set(name, completedAt) {
			db.prepare(`INSERT OR IGNORE INTO ${MARKER_TABLE} (name, completed_at) VALUES (?, ?)`).run(name, completedAt)
		},
		async close() {
			db.close()
		},
	}
}
