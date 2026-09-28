/**
 * Bulk event import — the pure half of the Studio's "Import events" tool
 * (src/sanity/tools/EventImportTool.tsx). Turns a pasted event list or a CSV
 * into one row per event, then each row into a `pEvent` draft.
 *
 * pEvent is FIELD-level localized, so an event appears once per language in a
 * paste (a Chinese block and an English block) but becomes ONE document. Rows
 * are paired by their BW number; the date, time and code are locale-invariant,
 * so the two copies disagreeing on any of them is an error rather than a guess.
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { FALLBACK_TIMEZONE } from '@/lib/event-date';
import { newArrayKey } from '@/lib/sanity-key';

export type ImportLang = 'en' | 'zh_tw';
const LANGS: ImportLang[] = ['en', 'zh_tw'];

type I18nValue = { language?: string; value?: string };

/** One event in one language, as read from a single line or CSV row. */
type ImportLine = {
	source: string;
	lang: ImportLang;
	date: string; // yyyy-MM-dd
	time: string | null; // HH:mm, null for "—"
	number: number;
	code: string;
	subtitle: string;
	location: string;
};

export type ImportRow = {
	number: number;
	code: string;
	/** "BW 183 SRP" — the same in every language, as the existing events are. */
	title: string;
	slug: string;
	date: string;
	time: string | null;
	subtitle: Record<ImportLang, string>;
	location: Record<ImportLang, string>;
	errors: string[];
};

export type ImportResult = {
	rows: ImportRow[];
	/** Event lines that were not imported, with the reason. */
	skipped: { source: string; reason: string }[];
};

const CJK = /[㐀-鿿]/;

const BULLET = /^[\s•·*\-–]+/;
// 2026-10-31, 2026/10/31, 10/31, 10.31 — optionally followed by a weekday in
// parentheses, e.g. "10/31 (六)" or "10/31（Sat）".
const DATE_PREFIX =
	/^(?:(\d{4})[-/.])?(\d{1,2})[-/.](\d{1,2})(?:\s*[(（][^)）]*[)）])?\s*[-–—|:,]?\s*/;
const EVENT_LINE =
	/^BW\s*(\d+)\s+([A-Za-z]+)\s*\/\s*([^/]+?)\s*\/\s*(.+?)\s*@\s*(.+?)\s*[.。]?\s*$/;

/**
 * Resolve a date that may lack a year. A bare month/day takes today's year,
 * unless that lands more than 90 days in the past — then it is next year's, so
 * a December list that runs into January comes out right.
 */
function resolveDate(
	year: string | undefined,
	month: string,
	day: string,
	today: Date
): string | null {
	const m = Number(month);
	const d = Number(day);
	if (m < 1 || m > 12 || d < 1 || d > 31) return null;
	let y = year ? Number(year) : today.getFullYear();
	if (!year) {
		const candidate = Date.UTC(y, m - 1, d);
		const todayUtc = Date.UTC(
			today.getFullYear(),
			today.getMonth(),
			today.getDate()
		);
		if (todayUtc - candidate > 90 * 86_400_000) y += 1;
	}
	// Reject 2/31 and friends rather than letting Date roll them over.
	const check = new Date(Date.UTC(y, m - 1, d));
	if (check.getUTCMonth() !== m - 1) return null;
	return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "7:00AM", "7:45 pm", "19:45" → "HH:mm"; "—" / "-" / "" → null. */
export function parseTime(raw: string): string | null | undefined {
	const value = raw.trim();
	if (!value || /^[—–-]+$/.test(value)) return null;
	const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
	if (!match) return undefined;
	let hours = Number(match[1]);
	const minutes = Number(match[2] ?? '0');
	const meridiem = match[3]?.toLowerCase();
	if (meridiem) {
		if (hours < 1 || hours > 12) return undefined;
		if (meridiem === 'pm' && hours !== 12) hours += 12;
		if (meridiem === 'am' && hours === 12) hours = 0;
	}
	if (hours > 23 || minutes > 59) return undefined;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseCode(raw: string): { number: number; code: string } | null {
	const match = raw.trim().match(/^BW\s*(\d+)\s+([A-Za-z]+)$/i);
	return match
		? { number: Number(match[1]), code: match[2].toUpperCase() }
		: null;
}

/**
 * Parse a pasted list. Paragraphs (separated by blank lines) are one language
 * each: a paragraph where most event lines hold Chinese is zh_tw, otherwise en
 * — so one Chinese venue name doesn't flip an English list. Lines
 * that are not event lines ("OR", headings) are ignored; event lines with no
 * date are skipped.
 */
export function parseEventText(text: string, today = new Date()): ImportResult {
	const lines: ImportLine[] = [];
	const skipped: ImportResult['skipped'] = [];

	for (const paragraph of text.split(/\n\s*\n/)) {
		const eventLines = paragraph
			.split('\n')
			.filter((line) => /BW\s*\d+/.test(line));
		const cjkLines = eventLines.filter((line) => CJK.test(line)).length;
		const lang: ImportLang = cjkLines * 2 > eventLines.length ? 'zh_tw' : 'en';
		for (const rawLine of paragraph.split('\n')) {
			const source = rawLine.trim();
			let rest = source.replace(BULLET, '');
			if (!/BW\s*\d+/.test(rest)) continue;

			const dateMatch = rest.match(DATE_PREFIX);
			const date = dateMatch
				? resolveDate(dateMatch[1], dateMatch[2], dateMatch[3], today)
				: null;
			// The bullet may follow the date: "10/31 • BW 183 …".
			if (dateMatch) rest = rest.slice(dateMatch[0].length).replace(BULLET, '');

			const event = rest.match(EVENT_LINE);
			if (!event) {
				skipped.push({ source, reason: 'Could not read this line.' });
				continue;
			}
			if (!date) {
				skipped.push({ source, reason: 'No date.' });
				continue;
			}
			const time = parseTime(event[3]);
			if (time === undefined) {
				skipped.push({ source, reason: `Unreadable time "${event[3]}".` });
				continue;
			}
			lines.push({
				source,
				lang,
				date,
				time,
				number: Number(event[1]),
				code: event[2].toUpperCase(),
				subtitle: event[4],
				location: event[5],
			});
		}
	}

	return { rows: mergeLines(lines), skipped };
}

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF, a BOM. */
export function readCsv(text: string): string[][] {
	const records: string[][] = [];
	let record: string[] = [];
	let field = '';
	let quoted = false;
	const input = text.replace(/^\uFEFF/, '');

	for (let i = 0; i < input.length; i++) {
		const char = input[i];
		if (quoted) {
			if (char === '"' && input[i + 1] === '"') {
				field += '"';
				i++;
			} else if (char === '"') {
				quoted = false;
			} else {
				field += char;
			}
		} else if (char === '"') {
			quoted = true;
		} else if (char === ',') {
			record.push(field);
			field = '';
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && input[i + 1] === '\n') i++;
			record.push(field);
			records.push(record);
			record = [];
			field = '';
		} else {
			field += char;
		}
	}
	if (field || record.length) {
		record.push(field);
		records.push(record);
	}
	return records.filter((r) => r.some((cell) => cell.trim()));
}

export const CSV_COLUMNS = [
	'date',
	'title',
	'time',
	'subtitle_en',
	'subtitle_zh',
	'location_en',
	'location_zh',
] as const;

/**
 * Parse a CSV with a header row naming the columns in `CSV_COLUMNS` (any
 * order, case-insensitive). `title` is the code, e.g. "BW 183 SRP"; `date` is
 * 2026-10-31 or 10/31. Rows with no date are skipped.
 */
export function parseEventCsv(text: string, today = new Date()): ImportResult {
	const [header, ...records] = readCsv(text);
	const skipped: ImportResult['skipped'] = [];
	if (!header) return { rows: [], skipped };

	const index = Object.fromEntries(
		header.map((name, i) => [name.trim().toLowerCase(), i])
	);
	const missing = ['date', 'title'].filter((name) => !(name in index));
	if (missing.length) {
		throw new Error(
			`CSV is missing the ${missing.join(' and ')} column. Expected a header row: ${CSV_COLUMNS.join(',')}`
		);
	}
	const cell = (record: string[], name: string) =>
		(index[name] === undefined ? '' : (record[index[name]] ?? '')).trim();

	const lines: ImportLine[] = [];
	for (const record of records) {
		const source = record.join(',');
		const code = parseCode(cell(record, 'title'));
		if (!code) {
			skipped.push({ source, reason: 'Title is not like "BW 183 SRP".' });
			continue;
		}
		const dateMatch = cell(record, 'date').match(DATE_PREFIX);
		const date = dateMatch
			? resolveDate(dateMatch[1], dateMatch[2], dateMatch[3], today)
			: null;
		if (!date) {
			skipped.push({ source, reason: 'No date.' });
			continue;
		}
		const time = parseTime(cell(record, 'time'));
		if (time === undefined) {
			skipped.push({
				source,
				reason: `Unreadable time "${cell(record, 'time')}".`,
			});
			continue;
		}
		const before = lines.length;
		for (const lang of LANGS) {
			const suffix = lang === 'en' ? 'en' : 'zh';
			const subtitle = cell(record, `subtitle_${suffix}`);
			const location = cell(record, `location_${suffix}`);
			if (!subtitle && !location) continue;
			lines.push({ source, lang, date, time, ...code, subtitle, location });
		}
		if (lines.length === before) {
			skipped.push({ source, reason: 'No subtitle or location.' });
		}
	}
	return { rows: mergeLines(lines), skipped };
}

/**
 * Pair each event's language copies into one row. A language that is missing
 * takes the other's text, which is how the existing events are stored.
 */
function mergeLines(lines: ImportLine[]): ImportRow[] {
	const byNumber = new Map<number, ImportLine[]>();
	for (const line of lines) {
		byNumber.set(line.number, [...(byNumber.get(line.number) ?? []), line]);
	}

	return [...byNumber.values()].map((group) => {
		const [first] = group;
		const errors: string[] = [];
		const pick = (lang: ImportLang) => group.filter((l) => l.lang === lang);

		for (const lang of LANGS) {
			if (pick(lang).length > 1) {
				errors.push(`BW ${first.number} appears twice in ${lang}.`);
			}
		}
		for (const key of ['code', 'date', 'time'] as const) {
			const values = new Set(group.map((l) => l[key] ?? '—'));
			if (values.size > 1) {
				errors.push(
					`Languages disagree on ${key}: ${[...values].join(' vs ')}.`
				);
			}
		}

		const text = (field: 'subtitle' | 'location') => {
			const en = pick('en')[0]?.[field] ?? '';
			const zh = pick('zh_tw')[0]?.[field] ?? '';
			return { en: en || zh, zh_tw: zh || en };
		};

		return {
			number: first.number,
			code: first.code,
			title: `BW ${first.number} ${first.code}`,
			// What the Studio's slugify makes of the title, so a slug generated
			// there is recognised as taken.
			slug: `bw-${first.number}-${first.code.toLowerCase()}`,
			date: first.date,
			time: first.time,
			subtitle: text('subtitle'),
			location: text('location'),
			errors,
		};
	});
}

const normalizeName = (name: string) =>
	name
		.toLowerCase()
		.replace(/臺/g, '台')
		.replace(/[’‘`]/g, "'")
		.replace(/[\s.。]/g, '');

/** A saved venue whose name matches the row's location in either language. */
export function matchLocation(
	row: Pick<ImportRow, 'location'>,
	locations: { _id: string; name?: I18nValue[] | null }[]
): string | null {
	const wanted = new Set(
		Object.values(row.location).filter(Boolean).map(normalizeName)
	);
	const found = locations.find((loc) =>
		(loc.name ?? []).some(
			(item) => item.value && wanted.has(normalizeName(item.value))
		)
	);
	return found?._id ?? null;
}

/**
 * The category for a code. Categories carry their code in the title — "Sunrise
 * Program (SRP)" — so that is matched first, then the slug ("srp", "rr").
 */
export function matchCategory(
	code: string,
	categories: {
		_id: string;
		title?: I18nValue[] | null;
		slug?: string | null;
	}[]
): string | null {
	const upper = code.toUpperCase();
	const found =
		categories.find((cat) =>
			(cat.title ?? []).some((item) =>
				item.value?.toUpperCase().includes(`(${upper})`)
			)
		) ??
		categories.find((cat) => cat.slug?.toLowerCase() === code.toLowerCase());
	return found?._id ?? null;
}

type I18nString = {
	_key: string;
	_type: 'internationalizedArrayStringValue';
	language: ImportLang;
	value: string;
}[];
type Reference = { _key?: string; _type: 'reference'; _ref: string };

export type EventDraft = {
	_id: string;
	_type: 'pEvent';
	title: I18nString;
	subtitle: I18nString;
	slug: { _type: 'slug'; current: string };
	format: 'single';
	eventDatetime: ReturnType<typeof toRichDate>;
	dateStatus: 'confirmed' | 'tba';
	locationRef?: Reference;
	location?: I18nString;
	categories?: Required<Reference>[];
};

const i18nString = (values: Record<ImportLang, string>): I18nString =>
	LANGS.filter((lang) => values[lang]).map((lang) => ({
		_key: newArrayKey(),
		_type: 'internationalizedArrayStringValue',
		language: lang,
		value: values[lang],
	}));

/** The `richDate` for a civil date and time in the club's timezone. */
export function toRichDate(date: string, time: string | null) {
	const timezone = FALLBACK_TIMEZONE;
	const instant = fromZonedTime(`${date}T${time ?? '00:00'}:00`, timezone);
	const local = formatInTimeZone(instant, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
	const [, sign, hh, mm] = local.match(/([+-])(\d{2}):(\d{2})$/) ?? [];
	const offset = sign
		? (sign === '-' ? -1 : 1) * (Number(hh) * 60 + Number(mm))
		: 0;
	return {
		_type: 'richDate' as const,
		local,
		utc: instant.toISOString(),
		timezone,
		offset,
	};
}

/**
 * The draft `pEvent` for a row. The venue becomes a `locationRef` when one is
 * saved, the one-off `location` text otherwise. An event with no time ("—")
 * is saved at midnight with its date marked TBA, so the site shows "TBA"
 * rather than a start time nobody set.
 */
export function buildEventDraft(
	row: ImportRow,
	refs: { locationId: string | null; categoryId: string | null }
): EventDraft {
	return {
		// Not randomUUID — see sanity-key.ts for why it can be undefined here.
		_id: `drafts.${newArrayKey()}${newArrayKey()}`,
		_type: 'pEvent',
		title: i18nString({ en: row.title, zh_tw: row.title }),
		subtitle: i18nString(row.subtitle),
		slug: { _type: 'slug', current: row.slug },
		format: 'single',
		eventDatetime: toRichDate(row.date, row.time),
		dateStatus: row.time ? 'confirmed' : 'tba',
		...(refs.locationId
			? { locationRef: { _type: 'reference', _ref: refs.locationId } }
			: { location: i18nString(row.location) }),
		...(refs.categoryId
			? {
					categories: [
						{ _key: newArrayKey(), _type: 'reference', _ref: refs.categoryId },
					],
				}
			: {}),
	};
}
