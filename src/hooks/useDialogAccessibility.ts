import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'textarea:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(',')

interface DialogAccessibilityOptions {
	onClose: () => void
	initialFocus?: 'dialog' | 'first-control'
}

export function useDialogAccessibility<T extends HTMLElement>({
	onClose,
	initialFocus = 'first-control',
}: DialogAccessibilityOptions) {
	const dialogRef = useRef<T | null>(null)

	useEffect(() => {
		const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
		const dialog = dialogRef.current

		const focusDialog = () => {
			if (!dialog) return
			const focusTarget = initialFocus === 'first-control'
				? dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
				: null
			;(focusTarget || dialog).focus({ preventScroll: true })
		}

		const animationFrame = window.requestAnimationFrame(focusDialog)

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault()
				onClose()
				return
			}

			if (event.key !== 'Tab' || !dialog) return

			const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
				.filter(element => !element.hasAttribute('disabled') && element.offsetParent !== null)

			if (focusableElements.length === 0) {
				event.preventDefault()
				dialog.focus({ preventScroll: true })
				return
			}

			const first = focusableElements[0]!
			const last = focusableElements[focusableElements.length - 1]!
			const active = document.activeElement

			if (event.shiftKey && active === first) {
				event.preventDefault()
				last.focus()
			} else if (!event.shiftKey && active === last) {
				event.preventDefault()
				first.focus()
			}
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => {
			window.cancelAnimationFrame(animationFrame)
			document.removeEventListener('keydown', handleKeyDown)
			if (previouslyFocused && document.contains(previouslyFocused)) {
				previouslyFocused.focus({ preventScroll: true })
			}
		}
	}, [initialFocus, onClose])

	return dialogRef
}
