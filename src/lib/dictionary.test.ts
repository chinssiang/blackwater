import { describe, it, expect } from 'vitest';
import en from '@/dictionaries/en.json';
import zhTw from '@/dictionaries/zh_tw.json';
import { LOCALES } from '@/lib/i18n';
import { formatDateStatusLabel } from '@/lib/dictionary';

// `Dictionary` is `typeof en`, so TypeScript only ever checks the English file.
// A key added to en.json and forgotten in zh_tw.json compiles clean and arrives
// as `undefined` at runtime -- which React renders as nothing, so a translated
// page loses a label silently. `events.viewAll` is the live example: it is the
// fallback wording for the events strip's "All events" link, and an empty one
// would be an <a> with no accessible name.
//
// Structure only, never values: the whole point is that the strings differ.

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Every leaf path in the object, as dotted strings. Arrays compare by shape. */
function paths(value: Json, prefix = ''): string[] {
	if (value === null || typeof value !== 'object') return [prefix];
	if (Array.isArray(value))
		return value.flatMap((v, i) => paths(v, `${prefix}[${i}]`));
	return Object.entries(value).flatMap(([k, v]) =>
		paths(v, prefix ? `${prefix}.${k}` : k)
	);
}

const DICTIONARIES: Record<string, Json> = {
	en: en as Json,
	zh_tw: zhTw as Json,
};

describe('dictionaries', () => {
	it('covers every locale in LOCALES', () => {
		// Adding a locale to i18n.ts without a dictionary would otherwise only
		// surface as a failed import at request time.
		expect(Object.keys(DICTIONARIES).sort()).toEqual([...LOCALES].sort());
	});

	it('has the same key structure in every locale', () => {
		const reference = paths(en as Json).sort();
		for (const [locale, dict] of Object.entries(DICTIONARIES)) {
			expect(paths(dict).sort(), `${locale}.json differs from en.json`).toEqual(
				reference
			);
		}
	});

	it('has no empty strings, which render as a missing label', () => {
		for (const [locale, dict] of Object.entries(DICTIONARIES)) {
			const blanks = paths(dict).filter((p) => {
				const leaf = p
					.split('.')
					.reduce<Json>((acc, k) => (acc as Record<string, Json>)?.[k], dict);
				return leaf === '';
			});
			expect(blanks, `${locale}.json has blank values`).toEqual([]);
		}
	});
});

// The label shown in place of a date when the date is not firm. Shared because
// the detail page, the /events rows and the ticket stub all render this field,
// and before it existed the first translated it while the other two printed the
// raw English schema value in both locales.
describe('formatDateStatusLabel', () => {
	const t = en.events;

	it('translates the statuses the schema defines', () => {
		expect(formatDateStatusLabel('postponed', t)).toBe(t.status.postponed);
		expect(formatDateStatusLabel('cancelled', t)).toBe(t.status.cancelled);
	});

	it('uses the TBA wording for tba and for no status', () => {
		expect(formatDateStatusLabel('tba', t)).toBe(t.status.tba);
		expect(formatDateStatusLabel(null, t)).toBe(t.status.tba);
		expect(formatDateStatusLabel(undefined, t)).toBe(t.status.tba);
	});

	it('never leaks a raw schema value into the page', () => {
		// The behaviour this replaced was `dateStatus || t.status.tba`, which
		// rendered an unmapped enum as its own untranslated identifier.
		expect(formatDateStatusLabel('rescheduled', t)).toBe(t.status.tba);
	});

	it('resolves from the locale dictionary it is handed', () => {
		expect(formatDateStatusLabel('postponed', zhTw.events)).toBe(
			zhTw.events.status.postponed
		);
	});
});
