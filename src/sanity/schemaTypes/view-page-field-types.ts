/**
 * Extends Sanity schema options for ViewPageField (custom "View page" URL).
 * @see src/sanity/schemaTypes/components/ViewPageField.tsx
 */
export interface ViewPageFieldSchemaOptions {
	viewPageUrl?: string;
}

declare module 'sanity' {
	// Empty-but-extending is the point: declaration merging is what adds
	// `viewPageUrl` to Sanity's own options interfaces, and a type alias cannot
	// merge into a declared module. Allowed globally via the
	// `allowInterfaces: 'with-single-extends'` option in eslint.config.mjs.
	interface ArrayOptions extends ViewPageFieldSchemaOptions {}
	interface SlugOptions extends ViewPageFieldSchemaOptions {}
}
