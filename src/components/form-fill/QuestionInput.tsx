import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent, type RefObject, type TouchEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Star, Trash2, Upload, X } from 'lucide-react'
import type { FormField } from '../../types'
import {
	moveListItem,
	parseLabelList,
	parseMatrixAnswers,
	parseMatrixAxis,
	parseOptionList,
	parseRankingValue,
	parseSelectedOptions,
	toggleSelectedOption,
} from '../../features/form-fill/flow'

export function QuestionInput({
	field,
	value,
	onChange,
	inputRef,
}: {
	field: FormField
	value: string
	onChange: (value: string) => void
	inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>
}) {
	const baseClass =
		'w-full border-0 border-b-2 border-gray-200 dark:border-gray-700 bg-transparent px-0 py-3 text-lg sm:text-xl outline-none focus:border-brand-500 dark:focus:border-brand-400 transition-smooth text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600'

	switch (field.type) {
		case 'textarea':
			return (
				<textarea
					ref={inputRef as RefObject<HTMLTextAreaElement>}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="Type your answer here..."
					rows={3}
					className={baseClass + ' resize-none'}
				/>
			)

		case 'select': {
			const options = parseOptionList(field.options)
			return (
				<div className="space-y-2">
					{options.map((opt, i) => (
						<button
							key={opt}
							onClick={() => onChange(opt)}
							className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-smooth ${
								value === opt
									? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
									: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
							}`}
						>
							<span className="w-6 h-6 rounded-md border-2 border-current flex items-center justify-center text-xs font-medium shrink-0">
								{String.fromCharCode(65 + i)}
							</span>
							{opt}
							{value === opt && <Check className="h-4 w-4 ml-auto" />}
						</button>
					))}
				</div>
			)
		}

		case 'radio': {
			const options = parseOptionList(field.options)
			return (
				<div className="space-y-2">
					{options.map((opt, i) => (
						<button
							key={opt}
							onClick={() => onChange(opt)}
							className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-smooth ${
								value === opt
									? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
									: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
							}`}
						>
							<span className="w-6 h-6 rounded-md border-2 border-current flex items-center justify-center text-xs font-medium shrink-0">
								{String.fromCharCode(65 + i)}
							</span>
							{opt}
							{value === opt && <Check className="h-4 w-4 ml-auto" />}
						</button>
					))}
				</div>
			)
		}

		case 'checkbox': {
			const options = parseOptionList(field.options)
			const selected = parseSelectedOptions(value)
			return (
				<div className="space-y-2">
					{options.map((opt, i) => {
						const isSelected = selected.includes(opt)
						return (
							<button
								key={opt}
								onClick={() => {
									onChange(toggleSelectedOption(value, opt))
								}}
								className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-smooth ${
									isSelected
										? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
										: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
								}`}
							>
								<span className="w-6 h-6 rounded-md border-2 border-current flex items-center justify-center text-xs font-medium shrink-0">
									{isSelected ? <Check className="h-3.5 w-3.5" /> : String.fromCharCode(65 + i)}
								</span>
								{opt}
							</button>
						)
					})}
					<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
						Select all that apply
					</p>
				</div>
			)
		}

		case 'number':
			return (
				<input
					ref={inputRef as RefObject<HTMLInputElement>}
					type="text"
					inputMode="decimal"
					value={value}
					onChange={(e) => {
						// Only allow digits, decimal point, minus sign
						const v = e.target.value
						if (v === '' || v === '-' || /^-?\d*\.?\d*$/.test(v)) {
							onChange(v)
						}
					}}
					placeholder="Type a number..."
					className={baseClass}
				/>
			)

		case 'date':
			return (
				<input
					ref={inputRef as RefObject<HTMLInputElement>}
					type="date"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className={baseClass}
				/>
			)

		case 'email':
			return (
				<input
					ref={inputRef as RefObject<HTMLInputElement>}
					type="email"
					inputMode="email"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="name@example.com"
					className={baseClass}
				/>
			)

		case 'phone':
			return (
				<input
					ref={inputRef as RefObject<HTMLInputElement>}
					type="tel"
					inputMode="tel"
					value={value}
					onChange={(e) => {
						// Only allow digits, +, -, spaces, parentheses
						const v = e.target.value
						if (v === '' || /^[+\d\s()-]*$/.test(v)) {
							onChange(v)
						}
					}}
					placeholder="+233 XX XXX XXXX"
					className={baseClass}
				/>
			)

		case 'rating': {
			const currentRating = parseInt(value) || 0
			return (
				<div className="flex gap-2">
					{[1, 2, 3, 4, 5].map((star) => (
						<button
							key={star}
							onClick={() => onChange(String(star))}
							className="p-1 transition-smooth hover:scale-110 active:scale-95"
							aria-label={`${star} star${star !== 1 ? 's' : ''}`}
						>
							<Star
								className={`h-11 w-11 sm:h-12 sm:w-12 transition-smooth ${
									star <= currentRating
										? 'text-amber-400 fill-amber-400'
										: 'text-gray-300 dark:text-gray-600'
								}`}
							/>
						</button>
					))}
				</div>
			)
		}

		case 'scale': {
			const labels = parseLabelList(field.options)
			const lowLabel = labels[0] || ''
			const highLabel = labels[1] || ''
			return (
				<div>
					<div className="flex flex-wrap gap-2">
						{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
							<button
								key={num}
								onClick={() => onChange(String(num))}
								className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 text-sm font-semibold transition-smooth ${
									value === String(num)
										? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
										: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
								}`}
							>
								{num}
							</button>
						))}
					</div>
					{(lowLabel || highLabel) && (
						<div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-gray-500">
							<span>{lowLabel}</span>
							<span>{highLabel}</span>
						</div>
					)}
				</div>
			)
		}

		case 'yesno':
			return (
				<div className="flex gap-3">
					<button
						onClick={() => onChange('yes')}
						className={`flex-1 rounded-xl border-2 px-6 py-4 text-lg font-semibold transition-smooth ${
							value === 'yes'
								? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
								: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
						}`}
					>
						Yes
					</button>
					<button
						onClick={() => onChange('no')}
						className={`flex-1 rounded-xl border-2 px-6 py-4 text-lg font-semibold transition-smooth ${
							value === 'no'
								? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
								: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
						}`}
					>
						No
					</button>
				</div>
			)

		case 'time':
			return (
				<input
					ref={inputRef as RefObject<HTMLInputElement>}
					type="time"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className={baseClass}
				/>
			)

		case 'url':
			return (
				<input
					ref={inputRef as RefObject<HTMLInputElement>}
					type="url"
					inputMode="url"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="https://example.com"
					className={baseClass}
				/>
			)

		case 'signature':
			return <SignatureInput value={value} onChange={onChange} />

		case 'file':
			return <FileInput field={field} value={value} onChange={onChange} />

		case 'ranking': {
			const rankOptions = parseOptionList(field.options)
			return <RankingInput options={rankOptions} value={value} onChange={onChange} />
		}

		case 'matrix':
			return <MatrixInput field={field} value={value} onChange={onChange} />

		case 'calculated':
			return (
				<div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
					<p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
						{value || '—'}
					</p>
					<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Calculated automatically</p>
				</div>
			)

		// hidden fields don't render, section and statement are handled at screen level
		case 'hidden':
		case 'section':
		case 'statement':
			return null

		default:
			return (
				<input
					ref={inputRef as RefObject<HTMLInputElement>}
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="Type your answer here..."
					className={baseClass}
				/>
			)
	}
}

function FileInput({
	field,
	value,
	onChange,
}: {
	field: FormField
	value: string
	onChange: (value: string) => void
}) {
	const fileRef = useRef<HTMLInputElement>(null)
	const maxSize = (field.maxSize || 10) * 1024 * 1024 // Convert MB to bytes
	const [error, setError] = useState('')
	const [preview, setPreview] = useState<string | null>(value || null)

	const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		setError('')

		if (file.size > maxSize) {
			setError(`File too large. Max size: ${field.maxSize || 10}MB`)
			return
		}

		const reader = new FileReader()
		reader.onload = () => {
			const result = reader.result as string
			onChange(result)
			// Preview for images
			if (file.type.startsWith('image/')) {
				setPreview(result)
			} else {
				setPreview(null)
			}
		}
		reader.readAsDataURL(file)
	}

	const clear = () => {
		onChange('')
		setPreview(null)
		if (fileRef.current) fileRef.current.value = ''
	}

	return (
		<div>
			{value ? (
				<div className="space-y-3">
					{preview && preview.startsWith('data:image/') && (
						<div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
							<img src={preview} alt="Upload preview" className="max-h-48 w-full object-contain bg-gray-50 dark:bg-gray-800" />
						</div>
					)}
					<div className="flex items-center gap-2">
						<span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
							<Check className="h-3.5 w-3.5" />
							File attached
						</span>
						<button
							onClick={clear}
							className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-smooth"
						>
							<Trash2 className="h-3 w-3" />
							Remove
						</button>
					</div>
				</div>
			) : (
				<label className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 py-8 px-4 cursor-pointer hover:border-brand-400 dark:hover:border-brand-600 transition-smooth">
					<Upload className="h-8 w-8 text-gray-400 dark:text-gray-500" />
					<span className="text-sm text-gray-500 dark:text-gray-400">
						Click to upload or take a photo
					</span>
					{field.accept && (
						<span className="text-xs text-gray-400 dark:text-gray-500">
							Accepted: {field.accept}
						</span>
					)}
					<input
						ref={fileRef}
						type="file"
						accept={field.accept || 'image/*'}
						capture={field.capture}
						onChange={handleFile}
						className="hidden"
					/>
				</label>
			)}
			{error && (
				<p className="mt-2 text-sm text-red-500">{error}</p>
			)}
		</div>
	)
}

function SignatureInput({
	value,
	onChange,
}: {
	value: string
	onChange: (value: string) => void
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const isDrawingRef = useRef(false)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		// Set canvas dimensions
		const rect = canvas.getBoundingClientRect()
		canvas.width = rect.width * 2
		canvas.height = rect.height * 2
		ctx.scale(2, 2)
		ctx.lineCap = 'round'
		ctx.lineJoin = 'round'
		ctx.lineWidth = 2
		ctx.strokeStyle = document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#1f2937'

		// Restore existing signature if value exists
		if (value) {
			const img = new Image()
			img.onload = () => {
				ctx.drawImage(img, 0, 0, rect.width, rect.height)
			}
			img.src = value
		}
	}, []) // Only run once on mount

	const getPosition = (e: MouseEvent | TouchEvent) => {
		const canvas = canvasRef.current
		if (!canvas) return { x: 0, y: 0 }
		const rect = canvas.getBoundingClientRect()
		if ('touches' in e) {
			return {
				x: e.touches[0]!.clientX - rect.left,
				y: e.touches[0]!.clientY - rect.top,
			}
		}
		return {
			x: (e as MouseEvent).clientX - rect.left,
			y: (e as MouseEvent).clientY - rect.top,
		}
	}

	const startDrawing = (e: MouseEvent | TouchEvent) => {
		e.preventDefault()
		isDrawingRef.current = true
		const canvas = canvasRef.current
		const ctx = canvas?.getContext('2d')
		if (!ctx) return
		const pos = getPosition(e)
		ctx.beginPath()
		ctx.moveTo(pos.x, pos.y)
	}

	const draw = (e: MouseEvent | TouchEvent) => {
		e.preventDefault()
		if (!isDrawingRef.current) return
		const canvas = canvasRef.current
		const ctx = canvas?.getContext('2d')
		if (!ctx) return
		const pos = getPosition(e)
		ctx.lineTo(pos.x, pos.y)
		ctx.stroke()
	}

	const stopDrawing = () => {
		if (!isDrawingRef.current) return
		isDrawingRef.current = false
		const canvas = canvasRef.current
		if (!canvas) return
		onChange(canvas.toDataURL('image/png'))
	}

	const clearSignature = () => {
		const canvas = canvasRef.current
		const ctx = canvas?.getContext('2d')
		if (!ctx || !canvas) return
		const rect = canvas.getBoundingClientRect()
		ctx.clearRect(0, 0, rect.width, rect.height)
		onChange('')
	}

	return (
		<div>
			<div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
				<canvas
					ref={canvasRef}
					className="w-full h-40 sm:h-48 cursor-crosshair touch-none"
					onMouseDown={startDrawing}
					onMouseMove={draw}
					onMouseUp={stopDrawing}
					onMouseLeave={stopDrawing}
					onTouchStart={startDrawing}
					onTouchMove={draw}
					onTouchEnd={stopDrawing}
				/>
			</div>
			<div className="flex items-center justify-between mt-2">
				<p className="text-xs text-gray-400 dark:text-gray-500">
					Draw your signature above
				</p>
				{value && (
					<button
						onClick={clearSignature}
						className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-smooth"
					>
						<X className="h-3 w-3" />
						Clear
					</button>
				)}
			</div>
		</div>
	)
}

// Ranking — drag to reorder options
function RankingInput({
	options,
	value,
	onChange,
}: {
	options: string[]
	value: string
	onChange: (value: string) => void
}) {
	const [items, setItems] = useState<string[]>(() => parseRankingValue(value, options))
	const [dragIndex, setDragIndex] = useState<number | null>(null)

	const moveItem = (from: number, to: number) => {
		const next = moveListItem(items, from, to)
		setItems(next)
		onChange(JSON.stringify(next))
	}

	return (
		<div className="space-y-1.5">
			<p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Drag to reorder, or use the arrows</p>
			{items.map((item, i) => (
				<div
					key={`${item}-${i}`}
					draggable
					onDragStart={() => setDragIndex(i)}
					onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
					onDrop={() => { if (dragIndex !== null && dragIndex !== i) moveItem(dragIndex, i); setDragIndex(null) }}
					onDragEnd={() => setDragIndex(null)}
					className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-grab active:cursor-grabbing transition-smooth select-none ${
						dragIndex === i
							? 'border-brand-400 dark:border-brand-600 bg-brand-50 dark:bg-brand-900/20 opacity-60'
							: 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
					}`}
				>
					<span className="text-sm font-bold text-brand-500 dark:text-brand-400 tabular-nums w-6 text-center shrink-0">
						{i + 1}
					</span>
					<span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{item}</span>
					<div className="flex flex-col gap-0.5 shrink-0">
						<button
							onClick={(e) => { e.stopPropagation(); if (i > 0) moveItem(i, i - 1) }}
							disabled={i === 0}
							className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-smooth"
						>
							<ArrowLeft className="h-3 w-3 rotate-90" />
						</button>
						<button
							onClick={(e) => { e.stopPropagation(); if (i < items.length - 1) moveItem(i, i + 1) }}
							disabled={i === items.length - 1}
							className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-smooth"
						>
							<ArrowRight className="h-3 w-3 rotate-90" />
						</button>
					</div>
				</div>
			))}
		</div>
	)
}

// Matrix / grid — rows × columns with radio selection per row
function MatrixInput({
	field,
	value,
	onChange,
}: {
	field: FormField
	value: string
	onChange: (value: string) => void
}) {
	const rows = parseMatrixAxis(field.matrixRows)
	const columns = parseMatrixAxis(field.matrixColumns)

	const answers = parseMatrixAnswers(value)

	const setAnswer = (row: string, col: string) => {
		const next = { ...answers, [row]: col }
		onChange(JSON.stringify(next))
	}

	if (rows.length === 0 || columns.length === 0) {
		return <p className="text-sm text-gray-400 italic">Matrix not configured</p>
	}

	return (
		<div className="overflow-x-auto -mx-2">
			<table className="w-full text-sm">
				<thead>
					<tr>
						<th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[120px]" />
						{columns.map(col => (
							<th key={col} className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[80px]">
								{col}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, ri) => (
						<tr key={row} className={ri % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}>
							<td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 font-medium">{row}</td>
							{columns.map(col => (
								<td key={col} className="px-3 py-3 text-center">
									<button
										onClick={() => setAnswer(row, col)}
										className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
											answers[row] === col
												? 'border-brand-500 bg-brand-500 shadow-sm shadow-brand-500/30'
												: 'border-gray-300 dark:border-gray-600 hover:border-brand-400 dark:hover:border-brand-500'
										}`}
									>
										{answers[row] === col && (
											<div className="w-full h-full flex items-center justify-center">
												<div className="w-2 h-2 rounded-full bg-white" />
											</div>
										)}
									</button>
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
