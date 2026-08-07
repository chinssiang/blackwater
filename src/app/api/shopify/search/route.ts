/**
 * Product search for the Studio's Shopify picker (ShopifyProductInput).
 * Proxies the Admin GraphQL API so the admin token never leaves the server —
 * needs a custom-app Admin token with the read_products scope in
 * SHOPIFY_ADMIN_API_TOKEN.
 *
 * The route is reachable without auth, so it returns only public catalog
 * facts (title, handle, status, thumbnail) capped at 10 results; the
 * same-origin check below turns away cross-site browser callers.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_VERSION_FALLBACK = '2026-01';
const MAX_RESULTS = 10;

const SEARCH_QUERY = `
	query StudioProductSearch($query: String!, $first: Int!) {
		products(first: $first, query: $query) {
			nodes {
				id
				handle
				title
				status
				featuredMedia {
					preview {
						image { url }
					}
				}
			}
		}
	}
`;

type GqlProductNode = {
	id: string;
	handle: string;
	title: string;
	status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
	featuredMedia: { preview: { image: { url: string } | null } | null } | null;
};

// Shopify search syntax treats quotes/backslashes/whitespace as structure;
// handles never legitimately contain them.
function sanitizeHandle(handle: string): string {
	return handle.replace(/["'\\\s]/g, '');
}

export async function GET(req: NextRequest) {
	const origin = req.headers.get('origin');
	if (origin && new URL(origin).host !== req.nextUrl.host) {
		return NextResponse.json({ ok: false }, { status: 403 });
	}

	const domain = process.env.SHOPIFY_STORE_DOMAIN;
	const token = process.env.SHOPIFY_ADMIN_API_TOKEN;
	if (!domain || !token) {
		return NextResponse.json(
			{ ok: false, message: 'Shopify admin search is not configured.' },
			{ status: 503 }
		);
	}

	const q = req.nextUrl.searchParams.get('q')?.trim().slice(0, 64);
	const handle = req.nextUrl.searchParams.get('handle')?.trim().slice(0, 200);
	const query = handle ? `handle:${sanitizeHandle(handle)}` : q;
	if (!query) {
		return NextResponse.json(
			{ ok: false, message: 'Missing q or handle parameter.' },
			{ status: 400 }
		);
	}

	const version = process.env.SHOPIFY_API_VERSION || API_VERSION_FALLBACK;
	try {
		const res = await fetch(
			`https://${domain}/admin/api/${version}/graphql.json`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Shopify-Access-Token': token,
				},
				body: JSON.stringify({
					query: SEARCH_QUERY,
					variables: { query, first: handle ? 1 : MAX_RESULTS },
				}),
				cache: 'no-store',
			}
		);
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			console.error('[shopify-search] HTTP', res.status, text.slice(0, 300));
			return NextResponse.json({ ok: false }, { status: 502 });
		}
		const json = (await res.json()) as {
			data?: { products?: { nodes?: GqlProductNode[] } };
			errors?: Array<{ message?: string }>;
		};
		if (json.errors?.length) {
			console.error('[shopify-search] GraphQL errors', json.errors);
			return NextResponse.json({ ok: false }, { status: 502 });
		}

		// admin.shopify.com addresses stores by the myshopify subdomain.
		const storeSubdomain = domain.replace(/\.myshopify\.com$/, '');
		const products = (json.data?.products?.nodes ?? []).map((node) => {
			const id = node.id.slice(node.id.lastIndexOf('/') + 1);
			return {
				id,
				handle: node.handle,
				title: node.title,
				status: node.status,
				imageUrl: node.featuredMedia?.preview?.image?.url ?? null,
				adminUrl: `https://admin.shopify.com/store/${storeSubdomain}/products/${id}`,
			};
		});
		return NextResponse.json({ ok: true, products });
	} catch (err) {
		console.error('[shopify-search] fetch error', err);
		return NextResponse.json({ ok: false }, { status: 502 });
	}
}
