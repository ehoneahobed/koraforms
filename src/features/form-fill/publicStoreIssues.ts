import type { PublicApp } from '../../publicKoraBootstrap'
import type { PublicStoreIssue } from './offlineModel'

// Store issues the public (respondent) database reported. Listeners attach when
// the app is created (publicKoraBootstrap.ts), before its database opens, so
// open-time events such as store:storage-blocked are not missed.
const MAX_STORE_ISSUES = 5
const publicStoreIssues: PublicStoreIssue[] = []

let publicStoreListenersAttached = false

function rememberPublicStoreIssue(issue: Omit<PublicStoreIssue, 'seenAt'>): void {
	publicStoreIssues.unshift({ ...issue, seenAt: Date.now() })
	publicStoreIssues.splice(MAX_STORE_ISSUES)
}

function forgetPublicStoreIssue(type: PublicStoreIssue['type']): void {
	for (let index = publicStoreIssues.length - 1; index >= 0; index--) {
		if (publicStoreIssues[index]?.type === type) publicStoreIssues.splice(index, 1)
	}
}

export function attachPublicStoreListeners(app: PublicApp): void {
	if (publicStoreListenersAttached) return
	publicStoreListenersAttached = true

	app.events.on('store:opfs-unavailable', event => {
		rememberPublicStoreIssue({
			type: 'opfs-unavailable',
			dbName: event.dbName,
			reason: event.reason,
			message: event.message,
			blocking: true,
		})
	})

	app.events.on('store:storage-fallback', event => {
		rememberPublicStoreIssue({
			type: 'storage-fallback',
			dbName: event.dbName,
			reason: event.reason,
			from: event.from,
			to: event.to,
			message: event.message,
			blocking: false,
		})
	})

	app.events.on('store:db-name-collision', event => {
		rememberPublicStoreIssue({
			type: 'db-name-collision',
			dbName: event.dbName,
			message: event.message,
			blocking: true,
		})
	})

	app.events.on('store:persistence-error', event => {
		rememberPublicStoreIssue({
			type: 'persistence-error',
			dbName: event.dbName,
			reason: event.code,
			message: event.message,
			blocking: true,
		})
	})

	// No durable storage: Kora refuses local writes (StorageDurabilityError), so
	// offline queueing is unavailable; online submissions still go straight to
	// the server.
	app.events.on('store:durability-lost', event => {
		rememberPublicStoreIssue({
			type: 'durability-lost',
			dbName: event.dbName,
			reason: event.reason,
			message: 'This browser is not letting KoraForms save data on the device (a private window or blocked site data), so responses cannot be kept offline. Submit while online, or use a regular browser window.',
			blocking: true,
		})
	})

	// Another tab (often one still running an older build) holds the database;
	// the open waits until it closes.
	app.events.on('store:storage-blocked', event => {
		if (event.state === 'resolved') {
			forgetPublicStoreIssue('storage-blocked')
			return
		}
		rememberPublicStoreIssue({
			type: 'storage-blocked',
			dbName: event.dbName,
			reason: event.resource,
			message: 'Another tab with this form is holding offline storage. Close other KoraForms tabs to finish preparing offline use.',
			blocking: true,
		})
	})

	app.events.on('store:quota-exceeded', event => {
		rememberPublicStoreIssue({
			type: 'quota-exceeded',
			dbName: event.dbName,
			message: event.message,
			blocking: true,
		})
	})
}

export function getPublicStoreIssues(): PublicStoreIssue[] {
	return publicStoreIssues.slice()
}
