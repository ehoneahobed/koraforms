import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@korajs/react'
import { app } from '../kora'
import { setPageMeta } from '../utils/meta'
import { downloadJsonFile } from '../utils/download'
import {
	GripVertical,
	Plus,
	Trash2,
	ChevronUp,
	ChevronDown,
	Type,
	Hash,
	Mail,
	Phone,
	Calendar,
	AlignLeft,
	List,
	CircleDot,
	CheckSquare,
	Star,
	ToggleLeft,
	Clock,
	Link,
	SeparatorHorizontal,
	MessageSquare,
	PenTool,
	GitBranch,
	X,
	Upload,
	Calculator,
	EyeOff,
	ArrowUpDown,
	Grid3x3,
	Download,
	Monitor,
	Smartphone,
	Search,
} from 'lucide-react'
import { FIELD_TYPES, CONDITION_OPERATORS, LANGUAGES, type FormField, type FormSettings as FormSettingsType, type FieldType, type ConditionalRule } from '../types'
import { getThemeById } from '../themes'
import { useSlashCommand } from '../hooks/useSlashCommand'
import { SlashCommandMenu } from '../components/editor/SlashCommandMenu'
import { Copy } from 'lucide-react'
import {
	getInputFields,
	getPipeableFields,
	isDisplayOnlyField,
	isPipeableField,
	parseFormFields,
	parseFormSettings,
	serializeFormFields,
	serializeFormSettings,
} from '../domain/forms'
import {
	addFieldOfType as addBuilderFieldOfType,
	buildFormExportData,
	duplicateFieldAt,
	filterFieldTypes,
	formExportFilename,
	moveFieldAt,
	parseImportedFormFile,
	removeFieldAt,
	updateFieldAt,
} from '../features/form-builder/fields'
import {
	fieldDisplayName,
	parseTokenSegments,
	serializeTokenSegments,
	stripTrailingFieldLabel,
	type TokenSegment,
} from '../features/form-builder/tokens'

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
	file: <Upload className="h-3.5 w-3.5" />,
	ranking: <ArrowUpDown className="h-3.5 w-3.5" />,
	matrix: <Grid3x3 className="h-3.5 w-3.5" />,
	calculated: <Calculator className="h-3.5 w-3.5" />,
	hidden: <EyeOff className="h-3.5 w-3.5" />,
}

const QUICK_FIELD_TYPES: FieldType[] = ['text', 'email', 'phone', 'select', 'radio', 'checkbox']

interface Props {
	formId?: string
	navigate: (path: string) => void
	userId: string
}

export function FormBuilder({ formId, navigate, userId }: Props) {
	const allForms = useQuery(app.forms.where({}).orderBy('createdAt', 'desc'))
	const form = allForms.find((f) => f.id === formId)

	const { mutate: updateForm } = useMutation(
		(id: string, data: Record<string, unknown>) => app.forms.update(id, data),
	)

	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [fields, setFields] = useState<FormField[]>([])
	const [theme, setTheme] = useState('red')
	const [settings, setSettings] = useState<FormSettingsType>({})
	const [loaded, setLoaded] = useState(false)
	const [activeField, setActiveField] = useState<string | null>(null)
	const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
	const [fieldSearch, setFieldSearch] = useState('')
	const themePreset = getThemeById(theme)
	// Share modal is now handled by FormPageShell

	useEffect(() => {
		setPageMeta({
			title: title ? `Edit: ${title}` : 'Form Builder',
			description: 'Build and customize your form with KoraForms.',
		})
	}, [title])

	// Slash command: add a field of a specific type
	const addFieldOfType = useCallback((type: FieldType, afterIndex: number | null) => {
		const result = addBuilderFieldOfType(fields, type, afterIndex)
		setFields(result.fields)
		setActiveField(result.field.id)
		slashCommand.close()
	}, [fields])

	const slashCommand = useSlashCommand(addFieldOfType)

	// Drag-and-drop state
	const [dragIndex, setDragIndex] = useState<number | null>(null)
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

	const moveField = useCallback((from: number, to: number) => {
		setFields(prev => moveFieldAt(prev, from, to))
	}, [])

	const handleDragStart = useCallback((index: number) => {
		setDragIndex(index)
	}, [])

	const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
		e.preventDefault()
		setDragOverIndex(index)
	}, [])

	const handleDrop = useCallback((index: number) => {
		if (dragIndex !== null && dragIndex !== index) {
			moveField(dragIndex, index)
		}
		setDragIndex(null)
		setDragOverIndex(null)
	}, [dragIndex, moveField])

	const handleDragEnd = useCallback(() => {
		setDragIndex(null)
		setDragOverIndex(null)
	}, [])

	useEffect(() => {
		if (form && !loaded) {
			setTitle(String(form.title || ''))
			setDescription(String(form.description || ''))
			setTheme(String(form.theme || 'red'))
			setFields(parseFormFields(form.fields))
			setSettings(parseFormSettings(form.settings))
			setLoaded(true)
		}
	}, [form, loaded])

	// Auto-save with debounce
	const save = useCallback(() => {
		if (!formId) return
		updateForm(formId, {
			title: title || 'Untitled Form',
			description,
			fields: serializeFormFields(fields),
			theme,
			settings: serializeFormSettings(settings),
			ownerId: userId,
		})
	}, [formId, title, description, fields, theme, settings, userId, updateForm])

	// Auto-save on changes (debounced)
	useEffect(() => {
		if (!loaded) return
		const timer = setTimeout(save, 1500)
		return () => clearTimeout(timer)
	}, [title, description, fields, theme, settings, loaded, save])

	// Field manipulation callbacks (must be before early returns to keep hook order stable)
	const addField = useCallback((afterIndex?: number) => {
		setFields(prev => {
			const result = addBuilderFieldOfType(prev, 'text', afterIndex)
			setActiveField(result.field.id)
			return result.fields
		})
	}, [])

	const updateField = useCallback((index: number, updates: Partial<FormField>) => {
		setFields(prev => updateFieldAt(prev, index, updates))
	}, [])

	const removeField = useCallback((index: number) => {
		setFields(prev => removeFieldAt(prev, index))
		setActiveField(null)
	}, [])

	const duplicateField = useCallback((index: number) => {
		setFields(prev => {
			const result = duplicateFieldAt(prev, index)
			if (result.field) setActiveField(result.field.id)
			return result.fields
		})
	}, [])

	// Keyboard shortcuts (must be before early returns)
	useEffect(() => {
		if (!loaded) return
		const handler = (e: KeyboardEvent) => {
			const meta = e.metaKey || e.ctrlKey
			// Ctrl+S / Cmd+S -> save immediately
			if (meta && e.key === 's') {
				e.preventDefault()
				save()
			}
			// Ctrl+D / Cmd+D -> duplicate active field
			if (meta && e.key === 'd' && activeField) {
				e.preventDefault()
				const idx = fields.findIndex(f => f.id === activeField)
				if (idx >= 0) duplicateField(idx)
			}
			// Escape -> deselect field
			if (e.key === 'Escape') {
				setActiveField(null)
			}
			// Delete/Backspace with Ctrl -> remove active field
			if (meta && (e.key === 'Backspace' || e.key === 'Delete') && activeField) {
				const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
				if (tag === 'input' || tag === 'textarea' || tag === 'select') return
				e.preventDefault()
				const idx = fields.findIndex(f => f.id === activeField)
				if (idx >= 0) removeField(idx)
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [loaded, activeField, fields, save, duplicateField, removeField])

	if (!formId || (!form && loaded)) {
		return (
			<div className="text-center py-20 text-gray-500 animate-fade-in">
				<p className="text-lg mb-2">Form not found</p>
				<button onClick={() => navigate('dashboard')} className="text-brand-500 hover:underline text-sm">
					Go back to forms
				</button>
			</div>
		)
	}

	if (!loaded) {
		return (
			<div className="space-y-4 animate-fade-in">
				<div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
				<div className="h-24 bg-gray-100 dark:bg-gray-800/50 rounded-xl animate-pulse" />
				<div className="h-20 bg-gray-100 dark:bg-gray-800/50 rounded-xl animate-pulse" />
			</div>
		)
	}

	const exportFormJson = () => {
		const data = buildFormExportData(title, description, fields, theme, settings)
		downloadJsonFile(data, formExportFilename(title))
	}

	const importFormJson = () => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = '.json,.koraform.json'
		input.onchange = (e) => {
			const file = (e.target as HTMLInputElement).files?.[0]
			if (!file) return
			const reader = new FileReader()
			reader.onload = () => {
				const data = parseImportedFormFile(String(reader.result || ''))
				if (!data) {
					alert('Failed to parse the file. Make sure it\'s a valid KoraForms JSON file.')
					return
				}
				if (data.title) setTitle(data.title)
				if (data.description) setDescription(data.description)
				if (data.fields) setFields(data.fields)
				if (data.theme) setTheme(data.theme)
				if (data.settings) setSettings(data.settings)
			}
			reader.readAsText(file)
		}
		input.click()
	}

	// Filter field types for the left panel search
	const filteredFieldTypes = filterFieldTypes(fieldSearch)

	// Get the active field data and index
	const activeFieldIndex = activeField ? fields.findIndex(f => f.id === activeField) : -1
	const activeFieldData = activeFieldIndex >= 0 ? fields[activeFieldIndex] : null

	return (
		<div className="flex h-[calc(100vh-222px)] min-h-[560px] -mx-4 sm:-mx-8 lg:-mx-10 -mb-8 sm:-mb-10 overflow-hidden border-t border-slate-200 dark:border-gray-800 bg-white/35 dark:bg-surface-dark">
			{/* Left Panel: Add fields */}
			<div className="hidden lg:flex h-full flex-col w-[260px] shrink-0 overflow-y-auto border-r border-slate-200 dark:border-gray-800/50 bg-white/70 dark:bg-gray-950/70 p-5">
				<div className="mb-5">
					<h3 className="text-[16px] font-semibold text-slate-950 dark:text-gray-100">Add field</h3>
					<p className="mt-1 text-[12px] text-slate-500 dark:text-gray-500">Pick a common field or search all types.</p>
				</div>
				<div className="relative mb-4">
					<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
					<input
						type="text"
						value={fieldSearch}
						onChange={(e) => setFieldSearch(e.target.value)}
						placeholder="Search all field types"
						className="w-full rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900 pl-10 pr-3 py-2.5 text-[14px] outline-none placeholder-slate-400 dark:placeholder-gray-500 text-slate-700 dark:text-gray-300 focus:ring-2 focus:ring-brand-500/20 transition-smooth"
					/>
				</div>
				<div className="grid grid-cols-2 gap-2">
					{QUICK_FIELD_TYPES.map((type) => {
						const ft = FIELD_TYPES.find((item) => item.value === type)
						if (!ft) return null
						return (
							<button
								key={ft.value}
								onClick={() => addFieldOfType(ft.value, fields.length > 0 ? fields.length - 1 : null)}
								className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left text-[13px] font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50/40 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-brand-900/10"
							>
								<span className="text-slate-400 dark:text-gray-500">{FIELD_ICONS[ft.value]}</span>
								<span>{ft.label}</span>
							</button>
						)
					})}
				</div>
				<div className="mt-5 flex min-h-[260px] flex-col border-t border-slate-200 dark:border-gray-800 pt-4">
					<p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
						{fieldSearch.trim() ? 'Search results' : 'More fields'}
					</p>
					<div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
					{filteredFieldTypes
						.filter(ft => fieldSearch.trim() || !QUICK_FIELD_TYPES.includes(ft.value))
						.map((ft) => (
						<button
							key={ft.value}
							onClick={() => addFieldOfType(ft.value, fields.length > 0 ? fields.length - 1 : null)}
							className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
						>
							<span className="text-slate-400 dark:text-gray-500">{FIELD_ICONS[ft.value]}</span>
							{ft.label}
						</button>
					))}
					{filteredFieldTypes.length === 0 && (
						<p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No matching fields</p>
					)}
					</div>
				</div>
				<div className="mt-4 border-t border-slate-200 pt-4 dark:border-gray-800">
					<p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Canvas</p>
					<div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
						<button
							onClick={() => setPreviewMode('desktop')}
							className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors ${
								previewMode === 'desktop'
									? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300'
									: 'text-slate-500 hover:bg-slate-50 dark:text-gray-500 dark:hover:bg-gray-800'
							}`}
						>
							<Monitor className="h-3.5 w-3.5" />
							Desktop
						</button>
						<button
							onClick={() => setPreviewMode('mobile')}
							className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors ${
								previewMode === 'mobile'
									? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300'
									: 'text-slate-500 hover:bg-slate-50 dark:text-gray-500 dark:hover:bg-gray-800'
							}`}
						>
							<Smartphone className="h-3.5 w-3.5" />
							Mobile
						</button>
					</div>
					<div className="mt-2 grid grid-cols-2 gap-2">
						<button onClick={exportFormJson} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800" title="Export form as JSON">
							<Download className="h-3.5 w-3.5" />
							Export
						</button>
						<button onClick={importFormJson} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800" title="Import form from JSON">
							<Upload className="h-3.5 w-3.5" />
							Import
						</button>
					</div>
					<div className="mt-3 space-y-1.5 text-[11px] text-slate-400 dark:text-gray-600">
						<div><kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-500 dark:bg-gray-800 dark:text-gray-400">Ctrl+S</kbd> save</div>
						<div><kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-500 dark:bg-gray-800 dark:text-gray-400">Ctrl+D</kbd> duplicate</div>
						<div><kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-500 dark:bg-gray-800 dark:text-gray-400">/</kbd> insert field or answer</div>
					</div>
				</div>
			</div>

			{/* Center Panel: Form preview */}
			<div className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
				{/* Form preview card */}
				<div className={`mx-auto ${previewMode === 'desktop' ? 'max-w-[640px]' : 'max-w-sm'} transition-all duration-300`}>
					{/* Form header */}
					<div
						className="kf-panel p-7 mb-4 overflow-hidden border-t-[3px]"
						style={{
							borderTopColor: themePreset.preview,
							backgroundImage: `linear-gradient(180deg, ${themePreset.colors[50]} 0%, rgba(255,255,255,0) 56px)`,
						}}
					>
						<input
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Untitled Form"
							className="w-full bg-transparent text-[24px] font-bold outline-none placeholder-gray-300 dark:placeholder-gray-600 text-slate-950 dark:text-gray-100 mb-2"
						/>
						<input
							type="text"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Add a description..."
							className="w-full bg-transparent text-slate-500 dark:text-gray-400 outline-none placeholder-gray-300 dark:placeholder-gray-700 text-[15px]"
						/>
					</div>

					{/* Field preview cards */}
					<div className="space-y-2">
						{fields.map((field, index) => (
							<FieldPreviewCard
								key={field.id}
								field={field}
								index={index}
								isActive={activeField === field.id}
								isDragging={dragIndex === index}
								isDragOver={dragOverIndex === index && dragIndex !== index}
								onFocus={() => setActiveField(field.id)}
								onDragStart={() => handleDragStart(index)}
								onDragOver={(e) => handleDragOver(e, index)}
								onDrop={() => handleDrop(index)}
								onDragEnd={handleDragEnd}
								onUpdate={(updates) => updateField(index, updates)}
								pipeableFields={fields.slice(0, index).filter(isPipeableField)}
								allFields={fields}
							/>
						))}
					</div>

					{/* Add field -- click or type / for slash command */}
					<div className="relative mt-3">
						<button
							onClick={() => slashCommand.open(fields.length - 1)}
							className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/50 py-3.5 text-[14px] font-semibold text-slate-500 transition-colors hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-600 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-500 dark:hover:border-brand-700"
							title="Choose field type (or press /)"
						>
							<Plus className="h-4 w-4" />
							Add field
						</button>
						<SlashCommandMenu
							isOpen={slashCommand.isOpen}
							query={slashCommand.query}
							filteredTypes={slashCommand.filteredTypes}
							selectedIndex={slashCommand.selectedIndex}
							onQueryChange={slashCommand.updateQuery}
							onSelect={slashCommand.selectCurrent}
							onClose={slashCommand.close}
						/>
					</div>

					{/* Mobile-only: add field type list inline (since left panel is hidden) */}
					<div className="lg:hidden mt-3">
						<details className="group">
							<summary className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300 transition-smooth">
								<Plus className="h-3 w-3" />
								Browse field types
							</summary>
							<div className="mt-2 grid grid-cols-2 gap-1.5">
								{FIELD_TYPES.map((ft) => (
									<button
										key={ft.value}
										onClick={() => addFieldOfType(ft.value, fields.length > 0 ? fields.length - 1 : null)}
										className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth"
									>
										<span className="text-gray-400 dark:text-gray-500">{FIELD_ICONS[ft.value]}</span>
										{ft.label}
									</button>
								))}
							</div>
						</details>
					</div>

					{fields.length === 0 && (
						<p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-6">
							Click "Add field" or press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono">/</kbd> to choose a field type.
							<br />
							<span className="text-xs text-gray-300 dark:text-gray-600">
								Fields auto-save as you edit.
							</span>
						</p>
					)}

					{/* Bottom spacer */}
					<div className="h-20" />
				</div>
			</div>

			{/* Right Panel: Field settings */}
			<div className="hidden lg:flex h-full flex-col w-[320px] shrink-0 border-l border-slate-200 dark:border-gray-800/50 bg-white/70 dark:bg-gray-950/70 overflow-y-auto">
				<div className="px-5 py-5">
					<h3 className="text-[16px] font-semibold text-slate-950 dark:text-gray-100">Field settings</h3>
					<p className="mt-1 text-[12px] text-slate-500 dark:text-gray-500">Edit the selected question.</p>
				</div>
				{activeFieldData && activeFieldIndex >= 0 ? (
					<FieldSettingsPanel
						field={activeFieldData}
						index={activeFieldIndex}
						total={fields.length}
						allFields={fields}
						languages={settings.languages}
						onUpdate={(updates) => updateField(activeFieldIndex, updates)}
						onRemove={() => removeField(activeFieldIndex)}
						onDuplicate={() => duplicateField(activeFieldIndex)}
						onMove={(dir) => moveField(activeFieldIndex, activeFieldIndex + dir)}
						onAddAfter={() => addField(activeFieldIndex)}
					/>
				) : (
					<div className="flex-1 flex items-center justify-center px-6">
						<p className="text-sm text-gray-400 dark:text-gray-500 text-center">
							Select a field to edit its settings
						</p>
					</div>
				)}
			</div>
		</div>
	)
}

/* ============================================================
   FieldPreviewCard -- simplified field card for center panel
   ============================================================ */

function LabelTokenEditor({
	value,
	onChange,
	placeholder,
	pipeableFields,
	allFields,
	onFocus,
	variant = 'panel',
}: {
	value: string
	onChange: (value: string) => void
	placeholder: string
	pipeableFields: FormField[]
	allFields: FormField[]
	onFocus?: () => void
	variant?: 'inline' | 'panel'
}) {
	const [menuIndex, setMenuIndex] = useState<number | null>(null)
	const segments = parseTokenSegments(value)

	const commit = (next: TokenSegment[]) => onChange(serializeTokenSegments(next))

	const updateText = (index: number, nextValue: string) => {
		const slashIndex = nextValue.lastIndexOf('/')
		const next = [...segments]
		next[index] = { type: 'text', value: slashIndex >= 0 ? nextValue.slice(0, slashIndex) : nextValue }
		commit(next)
		setMenuIndex(slashIndex >= 0 && pipeableFields.length > 0 ? index : null)
	}

	const insertToken = (index: number, sourceField: FormField) => {
		const name = fieldDisplayName(sourceField, allFields)
		const next = [...segments]
		const current = next[index]
		if (current?.type === 'text') {
			next[index] = { type: 'text', value: stripTrailingFieldLabel(current.value, name) }
		}
		next.splice(index + 1, 0, { type: 'token', value: name }, { type: 'text', value: '' })
		commit(next)
		setMenuIndex(null)
	}

	const removeToken = (index: number) => {
		const next = segments.filter((_, segmentIndex) => segmentIndex !== index)
		commit(next.length > 0 ? next : [{ type: 'text', value: '' }])
	}

	const shellClass = variant === 'inline'
		? 'flex min-w-0 flex-1 flex-wrap items-center gap-1'
		: 'relative flex min-h-[48px] w-full flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 transition-colors focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/15 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100'

	const inputClass = variant === 'inline'
		? 'min-w-[42px] flex-1 bg-transparent text-[14px] font-semibold text-slate-900 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600'
		: 'min-w-[70px] flex-1 bg-transparent text-[14px] outline-none placeholder:text-slate-300 dark:placeholder:text-gray-600'

	return (
		<div className={shellClass}>
			{segments.map((segment, index) => (
				segment.type === 'token' ? (
					<span key={`${index}-${segment.value}`} className="inline-flex max-w-full items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[12px] font-semibold text-brand-700 ring-1 ring-brand-200 dark:bg-brand-900/30 dark:text-brand-200 dark:ring-brand-800/60">
						<span className="text-[10px] font-bold opacity-60">fx</span>
						<span className="max-w-[160px] truncate">{segment.value}</span>
						<button
							type="button"
							onClick={(event) => {
								event.stopPropagation()
								removeToken(index)
							}}
							className="rounded-sm text-brand-500 hover:bg-brand-100 hover:text-brand-800 dark:text-brand-300 dark:hover:bg-brand-800"
							aria-label={`Remove ${segment.value} reference`}
						>
							<X className="h-3 w-3" />
						</button>
					</span>
				) : (
					<div key={index} className="relative flex min-w-[44px] flex-1 items-center">
						<input
							type="text"
							value={segment.value}
							onChange={(event) => updateText(index, event.target.value)}
							onFocus={onFocus}
							placeholder={value ? '' : placeholder}
							className={inputClass}
						/>
						{menuIndex === index && (
							<div className="absolute left-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 dark:border-gray-800 dark:bg-gray-950 dark:shadow-black/40">
								<div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-gray-800 dark:text-gray-500">Insert answer</div>
								{pipeableFields.slice(-6).map(sourceField => (
									<button
										key={sourceField.id}
										type="button"
										onMouseDown={(event) => event.preventDefault()}
										onClick={() => insertToken(index, sourceField)}
										className="block w-full truncate px-3 py-2 text-left text-[13px] font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:text-gray-300 dark:hover:bg-brand-900/25 dark:hover:text-brand-300"
									>
										{fieldDisplayName(sourceField, allFields)}
									</button>
								))}
							</div>
						)}
					</div>
				)
			))}
			{pipeableFields.length > 0 && variant === 'panel' && (
				<span className="text-[11px] text-slate-400 dark:text-gray-500">Type / to insert an answer</span>
			)}
		</div>
	)
}

function FieldPreviewCard({
	field,
	index,
	isActive,
	isDragging,
	isDragOver,
	onFocus,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd,
	onUpdate,
	pipeableFields,
	allFields,
}: {
	field: FormField
	index: number
	isActive: boolean
	isDragging?: boolean
	isDragOver?: boolean
	onFocus: () => void
	onDragStart?: () => void
	onDragOver?: (e: React.DragEvent) => void
	onDrop?: () => void
	onDragEnd?: () => void
	onUpdate: (updates: Partial<FormField>) => void
	pipeableFields: FormField[]
	allFields: FormField[]
}) {
	const needsOptions = ['select', 'radio', 'checkbox', 'ranking'].includes(field.type)
	const isMatrix = field.type === 'matrix'
	const needsScaleLabels = field.type === 'scale'
	const isRating = field.type === 'rating'
	const hasConditions = field.conditions && field.conditions.length > 0

	if (field.type === 'section') {
		return (
			<div
				onClick={onFocus}
				draggable
				onDragStart={(e) => {
					e.dataTransfer.effectAllowed = 'move'
					onDragStart?.()
				}}
				onDragOver={(e) => onDragOver?.(e)}
				onDrop={() => onDrop?.()}
				onDragEnd={() => onDragEnd?.()}
				className={`group rounded-2xl border bg-white px-5 py-4 transition-colors dark:bg-surface-elevated-dark ${
					isActive
						? 'border-brand-300 ring-2 ring-brand-500/10 dark:border-brand-700'
						: 'border-slate-200 hover:bg-slate-50/70 dark:border-gray-800 dark:hover:bg-gray-800/30'
				}`}
			>
				<div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
					<div className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-smooth cursor-grab active:cursor-grabbing">
						<GripVertical className="h-4 w-4" />
					</div>
					{FIELD_ICONS[field.type]}
					<span>{index + 1}. Section</span>
				</div>
					<div className="flex items-center gap-4">
						<div className="h-px flex-1 bg-slate-200 dark:bg-gray-800" />
					<div className="min-w-0 flex-[2]">
						<LabelTokenEditor
							value={field.label}
							onChange={(label) => onUpdate({ label })}
							placeholder="Section title"
							pipeableFields={pipeableFields}
							allFields={allFields}
							onFocus={onFocus}
							variant="inline"
						/>
					</div>
						<div className="h-px flex-1 bg-slate-200 dark:bg-gray-800" />
					</div>
				<input
					type="text"
					value={field.placeholder || ''}
					onChange={(e) => onUpdate({ placeholder: e.target.value })}
					onFocus={onFocus}
					placeholder="Optional section description"
					className="mt-2 w-full bg-transparent text-center text-[13px] text-slate-500 outline-none placeholder:text-slate-300 dark:text-gray-400 dark:placeholder:text-gray-700"
				/>
			</div>
		)
	}

	return (
		<div
			onClick={onFocus}
			draggable
			onDragStart={(e) => {
				e.dataTransfer.effectAllowed = 'move'
				onDragStart?.()
			}}
			onDragOver={(e) => onDragOver?.(e)}
			onDrop={() => onDrop?.()}
			onDragEnd={() => onDragEnd?.()}
			className={`group rounded-2xl p-4 transition-colors cursor-pointer ${
				isDragging
					? 'opacity-40 border border-brand-200 dark:border-brand-700 bg-white dark:bg-surface-elevated-dark'
					: isDragOver
						? 'border border-brand-300 dark:border-brand-600 bg-white shadow-sm dark:bg-surface-elevated-dark'
						: isActive
							? 'border border-brand-300 bg-white ring-2 ring-brand-500/10 dark:border-brand-700 dark:bg-surface-elevated-dark'
							: 'border border-slate-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark hover:bg-slate-50/70 dark:hover:bg-gray-800/30'
			}`}
		>
			<div className="flex items-start gap-3">
				{/* Drag handle */}
				<div className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-smooth cursor-grab active:cursor-grabbing pt-0.5">
					<GripVertical className="h-4 w-4 text-gray-400" />
				</div>

				<div className="flex-1 min-w-0">
					{/* Type icon + field number + label */}
					<div className="flex items-center gap-2 mb-1">
						<span className="text-gray-400 dark:text-gray-500">{FIELD_ICONS[field.type]}</span>
						<span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{index + 1}.</span>
						<LabelTokenEditor
							value={field.label}
							onChange={(label) => onUpdate({ label })}
							placeholder="Untitled"
							pipeableFields={pipeableFields}
							allFields={allFields}
							onFocus={onFocus}
							variant="inline"
						/>
						{field.required && (
							<span className="text-xs text-amber-500 font-medium">*</span>
						)}
						{hasConditions && (
							<GitBranch className="h-3 w-3 text-amber-500" />
						)}
					</div>

					{/* Simplified preview of field content */}
					<div className="ml-6">
						{/* Text/email/phone/url/number/date/time -- show a gray line */}
						{['text', 'email', 'phone', 'url', 'number', 'date', 'time'].includes(field.type) && (
							<div className="h-8 rounded-lg bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700/50 flex items-center px-3">
								<input
									type="text"
									value={field.placeholder || ''}
									onChange={(e) => onUpdate({ placeholder: e.target.value })}
									onFocus={onFocus}
									placeholder={FIELD_TYPES.find(ft => ft.value === field.type)?.label || 'Type here...'}
									className="w-full bg-transparent text-xs text-slate-400 outline-none placeholder:text-gray-300 dark:text-gray-500 dark:placeholder:text-gray-600"
								/>
							</div>
						)}

						{/* Textarea -- taller gray box */}
						{field.type === 'textarea' && (
							<div className="h-14 rounded-lg bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700/50 flex items-start px-3 pt-2">
								<input
									type="text"
									value={field.placeholder || ''}
									onChange={(e) => onUpdate({ placeholder: e.target.value })}
									onFocus={onFocus}
									placeholder="Type your answer..."
									className="w-full bg-transparent text-xs text-slate-400 outline-none placeholder:text-gray-300 dark:text-gray-500 dark:placeholder:text-gray-600"
								/>
							</div>
						)}

						{/* Options preview for select/radio/checkbox/ranking */}
						{needsOptions && field.options && (
							<div className="flex flex-wrap gap-1.5">
								{field.options.split(',').map((o) => o.trim()).filter(Boolean).slice(0, 5).map((opt) => (
									<span
										key={opt}
										className="inline-block rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400"
									>
										{field.type === 'radio' && <span className="mr-1 text-gray-300">&bull;</span>}
										{field.type === 'checkbox' && <span className="mr-1 text-gray-300">&#9744;</span>}
										{opt}
									</span>
								))}
								{field.options.split(',').filter(Boolean).length > 5 && (
									<span className="text-xs text-gray-400">+{field.options.split(',').filter(Boolean).length - 5} more</span>
								)}
							</div>
						)}

						{/* Rating -- stars */}
						{isRating && (
							<div className="flex gap-1">
								{[1, 2, 3, 4, 5].map(i => (
									<Star key={i} className="h-4 w-4 text-gray-300 dark:text-gray-600" />
								))}
							</div>
						)}

						{/* Scale labels preview */}
						{needsScaleLabels && (
							<div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
								<span>1-10</span>
								{field.options && (
									<>
										<span className="text-gray-300 dark:text-gray-600">|</span>
										<span className="truncate">{field.options}</span>
									</>
								)}
							</div>
						)}

						{/* Yes/No */}
						{field.type === 'yesno' && (
							<div className="flex gap-2">
								<span className="rounded-md bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs text-gray-500 dark:text-gray-400">Yes</span>
								<span className="rounded-md bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs text-gray-500 dark:text-gray-400">No</span>
							</div>
						)}

						{/* Matrix preview */}
						{isMatrix && (field.matrixRows || field.matrixColumns) && (
							<div className="text-xs text-gray-400 dark:text-gray-500">
								{(field.matrixRows || '').split(',').filter(Boolean).length} rows &times; {(field.matrixColumns || '').split(',').filter(Boolean).length} columns
							</div>
						)}

						{/* Signature */}
						{field.type === 'signature' && (
							<div className="h-10 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
								<span className="text-xs text-gray-300 dark:text-gray-600">Signature pad</span>
							</div>
						)}

						{/* File upload */}
						{field.type === 'file' && (
							<div className="h-10 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center gap-1.5">
								<Upload className="h-3 w-3 text-gray-300 dark:text-gray-600" />
								<span className="text-xs text-gray-300 dark:text-gray-600">Upload file</span>
							</div>
						)}

						{/* Statement */}
						{field.type === 'statement' && (
							<input
								type="text"
								value={field.placeholder || ''}
								onChange={(e) => onUpdate({ placeholder: e.target.value })}
								onFocus={onFocus}
								placeholder="Display text"
								className="w-full bg-transparent text-xs italic text-slate-400 outline-none placeholder:text-gray-300 dark:text-gray-500"
							/>
						)}

						{/* Calculated */}
						{field.type === 'calculated' && (
							<div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
								<Calculator className="h-3 w-3" />
								{field.formula ? <span className="font-mono text-[11px] truncate">{field.formula}</span> : 'No formula set'}
							</div>
						)}

						{/* Hidden */}
						{field.type === 'hidden' && (
							<div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
								<EyeOff className="h-3 w-3" />
								Hidden from respondents
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

/* ============================================================
   FieldSettingsPanel -- full settings in the right panel
   ============================================================ */

function FieldSettingsPanel({
	field,
	index,
	total,
	allFields,
	languages,
	onUpdate,
	onRemove,
	onDuplicate,
	onMove,
	onAddAfter,
}: {
	field: FormField
	index: number
	total: number
	allFields: FormField[]
	languages?: string[]
	onUpdate: (updates: Partial<FormField>) => void
	onRemove: () => void
	onDuplicate: () => void
	onMove: (direction: number) => void
	onAddAfter: () => void
}) {
	const needsOptions = ['select', 'radio', 'checkbox', 'ranking'].includes(field.type)
	const isMatrix = field.type === 'matrix'
	const needsScaleLabels = field.type === 'scale'
	const isDisplayOnly = isDisplayOnlyField(field) || field.type === 'calculated'
	const isSignature = field.type === 'signature'
	const isFileUpload = field.type === 'file'
	const isCalculated = field.type === 'calculated'
	const isHidden = field.type === 'hidden'
	const [showConditions, setShowConditions] = useState(false)

	// Reset conditions panel when active field changes
	useEffect(() => {
		setShowConditions(false)
	}, [field.id])

	// Fields available as condition sources (only fields ABOVE the current one)
	const availableFields = getInputFields(allFields.slice(0, index))
	const pipeableFields = getPipeableFields(allFields.slice(0, index))
	const hasConditions = field.conditions && field.conditions.length > 0

	const addCondition = () => {
		const firstField = availableFields[0]
		if (!firstField) return
		const newConditions: ConditionalRule[] = [
			...(field.conditions || []),
			{ fieldId: firstField.id, operator: 'equals', value: '' },
		]
		onUpdate({ conditions: newConditions })
	}

	const updateCondition = (ci: number, updates: Partial<ConditionalRule>) => {
		const next = [...(field.conditions || [])]
		next[ci] = { ...next[ci]!, ...updates }
		onUpdate({ conditions: next })
	}

	const removeCondition = (ci: number) => {
		const next = (field.conditions || []).filter((_, i) => i !== ci)
		onUpdate({ conditions: next.length > 0 ? next : undefined })
		if (next.length === 0) setShowConditions(false)
	}

	const insertFormulaToken = (sourceField: FormField) => {
		const token = `{${sourceField.label || `Question ${allFields.findIndex(f => f.id === sourceField.id) + 1}`}}`
		const separator = field.formula && !/[+\-*/(,\s]$/.test(field.formula) ? ' + ' : ''
		onUpdate({ formula: `${field.formula || ''}${separator}${token}` })
	}

	return (
		<div className="px-5 pb-5 space-y-5 text-sm">
			{/* Field type selector */}
			<div>
				<label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1.5 block">
					Type
				</label>
				<div className="relative">
					<span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500">
						{FIELD_ICONS[field.type]}
					</span>
					<select
						value={field.type}
						onChange={(e) => onUpdate({ type: e.target.value as FieldType })}
						className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-9 text-[14px] font-semibold text-slate-800 outline-none transition-colors focus:border-brand-300 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
					>
						{FIELD_TYPES.map((ft) => (
							<option key={ft.value} value={ft.value}>{ft.label}</option>
						))}
					</select>
					<ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
				</div>
			</div>

			{/* Label input */}
			<div>
				<label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1.5 block">
					Label
				</label>
				<LabelTokenEditor
					value={field.label}
					onChange={(label) => onUpdate({ label })}
					placeholder={`Question ${index + 1}`}
					pipeableFields={pipeableFields}
					allFields={allFields}
				/>
			</div>

			{/* Options input */}
			{needsOptions && (
				<div>
					<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
						Options
					</label>
					<input
						type="text"
						value={field.options || ''}
						onChange={(e) => onUpdate({ options: e.target.value })}
						placeholder="Comma-separated: Yes, No, Maybe"
					className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[14px] outline-none transition-colors focus:border-brand-300 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-800 dark:bg-gray-900"
					/>
				</div>
			)}

			{/* Section description */}
			{field.type === 'section' && (
				<div>
					<label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1.5 block">
						Description
					</label>
					<textarea
						value={field.placeholder || ''}
						onChange={(e) => onUpdate({ placeholder: e.target.value })}
						placeholder="Optional text shown before the next group of questions"
						rows={3}
						className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[14px] text-slate-900 outline-none transition-colors placeholder-slate-300 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-600"
					/>
				</div>
			)}

			{/* Scale labels input */}
			{needsScaleLabels && (
				<div>
					<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
						Scale labels
					</label>
					<input
						type="text"
						value={field.options || ''}
						onChange={(e) => onUpdate({ options: e.target.value })}
						placeholder="Labels: Not likely, Very likely"
						className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth"
					/>
				</div>
			)}

			{/* Matrix configuration */}
			{isMatrix && (
				<div className="space-y-2">
					<label className="text-xs font-medium text-gray-500 dark:text-gray-400 block">
						Matrix rows
					</label>
					<input
						type="text"
						value={field.matrixRows || ''}
						onChange={(e) => onUpdate({ matrixRows: e.target.value })}
						placeholder="Rows: Quality, Service, Price"
						className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth"
					/>
					<label className="text-xs font-medium text-gray-500 dark:text-gray-400 block">
						Matrix columns
					</label>
					<input
						type="text"
						value={field.matrixColumns || ''}
						onChange={(e) => onUpdate({ matrixColumns: e.target.value })}
						placeholder="Columns: Poor, Fair, Good, Excellent"
						className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth"
					/>
					<p className="text-[10px] text-gray-400 dark:text-gray-500">
						Creates a grid where respondents select one column per row.
					</p>
				</div>
			)}

			{/* Signature note */}
			{isSignature && (
				<p className="text-xs text-gray-400 dark:text-gray-500">
					Respondent will draw their signature
				</p>
			)}

			{/* File upload config */}
			{isFileUpload && (
				<div className="space-y-2">
					<label className="text-xs font-medium text-gray-500 dark:text-gray-400 block">
						Accepted file types
					</label>
					<input
						type="text"
						value={field.accept || ''}
						onChange={(e) => onUpdate({ accept: e.target.value })}
						placeholder="e.g. image/*, .pdf, .doc"
						className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth"
					/>
					<div className="flex items-center gap-3">
						<label className="text-xs text-gray-500 dark:text-gray-400">
							Max size: {field.maxSize || 10}MB
						</label>
						<input
							type="range"
							min={1}
							max={25}
							value={field.maxSize || 10}
							onChange={(e) => onUpdate({ maxSize: parseInt(e.target.value) })}
							className="flex-1 h-1.5 accent-brand-500"
						/>
					</div>
					<div className="flex gap-2">
						{([
							{ value: undefined, label: 'Any camera' },
							{ value: 'user', label: 'Front camera' },
							{ value: 'environment', label: 'Back camera' },
						] as const).map(opt => (
							<button
								key={opt.label}
								onClick={() => onUpdate({ capture: opt.value as 'user' | 'environment' | undefined })}
								className={`text-[11px] px-2 py-1 rounded-md transition-smooth ${
									field.capture === opt.value
										? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
										: 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
								}`}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Calculated field formula */}
			{isCalculated && (
				<div className="space-y-2">
					<label className="text-xs font-medium text-gray-500 dark:text-gray-400 block">
						Formula
					</label>
					<input
						type="text"
						value={field.formula || ''}
						onChange={(e) => onUpdate({ formula: e.target.value })}
						placeholder="{Number of guests} * 25"
						className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm font-mono outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth"
					/>
					{pipeableFields.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{pipeableFields.slice(-5).map((sourceField) => (
								<button
									key={sourceField.id}
									onClick={() => insertFormulaToken(sourceField)}
									className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:bg-gray-800 dark:text-gray-300"
								>
									{sourceField.label || `Question ${allFields.findIndex(f => f.id === sourceField.id) + 1}`}
								</button>
							))}
						</div>
					)}
					<p className="text-[10px] text-gray-400 dark:text-gray-500">
						Supports +, -, *, /, SUM(), AVG(), IF(), CONCAT().
					</p>
				</div>
			)}

			{/* Hidden field default value */}
			{isHidden && (
				<div className="space-y-2">
					<label className="text-xs font-medium text-gray-500 dark:text-gray-400 block">
						Default value
					</label>
					<input
						type="text"
						value={field.defaultValue || ''}
						onChange={(e) => onUpdate({ defaultValue: e.target.value })}
						placeholder="Default value or formula"
						className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth"
					/>
					<p className="text-[10px] text-gray-400 dark:text-gray-500">
						Hidden from respondents. Value saved with each response.
					</p>
				</div>
			)}

			{/* Divider */}
			<div className="border-t border-gray-100 dark:border-gray-800" />

			{/* Required toggle */}
			{!isDisplayOnly ? (
				<label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
					<input
						type="checkbox"
						checked={field.required}
						onChange={(e) => onUpdate({ required: e.target.checked })}
						className="rounded border-gray-300"
					/>
					Required
				</label>
			) : (
				<span className="text-xs text-gray-400 dark:text-gray-500 italic">Display only</span>
			)}

			{/* Placeholder input */}
			{!isDisplayOnly && field.type !== 'rating' && field.type !== 'yesno' && field.type !== 'signature' && field.type !== 'file' && (
				<div>
					<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
						Placeholder
					</label>
					<input
						type="text"
						value={field.placeholder || ''}
						onChange={(e) => onUpdate({ placeholder: e.target.value })}
						placeholder="Placeholder text..."
						className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth"
					/>
				</div>
			)}

			{/* Divider */}
			<div className="border-t border-gray-100 dark:border-gray-800" />

			{/* Conditional logic */}
			{availableFields.length > 0 && (
				<div>
					<button
						onClick={() => {
							if (!showConditions && !hasConditions) {
								addCondition()
							}
							setShowConditions(!showConditions)
						}}
						className={`flex items-center gap-1.5 text-xs font-medium transition-smooth ${
							hasConditions
								? 'text-amber-600 dark:text-amber-400'
								: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
						}`}
					>
						<GitBranch className="h-3.5 w-3.5" />
						{hasConditions ? `Conditional (${field.conditions!.length} rule${field.conditions!.length > 1 ? 's' : ''})` : 'Add conditional logic'}
					</button>

					{(showConditions || hasConditions) && (
						<div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-3 space-y-2 animate-fade-in">
							<div className="flex items-center justify-between">
								<span className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
									<GitBranch className="h-3 w-3" />
									Show this field when...
								</span>
								{field.conditions && field.conditions.length > 1 && (
									<button
										onClick={() => onUpdate({ conditionLogic: field.conditionLogic === 'or' ? 'and' : 'or' })}
										className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-200/60 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-smooth"
									>
										{field.conditionLogic === 'or' ? 'ANY' : 'ALL'}
									</button>
								)}
							</div>
							{(field.conditions || []).map((cond, ci) => (
								<div key={ci} className="flex items-center gap-1.5 flex-wrap">
									<select
										value={cond.fieldId}
										onChange={(e) => updateCondition(ci, { fieldId: e.target.value })}
										className="rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 px-2 py-1 text-xs outline-none max-w-[110px] truncate"
									>
										{availableFields.map(f => (
											<option key={f.id} value={f.id}>{f.label || f.id}</option>
										))}
									</select>
									<select
										value={cond.operator}
										onChange={(e) => updateCondition(ci, { operator: e.target.value as ConditionalRule['operator'] })}
										className="rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 px-2 py-1 text-xs outline-none"
									>
										{CONDITION_OPERATORS.map(op => (
											<option key={op.value} value={op.value}>{op.label}</option>
										))}
									</select>
									{!['is_empty', 'is_not_empty'].includes(cond.operator) && (
										<input
											type="text"
											value={cond.value}
											onChange={(e) => updateCondition(ci, { value: e.target.value })}
											placeholder="value"
											className="flex-1 min-w-[60px] rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 px-2 py-1 text-xs outline-none"
										/>
									)}
									<button
										onClick={() => removeCondition(ci)}
										className="p-0.5 text-amber-400 hover:text-red-500 transition-smooth"
									>
										<X className="h-3 w-3" />
									</button>
								</div>
							))}
							<button
								onClick={addCondition}
								className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium"
							>
								+ Add condition
							</button>
						</div>
					)}
				</div>
			)}

			{/* Translation inputs */}
			{languages && languages.length > 1 && (
				<div className="space-y-2">
					<span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
						Translations
					</span>
					{languages.filter(l => l !== (languages[0])).map(lang => {
						const langInfo = LANGUAGES.find(l => l.code === lang)
						const trans = field.translations?.[lang] || {}
						return (
							<div key={lang} className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-2 space-y-1.5">
								<span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
									{langInfo?.name || lang}
								</span>
								<input
									type="text"
									value={trans.label || ''}
									onChange={(e) => {
										const translations = { ...(field.translations || {}), [lang]: { ...trans, label: e.target.value } }
										onUpdate({ translations })
									}}
									placeholder={`Label in ${langInfo?.name || lang}`}
									className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs outline-none focus:border-brand-400 transition-smooth"
								/>
								{needsOptions && (
									<input
										type="text"
										value={trans.options || ''}
										onChange={(e) => {
											const translations = { ...(field.translations || {}), [lang]: { ...trans, options: e.target.value } }
											onUpdate({ translations })
										}}
										placeholder="Options (comma-separated)"
										className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs outline-none focus:border-brand-400 transition-smooth"
									/>
								)}
							</div>
						)
					})}
				</div>
			)}

			{/* Divider */}
			<div className="border-t border-gray-100 dark:border-gray-800" />

			{/* Move / Add / Duplicate / Delete actions */}
			<div className="space-y-2">
				{/* Reorder buttons */}
				<div className="flex items-center gap-2">
					<button
						onClick={() => onMove(-1)}
						disabled={index === 0}
						className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-smooth"
					>
						<ChevronUp className="h-3 w-3" />
						Move up
					</button>
					<button
						onClick={() => onMove(1)}
						disabled={index === total - 1}
						className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-smooth"
					>
						<ChevronDown className="h-3 w-3" />
						Move down
					</button>
				</div>

				{/* Add after, Duplicate */}
				<div className="flex items-center gap-2">
					<button
						onClick={onAddAfter}
						className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-smooth"
					>
						<Plus className="h-3 w-3" />
						Add below
					</button>
					<button
						onClick={onDuplicate}
						className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-smooth"
						title="Ctrl+D"
					>
						<Copy className="h-3 w-3" />
						Duplicate
					</button>
				</div>

				{/* Delete */}
				<button
					onClick={onRemove}
					className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-smooth w-full"
					title="Ctrl+Backspace"
				>
					<Trash2 className="h-3 w-3" />
					Delete field
				</button>
			</div>
		</div>
	)
}
