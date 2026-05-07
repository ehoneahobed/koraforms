import { Component, type ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
	children: ReactNode
}

interface State {
	hasError: boolean
	error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error }
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
					<div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
						<AlertCircle className="h-7 w-7 text-red-500" />
					</div>
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
						Something went wrong
					</h2>
					<p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
						An unexpected error occurred. Your data is safe — it's stored locally on your device.
					</p>
					{this.state.error && (
						<pre className="mb-6 max-w-md text-xs text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg p-3 overflow-auto max-h-24">
							{this.state.error.message}
						</pre>
					)}
					<button
						onClick={() => window.location.reload()}
						className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-smooth hover:bg-brand-500 active:scale-[0.98]"
					>
						<RefreshCw className="h-4 w-4" />
						Reload page
					</button>
				</div>
			)
		}

		return this.props.children
	}
}
