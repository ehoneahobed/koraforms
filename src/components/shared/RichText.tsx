import { useMemo, type ElementType, type HTMLAttributes } from 'react'
import { isRichTextEmpty, sanitizeRichText } from '../../utils/richText'

interface RichTextProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
	/** Stored rich text (HTML) or legacy plain string. */
	html: string
	/** Element to render. Defaults to `div`. */
	as?: ElementType
}

/**
 * Renders sanitized form copy (title, description, labels, statements).
 * Accepts legacy plain strings and TipTap HTML.
 */
export function RichText({ html, as: Tag = 'div', className = '', ...rest }: RichTextProps) {
	const sanitized = useMemo(() => sanitizeRichText(html), [html])
	if (!sanitized || isRichTextEmpty(html)) return null

	return (
		<Tag
			className={`kf-rich-text ${className}`.trim()}
			dangerouslySetInnerHTML={{ __html: sanitized }}
			{...rest}
		/>
	)
}
