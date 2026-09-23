import { describe, expect, it } from 'vitest';
import { isLumaEventUrl } from '@/lib/luma';

// `pEvent.lumaUrl` is a join key, not a link anyone clicks: it is what lets a
// Luma guest export be matched to the Sanity event it belongs to. So the test
// is "would this identify a Luma event", which is stricter than "is this a URL".
describe('isLumaEventUrl', () => {
	it('accepts the short lu.ma link Luma hands out for sharing', () => {
		expect(isLumaEventUrl('https://lu.ma/midweek-reset')).toBe(true);
	});

	it('accepts the luma.com form of the same link', () => {
		expect(isLumaEventUrl('https://luma.com/midweek-reset')).toBe(true);
		expect(isLumaEventUrl('https://www.luma.com/midweek-reset')).toBe(true);
	});

	it('accepts the host-side manage URL an editor may copy instead', () => {
		expect(isLumaEventUrl('https://luma.com/event/manage/evt-AbC123xYz')).toBe(
			true
		);
	});

	it('accepts a link that still carries tracking parameters', () => {
		expect(
			isLumaEventUrl('https://lu.ma/midweek-reset?utm_source=instagram')
		).toBe(true);
	});

	it('rejects the Luma homepage, which names no event', () => {
		expect(isLumaEventUrl('https://luma.com')).toBe(false);
		expect(isLumaEventUrl('https://luma.com/')).toBe(false);
	});

	it('rejects plain http', () => {
		expect(isLumaEventUrl('http://lu.ma/midweek-reset')).toBe(false);
	});

	it('rejects hosts that merely contain the Luma name', () => {
		// A substring or suffix test would let both of these through.
		expect(isLumaEventUrl('https://lu.ma.example.com/midweek-reset')).toBe(
			false
		);
		expect(isLumaEventUrl('https://notluma.com/midweek-reset')).toBe(false);
	});

	it('rejects a registration link from another platform', () => {
		// The mistake this guards against: pasting the event's existing
		// registration link from the status list, which may not be Luma at all.
		expect(isLumaEventUrl('https://www.eventbrite.com/e/12345')).toBe(false);
	});

	it('rejects something that is not a URL', () => {
		expect(isLumaEventUrl('midweek-reset')).toBe(false);
		expect(isLumaEventUrl('')).toBe(false);
	});
});
