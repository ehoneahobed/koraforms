import { useEffect, type ReactNode } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Link2, Type } from 'lucide-react'
import { normalizeRichText, toEditorHtml } from '../../utils/richText'

type EditorVariant = 'title' | 'inline' | 'body'

interface RichTextEditorProps {
	value: string
	onChange: (html: string) => void
	placeholder?: string
	variant?: EditorVariant
	onFocus?: () => void
	className?: string
	/** Optional token labels for answer piping (inserts `{{label}}`). */
	pipeableLabels?: string[]
}

/**
 * Lightweight TipTap editor for form titles, descriptions, and question copy.
 * Stores HTML strings in existing string schema fields.
 */
export function RichTextEditor({
	value,
	onChange,
	placeholder = '',
	variant = 'body',
	onFocus,
	className = '',
	pipeableLabels = [],
}: RichTextEditorProps) {
	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit.configure({
				heading: false,
				codeBlock: false,
				code: false,
				blockquote: false,
				horizontalRule: false,
				bulletList: variant === 'body' ? {} : false,
				orderedList: variant === 'body' ? {} : false,
			}),
			Underline,
			Link.configure({
				openOnClick: false,
				autolink: true,
				HTMLAttributes: {
					rel: 'noopener noreferrer',
					target: '_blank',
				},
			}),
			Placeholder.configure({ placeholder }),
		],
		content: toEditorHtml(value),
		editorProps: {
			attributes: {
				class: editorSurfaceClass(variant),
			},
			handleKeyDown: (_view, event) => {
				if (variant !== 'body' && event.key === 'Enter') {
					event.preventDefault()
					return true
				}
				return false
			},
		},
		onUpdate: ({ editor: current }) => {
			onChange(normalizeRichText(current.getHTML()))
		},
		onFocus: () => {
			onFocus?.()
		},
	})

	// Keep external value in sync (load / undo) without fighting local typing.
	useEffect(() => {
		if (!editor) return
		const next = toEditorHtml(value)
		const current = normalizeRichText(editor.getHTML())
		if (normalizeRichText(next) === current) return
		editor.commands.setContent(next || '', { emitUpdate: false })
	}, [value, editor])

	if (!editor) return null

	const showLists = variant === 'body'

	return (
		<div className={`rounded-xl border border-slate-200 bg-white transition-colors focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/15 dark:border-gray-800 dark:bg-gray-900 ${className}`.trim()}>
			<div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 px-1.5 py-1 dark:border-gray-800">
				<ToolbarButton
					label="Bold"
					active={editor.isActive('bold')}
					onClick={() => editor.chain().focus().toggleBold().run()}
				>
					<Bold className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton
					label="Italic"
					active={editor.isActive('italic')}
					onClick={() => editor.chain().focus().toggleItalic().run()}
				>
					<Italic className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton
					label="Underline"
					active={editor.isActive('underline')}
					onClick={() => editor.chain().focus().toggleUnderline().run()}
				>
					<UnderlineIcon className="h-3.5 w-3.5" />
				</ToolbarButton>
				{showLists && (
					<>
						<ToolbarButton
							label="Bullet list"
							active={editor.isActive('bulletList')}
							onClick={() => editor.chain().focus().toggleBulletList().run()}
						>
							<List className="h-3.5 w-3.5" />
						</ToolbarButton>
						<ToolbarButton
							label="Numbered list"
							active={editor.isActive('orderedList')}
							onClick={() => editor.chain().focus().toggleOrderedList().run()}
						>
							<ListOrdered className="h-3.5 w-3.5" />
						</ToolbarButton>
					</>
				)}
				<ToolbarButton
					label="Link"
					active={editor.isActive('link')}
					onClick={() => {
						const previous = editor.getAttributes('link').href as string | undefined
						const url = window.prompt('Link URL', previous || 'https://')
						if (url === null) return
						if (!url.trim()) {
							editor.chain().focus().extendMarkRange('link').unsetLink().run()
							return
						}
						editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
					}}
				>
					<Link2 className="h-3.5 w-3.5" />
				</ToolbarButton>
				{pipeableLabels.length > 0 && (
					<details className="relative ml-1">
						<summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800">
							<Type className="h-3.5 w-3.5" />
							Answer
						</summary>
						<div className="absolute left-0 top-full z-30 mt-1 max-h-48 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-gray-800 dark:bg-gray-950">
							{pipeableLabels.slice(-8).map(label => (
								<button
									key={label}
									type="button"
									className="block w-full truncate px-3 py-1.5 text-left text-[12px] text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:text-gray-300 dark:hover:bg-brand-900/25"
									onMouseDown={(event) => event.preventDefault()}
									onClick={() => {
										editor.chain().focus().insertContent(`{{${label}}}`).run()
									}}
								>
									{label}
								</button>
							))}
						</div>
					</details>
				)}
			</div>
			<EditorContent editor={editor} />
		</div>
	)
}

function editorSurfaceClass(variant: EditorVariant): string {
	const base = 'kf-rich-editor max-w-none px-3 py-2 text-slate-900 outline-none dark:text-gray-100'
	if (variant === 'title') {
		return `${base} min-h-[2.5rem] text-[24px] font-bold leading-tight`
	}
	if (variant === 'inline') {
		return `${base} min-h-[2.25rem] text-[14px] font-semibold leading-snug`
	}
	return `${base} min-h-[4.5rem] text-[15px] leading-relaxed`
}

function ToolbarButton({
	label,
	active,
	onClick,
	children,
}: {
	label: string
	active?: boolean
	onClick: () => void
	children: ReactNode
}) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			aria-pressed={active}
			onMouseDown={(event) => event.preventDefault()}
			onClick={onClick}
			className={`rounded-md p-1.5 transition-colors ${
				active
					? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
					: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
			}`}
		>
			{children}
		</button>
	)
}
