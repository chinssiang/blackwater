import { describe, expect, it } from 'vitest';
import defineBreadcrumbJsonLd from './defineBreadcrumbJsonLd';

describe('defineBreadcrumbJsonLd', () => {
	it('returns null when fewer than two valid crumbs remain', () => {
		expect(defineBreadcrumbJsonLd([])).toBeNull();
		expect(defineBreadcrumbJsonLd([{ name: 'Home', path: '/' }])).toBeNull();
		// Crumbs missing name or path are filtered out before the count check.
		expect(
			defineBreadcrumbJsonLd([
				{ name: 'Home', path: '/' },
				{ name: 'No path', path: null },
			])
		).toBeNull();
	});

	it('builds a 1-based BreadcrumbList with absolute item urls', () => {
		const ld = defineBreadcrumbJsonLd([
			{ name: 'Home', path: '/' },
			{ name: 'Events', path: '/events' },
			{ name: 'Race One', path: '/events/race-1' },
		]);
		expect(ld).toMatchObject({
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
		});
		const items = (ld as { itemListElement: any[] }).itemListElement;
		expect(items).toHaveLength(3);
		expect(items[0]).toMatchObject({
			'@type': 'ListItem',
			position: 1,
			name: 'Home',
			item: 'https://blackwaterrc.com/',
		});
		expect(items[2]).toMatchObject({
			position: 3,
			item: 'https://blackwaterrc.com/events/race-1',
		});
	});
});
