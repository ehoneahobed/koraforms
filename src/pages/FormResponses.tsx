import { useQuery, useCollection } from '@korajs/react'
import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react'
import type { FormField } from '../types'

interface Props {
	formId: string
	navigate: (path: string) => void
}

export function FormResponses({ formId, navigate }: Props) {
	const forms = useCollection('forms')
	const responsesCollection = useCollection('responses')

	const allForms = useQuery(forms.where({}).orderBy('createdAt', 'desc'))
	const allResponses = useQuery(responsesCollection.where({}).orderBy('submittedAt', 'desc'))

	const form = allForms.find((f) => f.id === formId)
	const responses = allResponses.filter((r) => String(r.formId) === formId)

	if (!form) {
		return (
			<div className="text-center py-16 text-gray-500">
				Form not found.{' '}
				<button onClick={() => navigate('')} className="text-indigo-400 hover:underline">
					Go back
				</button>
			</div>
		)
	}

	let fields: FormField[] = []
	try {
		fields = JSON.parse(String(form.fields || '[]'))
	} catch {
		// ignore
	}

	const exportCsv = () => {
		if (responses.length === 0) return

		const headers = ['#', 'Submitted At', ...fields.map((f) => f.label || f.id)]
		const rows = responses.map((r, i) => {
			let data: Record<string, string> = {}
			try {
				data = JSON.parse(String(r.data || '{}'))
			} catch {
				// ignore
			}
			const submittedAt = r.submittedAt
				? new Date(Number(r.submittedAt)).toLocaleString()
				: ''
			return [
				String(i + 1),
				submittedAt,
				...fields.map((f) => data[f.id] || ''),
			]
		})

		const csvContent = [headers, ...rows]
			.map((row) =>
				row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
			)
			.join('\n')

		const blob = new Blob([csvContent], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${String(form.title || 'form')}-responses.csv`
		a.click()
		URL.revokeObjectURL(url)
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<button
					onClick={() => navigate('')}
					className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition"
				>
					<ArrowLeft className="h-4 w-4" />
					Back
				</button>
				{responses.length > 0 && (
					<button
						onClick={exportCsv}
						className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700"
					>
						<Download className="h-4 w-4" />
						Export CSV
					</button>
				)}
			</div>

			<div className="mb-6">
				<h2 className="text-2xl font-bold">{String(form.title)}</h2>
				<p className="text-gray-500 mt-1">
					{responses.length} response{responses.length !== 1 ? 's' : ''}
				</p>
			</div>

			{responses.length === 0 ? (
				<div className="rounded-xl border border-dashed border-gray-800 py-16 text-center">
					<FileSpreadsheet className="h-12 w-12 text-gray-700 mx-auto mb-4" />
					<p className="text-gray-500 text-lg">No responses yet</p>
					<p className="text-gray-600 text-sm mt-1">
						Share the form link to start collecting responses.
					</p>
					<button
						onClick={() => navigate(`fill/${formId}`)}
						className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
					>
						Fill form yourself
					</button>
				</div>
			) : (
				<div className="space-y-3">
					{responses.map((response, index) => {
						let data: Record<string, string> = {}
						try {
							data = JSON.parse(String(response.data || '{}'))
						} catch {
							// ignore
						}
						const submittedAt = response.submittedAt
							? new Date(Number(response.submittedAt)).toLocaleString()
							: 'Unknown'

						return (
							<div
								key={response.id}
								className="rounded-xl border border-gray-800 bg-gray-900 p-4"
							>
								<div className="flex items-center justify-between mb-3">
									<span className="text-sm font-medium text-gray-400">
										Response #{responses.length - index}
									</span>
									<span className="text-xs text-gray-600">{submittedAt}</span>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{fields.map((field) => (
										<div key={field.id}>
											<p className="text-xs text-gray-500">{field.label || field.id}</p>
											<p className="text-sm text-gray-200 mt-0.5">
												{data[field.id] || (
													<span className="text-gray-600 italic">—</span>
												)}
											</p>
										</div>
									))}
								</div>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
