export type ResponsesSubTab = 'all' | 'analytics' | 'insights' | 'todo'

export const RESPONSES_SUB_TABS: ResponsesSubTab[] = ['all', 'analytics', 'insights', 'todo']

const RESPONSES_SUB_TAB_KEYS = new Set<ResponsesSubTab>(RESPONSES_SUB_TABS)

export function parseResponsesSubTab(value: string | null | undefined): ResponsesSubTab {
	return value && RESPONSES_SUB_TAB_KEYS.has(value as ResponsesSubTab) ? value as ResponsesSubTab : 'all'
}

export function responsesSubTabFromSearch(search: string): ResponsesSubTab {
	return parseResponsesSubTab(new URLSearchParams(search).get('tab'))
}

export function updateResponsesSubTabUrl(currentHref: string, tab: ResponsesSubTab): string {
	const url = new URL(currentHref)
	if (tab === 'all') url.searchParams.delete('tab')
	else url.searchParams.set('tab', tab)
	return `${url.pathname}${url.search}${url.hash}`
}

export function toggleSelectedResponseId(selectedIds: Set<string>, id: string): Set<string> {
	const next = new Set(selectedIds)
	if (next.has(id)) next.delete(id)
	else next.add(id)
	return next
}

export function toggleVisibleResponseSelection(
	selectedIds: Set<string>,
	visibleIds: string[],
): Set<string> {
	if (visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id))) {
		const next = new Set(selectedIds)
		for (const id of visibleIds) next.delete(id)
		return next
	}
	return new Set([...selectedIds, ...visibleIds])
}

export function reconcileSelectedResponseIds(
	selectedIds: Set<string>,
	visibleIds: string[],
): Set<string> {
	if (selectedIds.size === 0) return selectedIds
	const visible = new Set(visibleIds)
	const next = new Set(Array.from(selectedIds).filter(id => visible.has(id)))
	return next.size === selectedIds.size ? selectedIds : next
}
