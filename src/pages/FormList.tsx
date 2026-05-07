import { useQuery, useMutation, useCollection } from '@korajs/react'
import { Plus, FileText, ClipboardList, Trash2, Eye, LayoutTemplate } from 'lucide-react'
import { useState } from 'react'
import { FORM_TEMPLATES } from '../templates'

interface Props {
	navigate: (path: string) => void
}

export function FormList({ navigate }: Props) {
	const forms = useCollection('forms')
	const allForms = useQuery(forms.where({}).orderBy('createdAt', 'desc'))
	const { mutate: deleteForm } = useMutation((id: string) => forms.delete(id))
	const { mutate: createForm } = useMutation((data: { title: string; description: string; fields: string; status: string }) =>
		forms.insert(data),
	)

	const [showTemplates, setShowTemplates] = useState(false)

	const handleCreateFromTemplate = (key: string) => {
		const template = FORM_TEMPLATES[key]
		if (!template) return
		createForm({
			title: template.title || 'Untitled Form',
			description: template.description,
			fields: JSON.stringify(template.fields),
			status: key === 'blank' ? 'draft' : 'draft',
		}).then((form: { id: string }) => {
			navigate(`build/${form.id}`)
		})
		setShowTemplates(false)
	}

	const published = allForms.filter((f) => String(f.status) === 'published')
	const drafts = allForms.filter((f) => String(f.status) !== 'published')

	return (
		<div>
			<div className="flex items-center justify-between mb-8">
				<div>
					<h2 className="text-2xl font-bold">My Forms</h2>
					<p className="text-gray-500 mt-1">Create forms that work offline. Collect data anywhere.</p>
				</div>
				<button
					onClick={() => setShowTemplates(true)}
					className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-500"
				>
					<Plus className="h-4 w-4" />
					New Form
				</button>
			</div>

			{/* Template picker modal */}
			{showTemplates && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-6">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-semibold flex items-center gap-2">
								<LayoutTemplate className="h-5 w-5 text-indigo-400" />
								Choose a Template
							</h3>
							<button
								onClick={() => setShowTemplates(false)}
								className="text-gray-500 hover:text-gray-300"
							>
								&times;
							</button>
						</div>
						<div className="space-y-2">
							{Object.entries(FORM_TEMPLATES).map(([key, template]) => (
								<button
									key={key}
									onClick={() => handleCreateFromTemplate(key)}
									className="w-full text-left rounded-lg border border-gray-800 bg-gray-800/50 p-4 transition hover:border-indigo-500 hover:bg-gray-800"
								>
									<p className="font-medium">{key === 'blank' ? 'Blank Form' : template.title}</p>
									<p className="text-sm text-gray-500 mt-0.5">
										{key === 'blank'
											? 'Start from scratch'
											: `${template.fields.length} fields — ${template.description}`}
									</p>
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Published forms */}
			{published.length > 0 && (
				<div className="mb-8">
					<h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
						Published
					</h3>
					<div className="space-y-2">
						{published.map((form) => (
							<FormCard
								key={form.id}
								form={form}
								navigate={navigate}
								onDelete={() => deleteForm(form.id)}
							/>
						))}
					</div>
				</div>
			)}

			{/* Draft forms */}
			{drafts.length > 0 && (
				<div className="mb-8">
					<h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
						Drafts
					</h3>
					<div className="space-y-2">
						{drafts.map((form) => (
							<FormCard
								key={form.id}
								form={form}
								navigate={navigate}
								onDelete={() => deleteForm(form.id)}
							/>
						))}
					</div>
				</div>
			)}

			{allForms.length === 0 && (
				<div className="rounded-xl border border-dashed border-gray-800 py-16 text-center">
					<FileText className="h-12 w-12 text-gray-700 mx-auto mb-4" />
					<p className="text-gray-500 text-lg">No forms yet</p>
					<p className="text-gray-600 text-sm mt-1">
						Create your first form to start collecting data — even without internet.
					</p>
				</div>
			)}
		</div>
	)
}

function FormCard({
	form,
	navigate,
	onDelete,
}: {
	form: Record<string, unknown>
	navigate: (path: string) => void
	onDelete: () => void
}) {
	const isPublished = String(form.status) === 'published'
	let fieldCount = 0
	try {
		fieldCount = JSON.parse(String(form.fields || '[]')).length
	} catch {
		// ignore parse errors
	}

	return (
		<div className="group flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900 p-4 transition hover:border-gray-700">
			<div className="shrink-0">
				<ClipboardList className={`h-8 w-8 ${isPublished ? 'text-emerald-400' : 'text-gray-600'}`} />
			</div>
			<div className="flex-1 min-w-0">
				<p className="font-medium truncate">{String(form.title) || 'Untitled Form'}</p>
				<p className="text-sm text-gray-500 truncate">
					{fieldCount} field{fieldCount !== 1 ? 's' : ''}
					{form.description ? ` — ${String(form.description)}` : ''}
				</p>
			</div>
			<div className="flex items-center gap-2 shrink-0">
				{isPublished && (
					<>
						<button
							onClick={() => navigate(`fill/${form.id}`)}
							className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-sm text-emerald-400 transition hover:bg-emerald-600/30"
						>
							Fill
						</button>
						<button
							onClick={() => navigate(`responses/${form.id}`)}
							className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-400 transition hover:bg-gray-700 hover:text-gray-200"
						>
							<Eye className="h-4 w-4" />
						</button>
					</>
				)}
				<button
					onClick={() => navigate(`build/${form.id}`)}
					className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-400 transition hover:bg-gray-700 hover:text-gray-200"
				>
					Edit
				</button>
				<button
					onClick={onDelete}
					className="text-gray-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
				>
					<Trash2 className="h-4 w-4" />
				</button>
			</div>
		</div>
	)
}
