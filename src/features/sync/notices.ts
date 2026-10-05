import type { KoraEvent } from 'korajs'

export type KoraNoticeTone = 'warning' | 'error'

/** A creator-facing notice derived from a Kora store or sync event. */
export interface KoraNotice {
	id: string
	tone: KoraNoticeTone
	title: string
	message: string
	/** Persistent notices describe a state the user must fix; they cannot be dismissed. */
	dismissible: boolean
}

export type KoraNoticeAction =
	| { type: 'show'; notice: KoraNotice }
	| { type: 'clear'; id: string }

const COLLECTION_LABELS: Record<string, string> = {
	forms: 'form',
	responses: 'response',
	form_collaborators: 'collaborator change',
	response_filter_views: 'saved view',
	response_export_presets: 'export preset',
}

/**
 * Maps the Kora events a creator must see to a notice action. Returns null for
 * every other event.
 */
export function noticeActionForEvent(event: KoraEvent): KoraNoticeAction | null {
	switch (event.type) {
		case 'store:storage-blocked':
			if (event.state === 'resolved') return { type: 'clear', id: 'storage-blocked' }
			return {
				type: 'show',
				notice: {
					id: 'storage-blocked',
					tone: 'warning',
					title: 'Close other KoraForms tabs',
					message: 'Another tab, often one still running an older version, is holding this device\'s KoraForms data. Close it and this tab continues on its own.',
					dismissible: false,
				},
			}
		case 'store:durability-lost':
			return {
				type: 'show',
				notice: {
					id: 'durability-lost',
					tone: 'error',
					title: 'This browser cannot save KoraForms data',
					message: 'Storage on this device is unavailable (a private window or blocked site data), so changes cannot be saved. Open KoraForms in a regular window or another browser.',
					dismissible: false,
				},
			}
		case 'store:schema-ahead':
			return {
				type: 'show',
				notice: {
					id: 'schema-ahead',
					tone: 'warning',
					title: 'A newer version of KoraForms is installed',
					message: 'This tab is running an older version. Reload the page to continue.',
					dismissible: false,
				},
			}
		case 'sync:operation-rejected': {
			if (event.retriable) return null
			const label = COLLECTION_LABELS[event.collection] ?? 'change'
			return {
				type: 'show',
				notice: {
					id: `rejected:${event.operationId}`,
					tone: 'warning',
					title: `A ${label} was undone`,
					message: `The server did not accept it (${event.code}): ${event.message}`,
					dismissible: true,
				},
			}
		}
		default:
			return null
	}
}

/** Most dismissible notices shown at once; persistent ones are never evicted. */
const MAX_DISMISSIBLE_NOTICES = 3

/**
 * Applies a notice action. A notice replaces one with the same id. Persistent
 * (non-dismissible) notices describe a state the user must fix, so they always
 * stay, first; only dismissible notices are capped, newest first.
 */
export function applyNoticeAction(notices: readonly KoraNotice[], action: KoraNoticeAction): KoraNotice[] {
	const id = action.type === 'show' ? action.notice.id : action.id
	const rest = notices.filter(notice => notice.id !== id)
	const next = action.type === 'show' ? [action.notice, ...rest] : rest
	const persistent = next.filter(notice => !notice.dismissible)
	const dismissible = next.filter(notice => notice.dismissible).slice(0, MAX_DISMISSIBLE_NOTICES)
	return [...persistent, ...dismissible]
}

/** The events {@link noticeActionForEvent} maps. */
export const NOTICE_EVENT_TYPES = [
	'store:storage-blocked',
	'store:durability-lost',
	'store:schema-ahead',
	'sync:operation-rejected',
] as const

/** A small external store, so notices raised before React mounts are kept. */
export interface KoraNoticeStore {
	subscribe(listener: () => void): () => void
	getSnapshot(): readonly KoraNotice[]
	handle(event: KoraEvent): void
	dismiss(id: string): void
}

export function createNoticeStore(): KoraNoticeStore {
	let notices: readonly KoraNotice[] = []
	const listeners = new Set<() => void>()
	const apply = (action: KoraNoticeAction): void => {
		notices = applyNoticeAction(notices, action)
		for (const listener of listeners) listener()
	}
	return {
		subscribe(listener) {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		getSnapshot: () => notices,
		handle(event) {
			const action = noticeActionForEvent(event)
			if (action) apply(action)
		},
		dismiss: id => apply({ type: 'clear', id }),
	}
}
