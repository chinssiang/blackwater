/**
 * Extends Sanity schema options for ViewPageField (custom "View page" URL).
 * @see src/sanity/schemaTypes/components/ViewPageField.jsx
 */
export interface ViewPageFieldSchemaOptions {
	viewPageUrl?: string;
}

declare module 'sanity' {
	interface ArrayOptions extends ViewPageFieldSchemaOptions {}
	interface SlugOptions extends ViewPageFieldSchemaOptions {}
}
