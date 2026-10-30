import type { KoraEvent } from 'korajs'

/**
 * Events from Kora's instant updates (`store.instantUpdates`) that the dogfood
 * week watches. A `store:overlay-diverged` means a predicted row differed from
 * what SQLite stored; the goal for the week is zero of them.
 */
export const OVERLAY_DIAGNOSTIC_EVENT_TYPES = [
	'store:overlay-diverged',
	'store:overlay-disabled',
] as const

/**
 * Formats an instant-updates event for the console, or returns null for any
 * other event. Names the collection and the differing field names only: never
 * field values, because they are form content.
 */
export function describeOverlayEvent(event: KoraEvent): string | null {
	switch (event.type) {
		case 'store:overlay-diverged':
			return `[KoraForms] store:overlay-diverged collection=${event.collection} fields=${event.fields.join(',')}`
		case 'store:overlay-disabled':
			return `[KoraForms] store:overlay-disabled collection=${event.collection} divergences=${event.divergences}`
		default:
			return null
	}
}

/**
 * Logs instant-updates divergences with console.error so they show in the
 * browser console (and in any console-capturing error reporter). Bind right
 * after createApp so early events are not missed.
 */
export function logOverlayDiagnostics(app: { events: { on: (type: (typeof OVERLAY_DIAGNOSTIC_EVENT_TYPES)[number], listener: (event: KoraEvent) => void) => unknown } }): void {
	for (const type of OVERLAY_DIAGNOSTIC_EVENT_TYPES) {
		app.events.on(type, (event) => {
			const line = describeOverlayEvent(event)
			if (line) console.error(line)
		})
	}
}
