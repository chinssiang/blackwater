import { describe, it, expect } from 'vitest';
import { vercelStegaCombine } from '@vercel/stega';
import en from '@/dictionaries/en.json';
import zhTw from '@/dictionaries/zh_tw.json';
import { resolveEventDateStatus } from '@/lib/event-status';

// The single gate every surface shares for "is this date real, and what do we
// show when it is not". Before it was extracted, /events, the event page and
// the ticket stub each spelled the predicate out and were free to drift -- and
// two of them printed the raw English schema value in both locales.
describe('resolveEventDateStatus', () => {
	const t = en.events;

	describe('isFirm', () => {
		it('treats an unset status as confirmed', () => {
			// Most events carry no dateStatus at all; they must still show a date.
			expect(resolveEventDateStatus(undefined, t).isFirm).toBe(true);
			expect(resolveEventDateStatus(null, t).isFirm).toBe(true);
		});

		it('accepts the confirmed status', () => {
			expect(resolveEventDateStatus('confirmed', t).isFirm).toBe(true);
		});

		it('rejects every status that means the date is not real', () => {
			expect(resolveEventDateStatus('tba', t).isFirm).toBe(false);
			expect(resolveEventDateStatus('postponed', t).isFirm).toBe(false);
			expect(resolveEventDateStatus('cancelled', t).isFirm).toBe(false);
		});

		it('rejects an unrecognised status rather than assuming it is firm', () => {
			// A schema value added later must not start rendering a date until
			// someone decides it should.
			expect(resolveEventDateStatus('rescheduled', t).isFirm).toBe(false);
		});

		it('sees through the stega metadata draft mode encodes into the enum', () => {
			// This is the whole reason the clean lives here: in the Presentation
			// tool `=== 'confirmed'` is false for EVERY confirmed event, and the
			// date silently disappears from the page.
			const encoded = vercelStegaCombine('confirmed', { origin: 'sanity.io' });
			expect(encoded).not.toBe('confirmed');
			expect(resolveEventDateStatus(encoded, t).isFirm).toBe(true);
		});
	});

	describe('label', () => {
		it('translates the statuses the schema defines', () => {
			expect(resolveEventDateStatus('postponed', t).label).toBe(
				t.status.postponed
			);
			expect(resolveEventDateStatus('cancelled', t).label).toBe(
				t.status.cancelled
			);
		});

		it('uses the TBA wording for tba and for no status', () => {
			expect(resolveEventDateStatus('tba', t).label).toBe(t.status.tba);
			expect(resolveEventDateStatus(null, t).label).toBe(t.status.tba);
			expect(resolveEventDateStatus(undefined, t).label).toBe(t.status.tba);
		});

		it('never leaks a raw schema value into the page', () => {
			// The behaviour this replaced was `dateStatus || t.status.tba`, which
			// rendered an unmapped enum as its own untranslated identifier.
			expect(resolveEventDateStatus('rescheduled', t).label).toBe(t.status.tba);
		});

		it('resolves from the locale dictionary it is handed', () => {
			expect(resolveEventDateStatus('postponed', zhTw.events).label).toBe(
				zhTw.events.status.postponed
			);
		});
	});
});
