import type { InferInsertInput, InferRecord, InferUpdateInput } from 'korajs'
import type schema from './schema'

/**
 * Record and input types derived from `src/schema.ts`, so local helpers and
 * mutation wrappers use exactly the types Kora's collection methods accept.
 */
type Collections = (typeof schema)['__input']['collections']

export type CollectionName = keyof Collections & string

type FieldsOf<C extends CollectionName> = Collections[C]['fields']

type JsonFieldKeys<F> = {
	[K in keyof F]: F[K] extends { readonly '~field': { readonly kind: 'json' } } ? K : never
}[keyof F]

/**
 * A record as read from the local store. Builds before the beta.13 upgrade
 * wrote JSON strings into `t.json` fields (for example `fields: '[]'`), and
 * those rows still exist in local databases and on the server, so a json field
 * can also read back as a string. Read json fields through the parse helpers in
 * `src/domain/forms.ts`; new writes always store real values.
 */
export type KoraRecord<C extends CollectionName> = {
	readonly [K in keyof InferRecord<FieldsOf<C>>]: K extends JsonFieldKeys<FieldsOf<C>>
		? InferRecord<FieldsOf<C>>[K] | string
		: InferRecord<FieldsOf<C>>[K]
}

/** The input `app.<collection>.insert()` accepts. */
export type KoraInsert<C extends CollectionName> = InferInsertInput<FieldsOf<C>>

/** The input `app.<collection>.update(id, ...)` accepts. */
export type KoraUpdate<C extends CollectionName> = InferUpdateInput<FieldsOf<C>>
