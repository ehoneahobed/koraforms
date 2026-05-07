import { useState, useCallback, useEffect } from 'react'
import { FIELD_TYPES, type FieldType } from '../types'

interface SlashCommandState {
	isOpen: boolean
	query: string
	filteredTypes: { value: FieldType; label: string }[]
	selectedIndex: number
	insertAfterIndex: number | null
}

const initialState: SlashCommandState = {
	isOpen: false,
	query: '',
	filteredTypes: FIELD_TYPES,
	selectedIndex: 0,
	insertAfterIndex: null,
}

export function useSlashCommand(onSelectType: (type: FieldType, afterIndex: number | null) => void) {
	const [state, setState] = useState<SlashCommandState>(initialState)

	const open = useCallback((afterIndex: number | null) => {
		setState({
			isOpen: true,
			query: '',
			filteredTypes: FIELD_TYPES,
			selectedIndex: 0,
			insertAfterIndex: afterIndex,
		})
	}, [])

	const close = useCallback(() => {
		setState(initialState)
	}, [])

	const updateQuery = useCallback((query: string) => {
		const lower = query.toLowerCase()
		const filtered = FIELD_TYPES.filter(
			(t) =>
				t.label.toLowerCase().includes(lower) ||
				t.value.toLowerCase().includes(lower),
		)
		setState((prev) => ({
			...prev,
			query,
			filteredTypes: filtered,
			selectedIndex: 0,
		}))
	}, [])

	const selectCurrent = useCallback(() => {
		const current = state.filteredTypes[state.selectedIndex]
		if (current) {
			onSelectType(current.value, state.insertAfterIndex)
			close()
		}
	}, [state, onSelectType, close])

	const moveSelection = useCallback((direction: 1 | -1) => {
		setState((prev) => {
			const nextIndex = prev.selectedIndex + direction
			if (nextIndex < 0 || nextIndex >= prev.filteredTypes.length) return prev
			return { ...prev, selectedIndex: nextIndex }
		})
	}, [])

	// Global keyboard handler when menu is open
	useEffect(() => {
		if (!state.isOpen) return

		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault()
				close()
			} else if (e.key === 'ArrowDown') {
				e.preventDefault()
				moveSelection(1)
			} else if (e.key === 'ArrowUp') {
				e.preventDefault()
				moveSelection(-1)
			} else if (e.key === 'Enter') {
				e.preventDefault()
				selectCurrent()
			}
		}

		window.addEventListener('keydown', handler, true)
		return () => window.removeEventListener('keydown', handler, true)
	}, [state.isOpen, close, moveSelection, selectCurrent])

	return {
		...state,
		open,
		close,
		updateQuery,
		selectCurrent,
		moveSelection,
	}
}
