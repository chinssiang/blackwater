import { describe, it, expect } from 'vitest';
import { vercelStegaCombine } from '@vercel/stega';
import { buildEventName } from './buildEventName';

// 07:00 on the 5th in Taipei, which is still the 4th in UTC and in the suite's
// own TZ (America/Los_Angeles) — so a date resolved in the runtime timezone
// rather than the event's shows up here as an off-by-one day.
const UTC = '2026-09-04T23:00:00Z';
const TZ = 'Asia/Taipei';

describe('buildEventName', () => {
	it('dates the event in its own stored timezone', () => {
		expect(
			buildEventName(
				{
					title: 'BW-134-rr',
					location: 'Daan Forest Park',
					eventDatetime: UTC,
					timezone: TZ,
				},
				'en'
			)
		).toBe('BW-134-rr · Daan Forest Park · Sep 5, 2026');
	});

	it('falls back rather than throwing on a timezone Intl cannot use', () => {
		// This runs inside JSON-LD generation, so the `RangeError` a stored
		// `GMT+8` used to raise took the whole page down rather than costing one
		// structured-data field.
		expect(
			buildEventName(
				{ title: 'BW-134-rr', eventDatetime: UTC, timezone: 'GMT+8' },
				'en'
			)
		).toBe('BW-134-rr · Sep 5, 2026');
	});

	it('survives a draft-mode stega-encoded timezone', () => {
		// Both JSON-LD call sites clean their data first, so this is belt and
		// braces — but the helper is shared, and nothing stops the next caller
		// from passing a raw row.
		const encoded = vercelStegaCombine(TZ, {
			origin: 'sanity.io',
			href: '/studio',
		});
		expect(
			buildEventName(
				{ title: 'BW-134-rr', eventDatetime: UTC, timezone: encoded },
				'en'
			)
		).toBe('BW-134-rr · Sep 5, 2026');
	});

	it('leaves the date off when there is none', () => {
		expect(
			buildEventName({ title: 'BW-134-rr', subtitle: 'Road Race' }, 'en')
		).toBe('BW-134-rr — Road Race');
	});
});
