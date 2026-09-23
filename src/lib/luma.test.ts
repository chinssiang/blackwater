import { describe, expect, it } from 'vitest';
import { normalizeLumaEventUrl } from '@/lib/luma';

// `pEvent.lumaUrl` is a join key, not a link anyone clicks: it is what lets a
// Luma guest list be matched to the Sanity event it belongs to. So the test is
// "would this identify ONE Luma event, spelled one way", which is stricter
// than "is this a URL".
describe('normalizeLumaEventUrl', () => {
	it('gives every spelling of one event the same key', () => {
		const spellings = [
			'https://lu.ma/midweek-reset',
			'https://luma.com/midweek-reset',
			'https://www.luma.com/midweek-reset',
			'https://www.lu.ma/midweek-reset',
			'https://lu.ma/midweek-reset/',
			'https://lu.ma/midweek-reset?utm_source=instagram',
			'https://luma.com/midweek-reset#details',
		];
		expect(new Set(spellings.map(normalizeLumaEventUrl))).toEqual(
			new Set(['https://luma.com/midweek-reset'])
		);
	});

	it('keeps different events apart', () => {
		expect(normalizeLumaEventUrl('https://lu.ma/midweek-reset')).not.toBe(
			normalizeLumaEventUrl('https://lu.ma/sunday-long-run')
		);
	});

	it('refuses the host manage URL, whose evt- id no public link can match', () => {
		expect(
			normalizeLumaEventUrl('https://luma.com/event/manage/evt-AbC123xYz')
		).toBeNull();
	});

	it('refuses the Luma homepage, which names no event', () => {
		expect(normalizeLumaEventUrl('https://luma.com')).toBeNull();
		expect(normalizeLumaEventUrl('https://luma.com/')).toBeNull();
	});

	it('refuses plain http', () => {
		expect(normalizeLumaEventUrl('http://lu.ma/midweek-reset')).toBeNull();
	});

	it('refuses hosts that merely contain the Luma name', () => {
		// A substring or suffix test would let both of these through.
		expect(
			normalizeLumaEventUrl('https://lu.ma.example.com/midweek-reset')
		).toBeNull();
		expect(
			normalizeLumaEventUrl('https://notluma.com/midweek-reset')
		).toBeNull();
	});

	it('refuses a registration link from another platform', () => {
		// The mistake this guards against: pasting the event's existing
		// registration link from the status list, which may not be Luma at all.
		expect(
			normalizeLumaEventUrl('https://www.eventbrite.com/e/12345')
		).toBeNull();
	});

	it('refuses something that is not a URL', () => {
		expect(normalizeLumaEventUrl('midweek-reset')).toBeNull();
		expect(normalizeLumaEventUrl('')).toBeNull();
	});
});
