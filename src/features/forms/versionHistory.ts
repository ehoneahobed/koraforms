import { parseFormFields, parseFormSettings, serializeFormFields, serializeFormSettings } from '../../domain/forms'
import { stripFormAccessSecrets } from '../../domain/formPassword'
import { stableHash, type PublicFormVersionRecord } from '../form-fill/offlineModel'
import type { FormField, FormSettings } from '../../types'

export interface FormVersionSource {
	id?: unknown
	slug?: unknown
	title?: unknown
	description?: unknown
	fields?: unknown
	settings?: unknown
	theme?: unknown
	status?: unknown
}

export interface PublishedFormVersionInput {
	form: FormVersionSource
	slug: string
	now?: number
}

export interface FormVersionRestorePayload extends Record<string, unknown> {
	title: string
	description: string
	fields: string
	settings: string
	theme: string
	status: 'draft'
}

export function buildPublishedFormVersionRecord(input: PublishedFormVersionInput): PublicFormVersionRecord {
	const now = input.now ?? Date.now()
	const fields = serializeFormFields(parseFormFields(input.form.fields))
	const settings = stripFormAccessSecrets(parseFormSettings(input.form.settings))
	const title = String(input.form.title || 'Untitled form')
	const description = String(input.form.description || '')
	const theme = String(input.form.theme || 'red')
	const versionHash = stableHash({
		formId: String(input.form.id || input.slug),
		title,
		description,
		fields,
		settings: serializeFormSettings(settings),
		theme,
		status: 'published',
	})

	return {
		slug: input.slug,
		formId: String(input.form.id || input.slug),
		versionHash,
		title,
		description,
		fields,
		settings: serializeFormSettings(settings),
		theme,
		status: 'published',
		cachedAt: now,
		publishedAt: now,
	}
}

export function buildVersionRestorePayload(version: Pick<PublicFormVersionRecord, 'title' | 'description' | 'fields' | 'settings' | 'theme'>): FormVersionRestorePayload {
	const fields: FormField[] = serializeFormFields(parseFormFields(version.fields))
	const settings: FormSettings = stripFormAccessSecrets(parseFormSettings(version.settings))
	return {
		title: String(version.title || 'Untitled form'),
		description: String(version.description || ''),
		fields: JSON.stringify(fields),
		settings: JSON.stringify(serializeFormSettings(settings)),
		theme: String(version.theme || 'red'),
		status: 'draft',
	}
}

export function sortPublishedVersions(records: readonly PublicFormVersionRecord[]): PublicFormVersionRecord[] {
	return [...records]
		.filter(record => record.status === 'published')
		.sort((a, b) => {
			if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt
			return String(b.versionHash).localeCompare(String(a.versionHash))
		})
}
