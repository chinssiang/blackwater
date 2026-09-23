import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

// The matcher is a path-to-regexp string, but this one is plain regex syntax
// throughout, and Next anchors it at both ends -- so anchoring it here tests
// the same pattern without reaching into Next's untyped build internals.
const matcher = new RegExp(`^${config.matcher[0]}$`);

const rewriteOf = (path: string) =>
	proxy(new NextRequest(`http://localhost${path}`)).headers.get(
		'x-middleware-rewrite'
	);

describe('proxy matcher', () => {
	it('skips the API, the Studio and dotted files', () => {
		for (const path of [
			'/api',
			'/api/weather',
			'/sanity',
			'/sanity/structure',
			'/sitemap.xml',
		]) {
			expect(matcher.test(path), path).toBe(false);
		}
	});

	it('still runs for pages that merely START with those prefixes', () => {
		// Unanchored, `api|sanity` sent these past the proxy and they hard-404ed
		// in [locale] instead of getting the default-locale rewrite.
		for (const path of ['/apiary', '/api-docs', '/sanity-check', '/about']) {
			expect(matcher.test(path), path).toBe(true);
		}
	});
});

describe('proxy', () => {
	it('passes the module-preview frames through without a locale rewrite', () => {
		expect(rewriteOf('/module-preview/en/heroBlock')).toBeNull();
		expect(rewriteOf('/module-preview/zh_tw/heroBlock')).toBeNull();
	});

	it('still rewrites a page that only shares the prefix', () => {
		expect(rewriteOf('/module-previews')).toBe(
			'http://localhost/en/module-previews'
		);
		expect(rewriteOf('/apiary')).toBe('http://localhost/en/apiary');
	});
});
