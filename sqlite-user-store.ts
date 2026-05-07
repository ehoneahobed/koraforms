/**
 * SQLite-backed user and device store for KoraForms.
 *
 * Replaces InMemoryUserStore with persistent storage using better-sqlite3.
 * Implements the same interface so BuiltInAuthRoutes works without changes.
 */
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'

// ---------------------------------------------------------------------------
// Types (mirroring @korajs/auth/server exports)
// ---------------------------------------------------------------------------

interface AuthUser {
	id: string
	email: string
	name: string
	emailVerified: boolean
	createdAt: number
}

interface StoredUser extends AuthUser {
	passwordHash: string
	salt: string
}

interface AuthDevice {
	id: string
	userId: string
	publicKey: string
	name: string
	revoked: boolean
	createdAt: number
	lastSeenAt: number
}

class DuplicateEmailError extends Error {
	readonly code = 'DUPLICATE_EMAIL'
	constructor() {
		super('A user with this email already exists.')
		this.name = 'DuplicateEmailError'
	}
}

// ---------------------------------------------------------------------------
// SQLiteUserStore
// ---------------------------------------------------------------------------

export class SQLiteUserStore {
	private readonly db: InstanceType<typeof Database>

	constructor(dbPath: string) {
		this.db = new Database(dbPath)
		this.db.pragma('journal_mode = WAL')
		this.ensureTables()
	}

	private ensureTables(): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS auth_users (
				id TEXT PRIMARY KEY,
				email TEXT NOT NULL UNIQUE,
				name TEXT NOT NULL,
				email_verified INTEGER NOT NULL DEFAULT 0,
				created_at INTEGER NOT NULL,
				password_hash TEXT NOT NULL,
				salt TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS auth_devices (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				public_key TEXT NOT NULL,
				name TEXT NOT NULL,
				revoked INTEGER NOT NULL DEFAULT 0,
				created_at INTEGER NOT NULL,
				last_seen_at INTEGER NOT NULL,
				FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
			);

			CREATE INDEX IF NOT EXISTS idx_auth_devices_user_id ON auth_devices(user_id);
		`)
	}

	async createUser(params: {
		email: string
		passwordHash: string
		salt: string
		name: string
	}): Promise<AuthUser> {
		const normalizedEmail = params.email.toLowerCase()
		const now = Date.now()
		const id = randomUUID()

		try {
			this.db.prepare(`
				INSERT INTO auth_users (id, email, name, email_verified, created_at, password_hash, salt)
				VALUES (?, ?, ?, 0, ?, ?, ?)
			`).run(id, normalizedEmail, params.name, now, params.passwordHash, params.salt)
		} catch (err: unknown) {
			if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
				throw new DuplicateEmailError()
			}
			throw err
		}

		return { id, email: normalizedEmail, name: params.name, emailVerified: false, createdAt: now }
	}

	async findByEmail(email: string): Promise<StoredUser | null> {
		const row = this.db.prepare(
			'SELECT * FROM auth_users WHERE email = ?',
		).get(email.toLowerCase()) as Record<string, unknown> | undefined

		return row ? this.rowToStoredUser(row) : null
	}

	async findById(id: string): Promise<StoredUser | null> {
		const row = this.db.prepare(
			'SELECT * FROM auth_users WHERE id = ?',
		).get(id) as Record<string, unknown> | undefined

		return row ? this.rowToStoredUser(row) : null
	}

	async registerDevice(params: {
		id: string
		userId: string
		publicKey: string
		name: string
	}): Promise<AuthDevice> {
		const existing = this.db.prepare(
			'SELECT * FROM auth_devices WHERE id = ?',
		).get(params.id) as Record<string, unknown> | undefined

		if (existing && !existing.revoked) {
			return this.rowToDevice(existing)
		}

		const now = Date.now()

		if (existing) {
			// Re-activate previously revoked device
			this.db.prepare(`
				UPDATE auth_devices SET revoked = 0, public_key = ?, name = ?, last_seen_at = ?
				WHERE id = ?
			`).run(params.publicKey, params.name, now, params.id)
		} else {
			this.db.prepare(`
				INSERT INTO auth_devices (id, user_id, public_key, name, revoked, created_at, last_seen_at)
				VALUES (?, ?, ?, ?, 0, ?, ?)
			`).run(params.id, params.userId, params.publicKey, params.name, now, now)
		}

		return {
			id: params.id,
			userId: params.userId,
			publicKey: params.publicKey,
			name: params.name,
			revoked: false,
			createdAt: existing ? Number(existing.created_at) : now,
			lastSeenAt: now,
		}
	}

	async findDevice(deviceId: string): Promise<AuthDevice | null> {
		const row = this.db.prepare(
			'SELECT * FROM auth_devices WHERE id = ?',
		).get(deviceId) as Record<string, unknown> | undefined

		return row ? this.rowToDevice(row) : null
	}

	async listDevices(userId: string): Promise<AuthDevice[]> {
		const rows = this.db.prepare(
			'SELECT * FROM auth_devices WHERE user_id = ?',
		).all(userId) as Record<string, unknown>[]

		return rows.map((row) => this.rowToDevice(row))
	}

	async revokeDevice(deviceId: string): Promise<void> {
		this.db.prepare('UPDATE auth_devices SET revoked = 1 WHERE id = ?').run(deviceId)
	}

	async setEmailVerified(userId: string, verified: boolean): Promise<void> {
		this.db.prepare(
			'UPDATE auth_users SET email_verified = ? WHERE id = ?',
		).run(verified ? 1 : 0, userId)
	}

	async updatePassword(userId: string, passwordHash: string, salt: string): Promise<void> {
		this.db.prepare(
			'UPDATE auth_users SET password_hash = ?, salt = ? WHERE id = ?',
		).run(passwordHash, salt, userId)
	}

	async listAll(): Promise<StoredUser[]> {
		const rows = this.db.prepare('SELECT * FROM auth_users').all() as Record<string, unknown>[]
		return rows.map((row) => this.rowToStoredUser(row))
	}

	async update(user: StoredUser): Promise<void> {
		this.db.prepare(`
			UPDATE auth_users
			SET email = ?, name = ?, email_verified = ?, password_hash = ?, salt = ?
			WHERE id = ?
		`).run(user.email, user.name, user.emailVerified ? 1 : 0, user.passwordHash, user.salt, user.id)
	}

	async delete(userId: string): Promise<void> {
		const deleteInTransaction = this.db.transaction(() => {
			this.db.prepare('DELETE FROM auth_devices WHERE user_id = ?').run(userId)
			this.db.prepare('DELETE FROM auth_users WHERE id = ?').run(userId)
		})
		deleteInTransaction()
	}

	async touchDevice(deviceId: string): Promise<void> {
		this.db.prepare(
			'UPDATE auth_devices SET last_seen_at = ? WHERE id = ?',
		).run(Date.now(), deviceId)
	}

	// -----------------------------------------------------------------------
	// Row mapping helpers
	// -----------------------------------------------------------------------

	private rowToStoredUser(row: Record<string, unknown>): StoredUser {
		return {
			id: String(row.id),
			email: String(row.email),
			name: String(row.name),
			emailVerified: Boolean(row.email_verified),
			createdAt: Number(row.created_at),
			passwordHash: String(row.password_hash),
			salt: String(row.salt),
		}
	}

	private rowToDevice(row: Record<string, unknown>): AuthDevice {
		return {
			id: String(row.id),
			userId: String(row.user_id),
			publicKey: String(row.public_key),
			name: String(row.name),
			revoked: Boolean(row.revoked),
			createdAt: Number(row.created_at),
			lastSeenAt: Number(row.last_seen_at),
		}
	}
}
