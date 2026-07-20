// Color presets for form theming
// Each preset provides the full brand color scale (50-900) that overrides --color-brand-*

export interface ThemePreset {
	id: string
	name: string
	/** Preview color (the 500 shade) */
	preview: string
	colors: {
		50: string
		100: string
		200: string
		300: string
		400: string
		500: string
		600: string
		700: string
		800: string
		900: string
	}
}

export const THEME_PRESETS: ThemePreset[] = [
	{
		id: 'blue',
		name: 'Blue',
		preview: '#3B82F6',
		colors: {
			50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD', 400: '#60A5FA',
			500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8', 800: '#1E40AF', 900: '#1E3A8A',
		},
	},
	{
		id: 'indigo',
		name: 'Indigo',
		preview: '#6366F1',
		colors: {
			50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC', 400: '#818CF8',
			500: '#6366F1', 600: '#4F46E5', 700: '#4338CA', 800: '#3730A3', 900: '#312E81',
		},
	},
	{
		id: 'rose',
		name: 'Rose',
		preview: '#F43F5E',
		colors: {
			50: '#FFF1F2', 100: '#FFE4E6', 200: '#FECDD3', 300: '#FDA4AF', 400: '#FB7185',
			500: '#F43F5E', 600: '#E11D48', 700: '#BE123C', 800: '#9F1239', 900: '#881337',
		},
	},
	{
		id: 'emerald',
		name: 'Emerald',
		preview: '#10B981',
		colors: {
			50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7', 400: '#34D399',
			500: '#10B981', 600: '#059669', 700: '#047857', 800: '#065F46', 900: '#064E3B',
		},
	},
	{
		id: 'amber',
		name: 'Amber',
		preview: '#F59E0B',
		colors: {
			50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D', 400: '#FBBF24',
			500: '#F59E0B', 600: '#D97706', 700: '#B45309', 800: '#92400E', 900: '#78350F',
		},
	},
	{
		id: 'violet',
		name: 'Violet',
		preview: '#8B5CF6',
		colors: {
			50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 300: '#C4B5FD', 400: '#A78BFA',
			500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9', 800: '#5B21B6', 900: '#4C1D95',
		},
	},
	{
		id: 'sky',
		name: 'Sky',
		preview: '#0EA5E9',
		colors: {
			50: '#F0F9FF', 100: '#E0F2FE', 200: '#BAE6FD', 300: '#7DD3FC', 400: '#38BDF8',
			500: '#0EA5E9', 600: '#0284C7', 700: '#0369A1', 800: '#075985', 900: '#0C4A6E',
		},
	},
	{
		id: 'orange',
		name: 'Orange',
		preview: '#F97316',
		colors: {
			50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74', 400: '#FB923C',
			500: '#F97316', 600: '#EA580C', 700: '#C2410C', 800: '#9A3412', 900: '#7C2D12',
		},
	},
	{
		id: 'teal',
		name: 'Teal',
		preview: '#14B8A6',
		colors: {
			50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4', 400: '#2DD4BF',
			500: '#14B8A6', 600: '#0D9488', 700: '#0F766E', 800: '#115E59', 900: '#134E4A',
		},
	},
	{
		id: 'pink',
		name: 'Pink',
		preview: '#EC4899',
		colors: {
			50: '#FDF2F8', 100: '#FCE7F3', 200: '#FBCFE8', 300: '#F9A8D4', 400: '#F472B6',
			500: '#EC4899', 600: '#DB2777', 700: '#BE185D', 800: '#9D174D', 900: '#831843',
		},
	},
	{
		id: 'cyan',
		name: 'Cyan',
		preview: '#06B6D4',
		colors: {
			50: '#ECFEFF', 100: '#CFFAFE', 200: '#A5F3FC', 300: '#67E8F9', 400: '#22D3EE',
			500: '#06B6D4', 600: '#0891B2', 700: '#0E7490', 800: '#155E75', 900: '#164E63',
		},
	},
	{
		id: 'slate',
		name: 'Slate',
		preview: '#64748B',
		colors: {
			50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1', 400: '#94A3B8',
			500: '#64748B', 600: '#475569', 700: '#334155', 800: '#1E293B', 900: '#0F172A',
		},
	},
	{
		id: 'red',
		name: 'Red',
		preview: '#EF4444',
		colors: {
			50: '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5', 400: '#F87171',
			500: '#EF4444', 600: '#DC2626', 700: '#B91C1C', 800: '#991B1B', 900: '#7F1D1D',
		},
	},
]

export function getThemeById(id: string): ThemePreset {
	return THEME_PRESETS.find((t) => t.id === id) || THEME_PRESETS[0]!
}

/** Returns CSS custom properties to override --color-brand-* */
export function getThemeCSSVars(themeId: string): Record<string, string> {
	const theme = getThemeById(themeId)
	return {
		'--color-brand-50': theme.colors[50],
		'--color-brand-100': theme.colors[100],
		'--color-brand-200': theme.colors[200],
		'--color-brand-300': theme.colors[300],
		'--color-brand-400': theme.colors[400],
		'--color-brand-500': theme.colors[500],
		'--color-brand-600': theme.colors[600],
		'--color-brand-700': theme.colors[700],
		'--color-brand-800': theme.colors[800],
		'--color-brand-900': theme.colors[900],
	}
}
