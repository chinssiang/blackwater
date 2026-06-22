import { describe, expect, it } from 'vitest';
import {
	DOCUMENT_ROUTES,
	buildDocumentHrefGroq,
	checkIfLinkIsActive,
	resolveHref,
	resolvedHrefGroq,
	shouldHideGlobalNewsletter,
} from './routes';

describe('resolveHref', () => {
	it('returns undefined when documentType is null', () => {
		expect(resolveHref({ documentType: null })).toBeUndefined();
	});

	it('resolves a non-slug route to its static path', () => {
		expect(resolveHref({ documentType: 'pHome' })).toBe('/');
		expect(resolveHref({ documentType: 'pContact' })).toBe('/contact');
	});

	it('appends the slug for slug-based routes', () => {
		expect(resolveHref({ documentType: 'pProduct', slug: 'cap' })).toBe(
			'/products/cap'
		);
		expect(resolveHref({ documentType: 'pEvent', slug: 'race-1' })).toBe(
			'/events/race-1'
		);
	});

	it('falls back to /<slug> for unknown types that carry a slug', () => {
		expect(resolveHref({ documentType: 'somethingElse', slug: 'foo' })).toBe(
			'/foo'
		);
	});

	it('returns undefined for an unknown type without a slug', () => {
		expect(resolveHref({ documentType: 'somethingElse' })).toBeUndefined();
	});

	it('localizes the path for a non-default locale', () => {
		expect(resolveHref({ documentType: 'pHome', locale: 'zh_tw' })).toBe(
			'/zh_tw'
		);
		expect(
			resolveHref({ documentType: 'pProduct', slug: 'cap', locale: 'zh_tw' })
		).toBe('/zh_tw/products/cap');
	});

	it('does not prefix the default locale', () => {
		expect(resolveHref({ documentType: 'pContact', locale: 'en' })).toBe(
			'/contact'
		);
	});
});

describe('checkIfLinkIsActive', () => {
	it('returns false when either path or url is missing', () => {
		expect(checkIfLinkIsActive({ pathName: '', url: '/foo' })).toBe(false);
		expect(checkIfLinkIsActive({ pathName: '/foo', url: '' })).toBe(false);
	});

	it('only activates the home link on the home page', () => {
		expect(checkIfLinkIsActive({ pathName: '/', url: '/' })).toBe(true);
		expect(checkIfLinkIsActive({ pathName: '/products', url: '/' })).toBe(
			false
		);
	});

	it('keeps a section link active on descendant routes', () => {
		expect(
			checkIfLinkIsActive({ pathName: '/products/cap', url: '/products' })
		).toBe(true);
		expect(
			checkIfLinkIsActive({ pathName: '/products', url: '/products' })
		).toBe(true);
	});

	it('matches child links exactly and not their descendants', () => {
		expect(
			checkIfLinkIsActive({
				pathName: '/products/cap',
				url: '/products',
				isChild: true,
			})
		).toBe(false);
		expect(
			checkIfLinkIsActive({
				pathName: '/products',
				url: '/products',
				isChild: true,
			})
		).toBe(true);
	});

	it('normalizes trailing slashes and locale prefixes before comparing', () => {
		// GROQ emits "/events/" while usePathname yields "/events".
		expect(
			checkIfLinkIsActive({ pathName: '/events', url: '/events/' })
		).toBe(true);
		// Locale prefix on the current path should still match an unprefixed url.
		expect(
			checkIfLinkIsActive({ pathName: '/zh_tw/events', url: '/events' })
		).toBe(true);
	});

	it('does not treat a sibling prefix as a descendant', () => {
		expect(
			checkIfLinkIsActive({ pathName: '/products-extra', url: '/products' })
		).toBe(false);
	});
});

describe('shouldHideGlobalNewsletter', () => {
	it('hides the newsletter on exempt paths', () => {
		expect(shouldHideGlobalNewsletter('/newsletter')).toBe(true);
		expect(shouldHideGlobalNewsletter('/events-crew')).toBe(true);
	});

	it('handles trailing slashes and locale prefixes', () => {
		expect(shouldHideGlobalNewsletter('/newsletter/')).toBe(true);
		expect(shouldHideGlobalNewsletter('/zh_tw/events-crew')).toBe(true);
	});

	it('shows the newsletter everywhere else', () => {
		expect(shouldHideGlobalNewsletter('/')).toBe(false);
		expect(shouldHideGlobalNewsletter('/products')).toBe(false);
	});
});

describe('buildDocumentHrefGroq', () => {
	it('builds a select() expression with a slug fallback and null default', () => {
		const groq = buildDocumentHrefGroq();
		expect(groq.startsWith('select(')).toBe(true);
		expect(groq).toContain('_type == "pProduct" => "/products/" + slug.current');
		expect(groq).toContain('defined(slug.current) => "/" + slug.current');
		expect(groq.trimEnd().endsWith('null)')).toBe(true);
	});

	it('respects a custom slug field name', () => {
		expect(buildDocumentHrefGroq('foo.slug')).toContain(
			'defined(foo.slug) => "/" + foo.slug'
		);
	});
});

describe('resolvedHrefGroq sync with DOCUMENT_ROUTES', () => {
	// Synthetic routes have no backing document, so they intentionally never
	// appear in the GROQ resolver. Keep this list in sync if more are added.
	const SYNTHETIC_TYPES = [
		'pProductCategoriesIndex',
		'pProductCollectionsIndex',
	];

	it.each(
		DOCUMENT_ROUTES.map((r) => r.type).filter(
			(type) => !SYNTHETIC_TYPES.includes(type)
		)
	)('includes a GROQ case for %s', (type) => {
		expect(resolvedHrefGroq).toContain(`_type == "${type}"`);
	});
});
