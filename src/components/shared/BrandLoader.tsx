/**
 * Branded full-screen loader with animated KoraForms logo.
 * Used for app initialization, auth loading, and page transitions.
 */
export function BrandLoader({ message }: { message?: string }) {
	return (
		<div className="flex items-center justify-center h-screen bg-white dark:bg-surface-dark">
			<div className="text-center">
				{/* Animated logo */}
				<div className="relative w-16 h-16 mx-auto mb-6">
					<img
						src="/logo-icon.png"
						alt="KoraForms"
						className="w-16 h-16 rounded-2xl animate-loader-pulse"
					/>
					{/* Orbiting dot */}
					<div className="absolute inset-0 animate-loader-orbit">
						<div className="w-2.5 h-2.5 rounded-full bg-brand-500 shadow-sm shadow-brand-500/50" />
					</div>
				</div>

				{message && (
					<p className="text-sm text-gray-400 dark:text-gray-500 animate-fade-in">
						{message}
					</p>
				)}
			</div>
		</div>
	)
}

/**
 * Inline loader for smaller contexts (e.g. loading a form within a page).
 */
export function InlineLoader({ message }: { message?: string }) {
	return (
		<div className="flex items-center justify-center min-h-screen">
			<div className="text-center animate-fade-in">
				<div className="relative w-12 h-12 mx-auto mb-4">
					<img
						src="/logo-icon.png"
						alt="KoraForms"
						className="w-12 h-12 rounded-xl animate-loader-pulse"
					/>
					<div className="absolute inset-0 animate-loader-orbit">
						<div className="w-2 h-2 rounded-full bg-brand-500 shadow-sm shadow-brand-500/50" />
					</div>
				</div>
				{message && (
					<p className="text-gray-400 dark:text-gray-500 text-sm">{message}</p>
				)}
			</div>
		</div>
	)
}
