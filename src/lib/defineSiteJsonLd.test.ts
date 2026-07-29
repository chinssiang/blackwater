import { describe, expect, it } from 'vitest';
import defineSiteJsonLd from './defineSiteJsonLd';

const siteUrl = 'https://blackwaterrc.com';

describe('defineSiteJsonLd', () => {
	it('returns null without a site title', () => {
		expect(defineSiteJsonLd({ sharing: null, siteUrl })).toBeNull();
		expect(defineSiteJsonLd({ sharing: {}, siteUrl })).toBeNull();
	});

	it('emits an Organization + WebSite graph with stable @ids', () => {
		const ld = defineSiteJsonLd({
			sharing: { siteTitle: 'Blackwater RC' },
			siteUrl,
		});
		const graph = (ld as { '@graph': any[] })['@graph'];
		const [org, website] = graph;
		expect(org['@type']).toEqual(['Organization', 'SportsOrganization']);
		expect(org['@id']).toBe(`${siteUrl}#organization`);
		expect(org.sport).toBe('Running');
		expect(org.knowsLanguage).toEqual(['en', 'zh-TW']);
		expect(website['@type']).toBe('WebSite');
		expect(website['@id']).toBe(`${siteUrl}#website`);
		// WebSite references the Organization as publisher.
		expect(website.publisher).toEqual({ '@id': `${siteUrl}#organization` });
	});

	it('includes optional fields only when present', () => {
		const ld = defineSiteJsonLd({
			sharing: {
				siteTitle: 'Blackwater RC',
				alternateName: 'BWRC',
				areaServed: 'Taiwan',
				contactEmail: 'hi@blackwaterrc.com',
				socialLinks: [
					{ url: 'https://instagram.com/bwrc' },
					{ url: '  ' },
					{ url: null },
				],
				address: { addressLocality: 'Taipei', streetAddress: '  ' },
			},
			siteUrl,
		});
		const org = (ld as { '@graph': any[] })['@graph'][0];
		expect(org.alternateName).toBe('BWRC');
		expect(org.areaServed).toBe('Taiwan');
		// Empty/blank social urls are filtered out.
		expect(org.sameAs).toEqual(['https://instagram.com/bwrc']);
		expect(org.contactPoint).toMatchObject({
			'@type': 'ContactPoint',
			email: 'hi@blackwaterrc.com',
		});
		// Blank address fields are dropped; only the locality survives.
		expect(org.address).toEqual({
			'@type': 'PostalAddress',
			addressLocality: 'Taipei',
		});
	});

	it('adds inLanguage to the WebSite when a locale is given', () => {
		const ld = defineSiteJsonLd({
			sharing: { siteTitle: 'Blackwater RC' },
			siteUrl,
			locale: 'zh_tw',
		});
		const website = (ld as { '@graph': any[] })['@graph'][1];
		expect(website.inLanguage).toBe('zh-TW');
	});
});
