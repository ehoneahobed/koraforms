import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@korajs/react'
import { app } from '../kora'
import { setPageMeta } from '../utils/meta'
import {
	GripVertical,
	Plus,
	Check,
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
import { THEME_PRESETS, getThemeById } from '../themes'
import { useSlashCommand } from '../hooks/useSlashCommand'
import { SlashCommandMenu } from '../components/editor/SlashCommandMenu'
import { FormSettings } from '../components/editor/FormSettings'
import { Copy } from 'lucide-react'

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
	const [theme, setTheme] = useState('blue')
	const [settings, setSettings] = useState<FormSettingsType>({})
	const [loaded, setLoaded] = useState(false)
	const [saved, setSaved] = useState(false)
	const [activeField, setActiveField] = useState<string | null>(null)
	const [showThemePicker, setShowThemePicker] = useState(false)
	const [showSettings, setShowSettings] = useState(false)
	const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
	const [fieldSearch, setFieldSearch] = useState('')
	// Share modal is now handled by FormPageShell

	useEffect(() => {
		setPageMeta({
			title: title ? `Edit: ${title}` : 'Form Builder',
			description: 'Build and customize your form with KoraForms.',
		})
	}, [title])

	// Slash command: add a field of a specific type
	const addFieldOfType = useCallback((type: FieldType, afterIndex: number | null) => {
		const newField: FormField = {
			id: `field_${Date.now()}`,
			type,
			label: '',
			required: false,
			...((['select', 'radio', 'checkbox', 'ranking'].includes(type)) ? { options: 'Option 1, Option 2, Option 3' } : {}),
			...(type === 'matrix' ? { matrixRows: 'Quality, Service, Price', matrixColumns: 'Poor, Fair, Good, Excellent' } : {}),
		}
		if (afterIndex !== null && afterIndex >= 0) {
			const next = [...fields]
			next.splice(afterIndex + 1, 0, newField)
			setFields(next)
		} else {
			setFields([...fields, newField])
		}
		setActiveField(newField.id)
		slashCommand.close()
	}, [fields])

	const slashCommand = useSlashCommand(addFieldOfType)

	// Drag-and-drop state
	const [dragIndex, setDragIndex] = useState<number | null>(null)
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

	const moveField = useCallback((from: number, to: number) => {
		setFields(prev => {
			if (to < 0 || to >= prev.length) return prev
			const next = [...prev]
			const [item] = next.splice(from, 1)
			next.splice(to, 0, item!)
			return next
		})
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
			setTheme(String(form.theme || 'blue'))
			try {
				setFields(JSON.parse(String(form.fields || '[]')))
			} catch {
				setFields([])
			}
			try {
				setSettings(JSON.parse(String(form.settings || '{}')))
			} catch {
				setSettings({})
			}
			setLoaded(true)
		}
	}, [form, loaded])

	// Auto-save with debounce
	const save = useCallback(() => {
		if (!formId) return
		updateForm(formId, {
			title: title || 'Untitled Form',
			description,
			fields: JSON.stringify(fields),
			theme,
			settings: JSON.stringify(settings),
			ownerId: userId,
		})
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}, [formId, title, description, fields, theme, settings, userId, updateForm])

	// Auto-save on changes (debounced)
	useEffect(() => {
		if (!loaded) return
		const timer = setTimeout(save, 1500)
		return () => clearTimeout(timer)
	}, [title, description, fields, theme, settings, loaded, save])

	// Field manipulation callbacks (must be before early returns to keep hook order stable)
	const addField = useCallback((afterIndex?: number) => {
		const newField: FormField = {
			id: `field_${Date.now()}`,
			type: 'text',
			label: '',
			required: false,
		}
		if (afterIndex !== undefined) {
			setFields(prev => {
				const next = [...prev]
				next.splice(afterIndex + 1, 0, newField)
				return next
			})
		} else {
			setFields(prev => [...prev, newField])
		}
		setActiveField(newField.id)
	}, [])

	const updateField = useCallback((index: number, updates: Partial<FormField>) => {
		setFields(prev => {
			const next = [...prev]
			next[index] = { ...next[index]!, ...updates }
			return next
		})
	}, [])

	const removeField = useCallback((index: number) => {
		setFields(prev => prev.filter((_, i) => i !== index))
		setActiveField(null)
	}, [])

	const duplicateField = useCallback((index: number) => {
		setFields(prev => {
			const source = prev[index]!
			const copy: FormField = {
				...source,
				id: `field_${Date.now()}`,
				label: source.label ? `${source.label} (copy)` : '',
			}
			const next = [...prev]
			next.splice(index + 1, 0, copy)
			setActiveField(copy.id)
			return next
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

	const isPublished = form ? String(form.status) === 'published' : false

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
		const data = {
			koraforms: true,
			version: 1,
			title: title || 'Untitled Form',
			description,
			fields,
			theme,
			settings,
		}
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${(title || 'form').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.koraform.json`
		a.click()
		URL.revokeObjectURL(url)
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
				try {
					const data = JSON.parse(reader.result as string)
					if (!data.koraforms) {
						alert('This doesn\'t appear to be a KoraForms file.')
						return
					}
					if (data.title) setTitle(data.title)
					if (data.description) setDescription(data.description)
					if (Array.isArray(data.fields)) setFields(data.fields)
					if (data.theme) setTheme(data.theme)
					if (data.settings) setSettings(data.settings)
				} catch {
					alert('Failed to parse the file. Make sure it\'s a valid KoraForms JSON file.')
				}
			}
			reader.readAsText(file)
		}
		input.click()
	}

	// Filter field types for the left panel search
	const filteredFieldTypes = fieldSearch
		? FIELD_TYPES.filter(ft =>
			ft.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
			ft.value.toLowerCase().includes(fieldSearch.toLowerCase())
		)
		: FIELD_TYPES

	// Get the active field data and index
	const activeFieldIndex = activeField ? fields.findIndex(f => f.id === activeField) : -1
	const activeFieldData = activeFieldIndex >= 0 ? fields[activeFieldIndex] : null

	return (
		<div className="flex -mx-4 sm:-mx-6 lg:-mx-8 -mb-8 sm:-mb-10" style={{ minHeight: 'calc(100vh - 200px)' }}>
			{/* Left Panel: Add fields */}
			<div className="hidden lg:flex flex-col w-[200px] shrink-0 border-r border-gray-100 dark:border-gray-800/50 p-4">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Add fields</h3>
				<div className="relative mb-3">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
					<input
						type="text"
						value={fieldSearch}
						onChange={(e) => setFieldSearch(e.target.value)}
						placeholder="Search field types..."
						className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 pl-8 pr-3 py-2 text-sm outline-none placeholder-gray-400 dark:placeholder-gray-500 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-brand-300 dark:focus:ring-brand-700 transition-smooth"
					/>
				</div>
				<div className="flex-1 overflow-y-auto space-y-0.5">
					{filteredFieldTypes.map((ft) => (
						<button
							key={ft.value}
							onClick={() => addFieldOfType(ft.value, fields.length > 0 ? fields.length - 1 : null)}
							className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth"
						>
							<span className="text-gray-400 dark:text-gray-500">{FIELD_ICONS[ft.value]}</span>
							{ft.label}
						</button>
					))}
					{filteredFieldTypes.length === 0 && (
						<p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No matching fields</p>
					)}
				</div>
			</div>

			{/* Center Panel: Form preview */}
			<div className="flex-1 overflow-y-auto p-6">
				{/* Toolbar */}
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-1">
						{/* Desktop/Mobile toggle */}
						<button
							onClick={() => setPreviewMode('desktop')}
							className={`p-2 rounded-lg transition-smooth ${
								previewMode === 'desktop'
									? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
									: 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300'
							}`}
							title="Desktop preview"
						>
							<Monitor className="h-4 w-4" />
						</button>
						<button
							onClick={() => setPreviewMode('mobile')}
							className={`p-2 rounded-lg transition-smooth ${
								previewMode === 'mobile'
									? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
									: 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300'
							}`}
							title="Mobile preview"
						>
							<Smartphone className="h-4 w-4" />
						</button>

						<div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

						{/* Theme button */}
						<button
							onClick={() => setShowThemePicker(!showThemePicker)}
							className="inline-flex items-center gap-2 rounded-lg p-2 text-gray-500 dark:text-gray-400 transition-smooth hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
							title="Toggle theme picker"
						>
							<div
								className="w-4 h-4 rounded-full ring-1 ring-black/10"
								style={{ backgroundColor: getThemeById(theme).preview }}
							/>
						</button>

						<div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

						{/* Export/Import */}
						<button
							onClick={exportFormJson}
							className="p-2 rounded-lg text-gray-400 dark:text-gray-500 transition-smooth hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
							title="Export form as JSON"
						>
							<Download className="h-4 w-4" />
						</button>
						<button
							onClick={importFormJson}
							className="p-2 rounded-lg text-gray-400 dark:text-gray-500 transition-smooth hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
							title="Import form from JSON"
						>
							<Upload className="h-4 w-4" />
						</button>
					</div>

					{/* Save status */}
					<div className="flex items-center">
						{saved && (
							<span className="flex items-center gap-1 text-xs text-emerald-500 animate-fade-in">
								<Check className="h-3 w-3" />
								Saved
							</span>
						)}
					</div>
				</div>

				{/* Theme picker (below toolbar when toggled) */}
				{showThemePicker && (
					<div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-4 animate-fade-in">
						<div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
							{THEME_PRESETS.map((preset) => (
								<button
									key={preset.id}
									onClick={() => setTheme(preset.id)}
									className={`group relative flex flex-col items-center gap-1.5 rounded-xl p-2 transition-smooth ${
										theme === preset.id
											? 'bg-gray-100 dark:bg-gray-800'
											: 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
									}`}
									title={preset.name}
								>
									<div
										className={`w-8 h-8 rounded-full shadow-sm transition-smooth group-hover:scale-110 ${
											theme === preset.id ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900' : ''
										}`}
										style={{
											backgroundColor: preset.preview,
											...(theme === preset.id ? { '--tw-ring-color': preset.preview } as React.CSSProperties : {}),
										}}
									/>
									<span className="text-[10px] text-gray-500 dark:text-gray-400 leading-none truncate w-full text-center">
										{preset.name}
									</span>
								</button>
							))}
						</div>
					</div>
				)}

				{/* Form preview card */}
				<div className={`mx-auto ${previewMode === 'desktop' ? 'max-w-xl' : 'max-w-sm'} transition-all duration-300`}>
					{/* Form header */}
					<div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark p-6 sm:p-8 mb-4 shadow-sm">
						<input
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Untitled Form"
							className="w-full bg-transparent text-xl font-bold outline-none placeholder-gray-300 dark:placeholder-gray-600 text-gray-900 dark:text-gray-100 mb-2"
						/>
						<input
							type="text"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Add a description..."
							className="w-full bg-transparent text-gray-500 dark:text-gray-400 outline-none placeholder-gray-300 dark:placeholder-gray-700 text-sm"
						/>
					</div>

					{/* Form settings (slug, status, thank-you, limits) */}
					{isPublished && (
						<FormSettings
							slug={String(form?.slug || '')}
							status={String(form?.status || 'draft')}
							settings={settings}
							onSlugChange={(newSlug) => {
								if (formId) updateForm(formId, { slug: newSlug })
							}}
							onStatusChange={(newStatus) => {
								if (formId) updateForm(formId, { status: newStatus })
							}}
							onSettingsChange={setSettings}
							isOpen={showSettings}
							onToggle={() => setShowSettings(!showSettings)}
						/>
					)}

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
							/>
						))}
					</div>

					{/* Add field -- click or type / for slash command */}
					<div className="relative mt-3">
						<div className="flex gap-2">
							<button
								onClick={() => addField()}
								className="flex-1 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 py-4 text-gray-400 dark:text-gray-500 transition-smooth hover:border-brand-300 dark:hover:border-brand-700 hover:text-brand-500 flex items-center justify-center gap-2 text-sm font-medium active:scale-[0.99]"
							>
								<Plus className="h-4 w-4" />
								Add field
							</button>
							<button
								onClick={() => slashCommand.open(fields.length - 1)}
								className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 px-4 py-4 text-gray-400 dark:text-gray-500 transition-smooth hover:border-brand-300 dark:hover:border-brand-700 hover:text-brand-500 flex items-center justify-center text-sm font-medium active:scale-[0.99]"
								title="Choose field type (or press /)"
							>
								/
							</button>
						</div>
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

					{/* Keyboard shortcuts hint */}
					{fields.length > 0 && (
						<div className="mt-6 flex items-center justify-center gap-4 text-[10px] text-gray-300 dark:text-gray-700">
							<span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">Ctrl+S</kbd> save</span>
							<span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">Ctrl+D</kbd> duplicate</span>
							<span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">/</kbd> insert</span>
							<span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">Esc</kbd> deselect</span>
						</div>
					)}

					{/* Bottom spacer */}
					<div className="h-20" />
				</div>
			</div>

			{/* Right Panel: Field settings */}
			<div className="hidden lg:flex flex-col w-[280px] shrink-0 border-l border-gray-100 dark:border-gray-800/50 overflow-y-auto">
				<div className="p-4">
					<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Field settings</h3>
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
}) {
	const needsOptions = ['select', 'radio', 'checkbox', 'ranking'].includes(field.type)
	const isMatrix = field.type === 'matrix'
	const needsScaleLabels = field.type === 'scale'
	const isRating = field.type === 'rating'
	const hasConditions = field.conditions && field.conditions.length > 0

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
			className={`group rounded-xl p-4 transition-smooth cursor-pointer ${
				isDragging
					? 'opacity-40 border-2 border-brand-300 dark:border-brand-700 bg-white dark:bg-surface-elevated-dark'
					: isDragOver
						? 'border-2 border-brand-400 dark:border-brand-600 shadow-md shadow-brand-100 dark:shadow-none bg-white dark:bg-surface-elevated-dark'
						: isActive
							? 'border-l-[3px] border-brand-500 border-t border-r border-b border-t-gray-200 dark:border-t-gray-800 border-r-gray-200 dark:border-r-gray-800 border-b-gray-200 dark:border-b-gray-800 bg-white dark:bg-surface-elevated-dark shadow-sm'
							: 'border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-elevated-dark hover:bg-gray-50 dark:hover:bg-gray-800/30'
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
						<span className={`text-sm font-medium ${field.label ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'}`}>
							{field.label || 'Untitled'}
						</span>
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
							<div className="h-8 rounded-lg bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 flex items-center px-3">
								<span className="text-xs text-gray-300 dark:text-gray-600">
									{field.placeholder || FIELD_TYPES.find(ft => ft.value === field.type)?.label || 'Type here...'}
								</span>
							</div>
						)}

						{/* Textarea -- taller gray box */}
						{field.type === 'textarea' && (
							<div className="h-14 rounded-lg bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 flex items-start px-3 pt-2">
								<span className="text-xs text-gray-300 dark:text-gray-600">
									{field.placeholder || 'Type your answer...'}
								</span>
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

						{/* Section break */}
						{field.type === 'section' && (
							<div className="border-t-2 border-gray-200 dark:border-gray-700 mt-1" />
						)}

						{/* Statement */}
						{field.type === 'statement' && (
							<p className="text-xs text-gray-400 dark:text-gray-500 italic">Display text</p>
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
	const isDisplayOnly = field.type === 'section' || field.type === 'statement' || field.type === 'calculated' || field.type === 'hidden'
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
	const availableFields = allFields.slice(0, index).filter(
		f => f.type !== 'section' && f.type !== 'statement'
	)
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

	return (
		<div className="px-4 pb-4 space-y-4 text-sm">
			{/* Field type selector */}
			<div>
				<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
					Type
				</label>
				<div className="flex flex-wrap gap-1.5">
					{FIELD_TYPES.map((ft) => (
						<button
							key={ft.value}
							onClick={() => onUpdate({ type: ft.value })}
							className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-smooth ${
								field.type === ft.value
									? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
									: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
							}`}
						>
							{FIELD_ICONS[ft.value]}
							{ft.label}
						</button>
					))}
				</div>
			</div>

			{/* Label input */}
			<div>
				<label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
					Label
				</label>
				<input
					type="text"
					value={field.label}
					onChange={(e) => onUpdate({ label: e.target.value })}
					placeholder={`Question ${index + 1}`}
					className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600"
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
						className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth"
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
						placeholder="{field_id} + {field_id} or SUM({a}, {b})"
						className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm font-mono outline-none focus:border-brand-400 dark:focus:border-brand-600 transition-smooth"
					/>
					<p className="text-[10px] text-gray-400 dark:text-gray-500">
						Use {'{'}<em>field_id</em>{'}'} to reference fields. Supports +, -, *, /, SUM(), AVG(), IF(), CONCAT().
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

			{/* Answer piping hint */}
			<div className="text-[10px] text-gray-400 dark:text-gray-500">
				Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-[10px]">{'{'}{'{'}<em>field_id</em>{'}'}{'}'}</code> in labels for answer piping.
			</div>

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
