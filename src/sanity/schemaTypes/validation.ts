import type { ValidationContext, ValidationError } from 'sanity';
import { DEFAULT_LOCALE } from '@/lib/i18n';

/*
	Guardrails for document-level translations of `pEvent`.

	A translated event is a *separate document*, so only its wording should differ
	-- dates, venue and crew describe the event itself and must stay identical.
	Nothing enforced that, and the copies had already drifted: `147-srp` was
	published with a 22:30 UTC start in Chinese and 23:00 in English, and two more
	pairs disagreed on `locationRef`.

	Slug parity matters most. Every listing query dedups translations by matching
	`slug.current` (see `productLocaleFilter` in sanity/lib/queries.ts), so a
	translation whose slug differs is not recognised as a translation at all and
	the event renders twice.

	The source document is resolved through the document-internationalization
	plugin's `translation.metadata` document rather than by slug -- keying on slug
	would assume the very thing these rules exist to verify. Note that
	`translations[]._key` holds a random key in this dataset rather than a
	language code, so the source sibling is matched on its `language` field.
*/

const SOURCE_EVENT_QUERY = `*[
	_type == "pEvent"
	&& language == $sourceLanguage
	&& _id in *[_type == "translation.metadata" && references($id)].translations[].value._ref
][0]{
	"slug": slug.current,
	"utc": eventDatetime.utc,
	dateStatus,
	"locationRef": locationRef._ref,
	location
}`;

type SourceEvent = {
	slug: string | null;
	utc: string | null;
	dateStatus: string | null;
	locationRef: string | null;
	location: string | null;
};

type EventDoc = {
	_id?: string;
	language?: string;
	slug?: { current?: string };
	eventDatetime?: { utc?: string };
	dateStatus?: string;
	locationRef?: { _ref?: string };
	location?: string;
	teamAssignments?: unknown[];
};

function isTranslation(doc: EventDoc | undefined): boolean {
	return !!doc?.language && doc.language !== DEFAULT_LOCALE;
}

/**
 * Blocks publishing a translated event whose locale-invariant fields disagree
 * with its source-language document.
 */
export async function validateEventTranslationParity(
	doc: EventDoc | undefined,
	context: ValidationContext
): Promise<true | ValidationError[]> {
	if (!isTranslation(doc)) return true;

	const id = doc?._id?.replace(/^drafts\./, '');
	if (!id) return true;

	const client = context.getClient({ apiVersion: '2025-02-19' });
	const source = await client.fetch<SourceEvent | null>(SOURCE_EVENT_QUERY, {
		id,
		sourceLanguage: DEFAULT_LOCALE,
	});

	// Not linked to a source yet, or the source was deleted. Creating a
	// translation before its source exists is legitimate -- nothing to compare.
	if (!source) return true;

	const errors: ValidationError[] = [];
	const requireMatch = (
		actual: string | null | undefined,
		expected: string | null | undefined,
		path: ValidationError['path'],
		message: string
	) => {
		if ((actual ?? null) !== (expected ?? null)) errors.push({ message, path });
	};

	requireMatch(
		doc?.slug?.current,
		source.slug,
		['slug'],
		`Slug must match the English version ("${source.slug ?? '—'}"). Listings match translations by slug, so a different slug makes this event appear twice.`
	);
	requireMatch(
		doc?.eventDatetime?.utc,
		source.utc,
		['eventDatetime'],
		'Date & time must match the English version — it describes the event, not its wording. Change it on the English document instead.'
	);
	requireMatch(
		doc?.dateStatus,
		source.dateStatus,
		['dateStatus'],
		'Date status must match the English version.'
	);
	requireMatch(
		doc?.locationRef?._ref,
		source.locationRef,
		['locationRef'],
		'Location must match the English version.'
	);
	requireMatch(
		doc?.location,
		source.location,
		['location'],
		'One-off location name must match the English version.'
	);

	return errors.length > 0 ? errors : true;
}

/**
 * Crew is authored once, on the source document. Assignments duplicated onto a
 * translation are what listed the same event twice on /events-crew.
 */
export function validateCrewOnSourceOnly(
	doc: EventDoc | undefined
): true | ValidationError[] {
	if (!isTranslation(doc)) return true;
	if (!doc?.teamAssignments?.length) return true;

	return [
		{
			message:
				'Team assignments belong on the English document. Authoring them here as well lists this event twice on /events-crew.',
			path: ['teamAssignments'],
		},
	];
}
