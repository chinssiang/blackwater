import { describe, expect, it } from 'vitest';
import defineBreadcrumbJsonLd from './defineBreadcrumbJsonLd';

// The value vitest.config.ts puts in the environment — deliberately not the
// production domain, so an assertion here cannot be satisfied by a builder
// falling back to its own hardcoded default.
const siteUrl = 'https://example.test';

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
			item: `${siteUrl}/`,
		});
		expect(items[2]).toMatchObject({
			position: 3,
			item: `${siteUrl}/events/race-1`,
		});
	});
});
