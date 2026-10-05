import type { SyncStatus } from 'korajs'

export type SyncStatusTone = 'synced' | 'busy' | 'offline' | 'attention'

export interface SyncStatusDisplay {
	tone: SyncStatusTone
	title: string
	subtitle: string
}

/**
 * Creator-facing wording for every Kora sync status. Local data is always
 * saved; the subtitle says what sync needs, if anything.
 */
export function describeSyncStatus(status: SyncStatus, pendingOperations: number): SyncStatusDisplay {
	const pending = pendingOperations > 0
		? `${pendingOperations} change${pendingOperations === 1 ? '' : 's'} pending`
		: ''
	switch (status) {
		case 'synced':
		case 'connected':
			return { tone: 'synced', title: 'Saved locally', subtitle: 'Synced just now' }
		case 'syncing':
			return { tone: 'busy', title: 'Syncing...', subtitle: 'Saving changes' }
		case 'reconnecting':
			return { tone: 'busy', title: 'Reconnecting...', subtitle: pending || 'Changes are saved on this device' }
		case 'offline':
			return { tone: 'offline', title: 'Saved locally', subtitle: pending || 'No connection' }
		case 'clock-error':
			return { tone: 'attention', title: 'Sync paused', subtitle: 'Set this device\'s date and time correctly' }
		case 'auth-required':
			return { tone: 'attention', title: 'Sign in to sync', subtitle: pending || 'Changes are saved on this device' }
		case 'encryption-locked':
			return { tone: 'attention', title: 'Sync locked', subtitle: 'Unlock encryption to sync' }
		case 'schema-mismatch':
			return { tone: 'attention', title: 'Update needed', subtitle: 'Reload to get the latest version' }
		case 'error':
			return { tone: 'attention', title: 'Sync error', subtitle: 'Check connection' }
	}
}
