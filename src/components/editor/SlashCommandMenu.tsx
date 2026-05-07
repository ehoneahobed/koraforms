import { useEffect, useRef } from 'react'
import {
	Type, Hash, Mail, Phone, Calendar, AlignLeft, List, CircleDot,
	CheckSquare, Star, ToggleLeft, Clock, Link, SeparatorHorizontal,
	MessageSquare, PenTool,
} from 'lucide-react'
import type { FieldType } from '../../types'

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
	text: <Type className="h-3.5 w-3.5" />,
	number: <Hash className="h-3.5 w-3.5" />,
	email: <Mail className="h-3.5 w-3.5" />,
	phone: <Phone className="h-3.5 w-3.5" />,
	date: <Calendar className="h-3.5 w-3.5" />,
	textarea: <AlignLeft className="h-3.5 w-3.5" />,
	select: <List className="h-3.5 w-3.5" />,
	radio: <CircleDot className="h-3.5 w-3.5" />,
	checkbox: <CheckSquare className="h-3.5 w-3.5" />,
	rating: <Star className="h-3.5 w-3.5" />,
	scale: <Hash className="h-3.5 w-3.5" />,
	yesno: <ToggleLeft className="h-3.5 w-3.5" />,
	time: <Clock className="h-3.5 w-3.5" />,
	url: <Link className="h-3.5 w-3.5" />,
	section: <SeparatorHorizontal className="h-3.5 w-3.5" />,
	statement: <MessageSquare className="h-3.5 w-3.5" />,
	signature: <PenTool className="h-3.5 w-3.5" />,
}

interface Props {
	isOpen: boolean
	query: string
	filteredTypes: { value: FieldType; label: string }[]
	selectedIndex: number
	onQueryChange: (query: string) => void
	onSelect: () => void
	onClose: () => void
}

export function SlashCommandMenu({
	isOpen,
	query,
	filteredTypes,
	selectedIndex,
	onQueryChange,
	onSelect,
	onClose,
}: Props) {
	const inputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (isOpen) {
			inputRef.current?.focus()
		}
	}, [isOpen])

	// Scroll selected item into view
	useEffect(() => {
		if (!listRef.current) return
		const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined
		selected?.scrollIntoView({ block: 'nearest' })
	}, [selectedIndex])

	if (!isOpen) return null

	return (
		<>
			<div className="fixed inset-0 z-40" onClick={onClose} />
			<div className="absolute left-0 right-0 z-50 mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden animate-scale-in">
				{/* Search input */}
				<div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
					<div className="flex items-center gap-2">
						<span className="text-gray-400 text-sm">/</span>
						<input
							ref={inputRef}
							type="text"
							value={query}
							onChange={(e) => onQueryChange(e.target.value)}
							placeholder="Search field types..."
							className="flex-1 bg-transparent text-sm outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
						/>
					</div>
				</div>

				{/* Results */}
				<div ref={listRef} className="max-h-48 overflow-y-auto py-1">
					{filteredTypes.length === 0 ? (
						<div className="px-3 py-3 text-sm text-gray-400 text-center">
							No matching field types
						</div>
					) : (
						filteredTypes.map((type, i) => (
							<button
								key={type.value}
								onClick={() => {
									onSelect()
								}}
								onMouseEnter={() => {
									// Update selected index on hover via parent state
								}}
								className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
									i === selectedIndex
										? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
										: 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
								}`}
							>
								<span className={`w-6 h-6 rounded-md flex items-center justify-center ${
									i === selectedIndex
										? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
										: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
								}`}>
									{FIELD_ICONS[type.value]}
								</span>
								{type.label}
							</button>
						))
					)}
				</div>

				<div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 flex items-center gap-3">
					<span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">↑↓</kbd> navigate</span>
					<span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">↵</kbd> select</span>
					<span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">esc</kbd> close</span>
				</div>
			</div>
		</>
	)
}
