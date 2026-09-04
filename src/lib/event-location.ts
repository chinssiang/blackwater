/**
 * Which venue an event shows, and where its map link points.
 *
 * `pEvent` carries two sources: a `locationRef` to a `gLocation` document, and
 * a one-off `location`/`locationLink` pair the schema hides once a venue is
 * referenced. The reference wins — that is the whole rule, and it was written
 * out identically in five components plus a sixth inline copy feeding the
 * events JSON-LD. Flipping the precedence, or adding a third source, meant six
 * edits; missing the JSON-LD one would have left structured data naming a
 * different venue than the page it describes.
 *
 * Deliberately not in `event-date.ts`: that module owns the timezone rules, and
 * a venue has nothing to do with them.
 */
export type EventLocationSource = {
	location?: string | null;
	locationLink?: string | null;
	locationRef?: {
		name?: string | null;
		mapLink?: string | null;
	} | null;
};

export type EventLocation = {
	name: string | null;
	mapLink: string | null;
};

export function resolveEventLocation(
	event: EventLocationSource | null | undefined
): EventLocation {
	// `||`, not `??`: an empty string on either field is an unset field, not an
	// answer, and should fall through to the other source.
	return {
		name: event?.locationRef?.name || event?.location || null,
		mapLink: event?.locationRef?.mapLink || event?.locationLink || null,
	};
}
