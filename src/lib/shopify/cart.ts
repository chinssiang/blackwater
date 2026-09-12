import { type Locale } from '@/lib/i18n';
import { isShopifyConfigured, shopifyStorefrontFetch } from './client';
import {
	LOCALE_SHOPIFY_CONTEXT,
	type ShopifyCart,
	type ShopifyCartLine,
	type ShopifyMoney,
} from './types';

// Server-side Shopify cart operations. Unlike product.ts these do NOT soft-fail:
// a cart is the shopper's own state, and silently swallowing an error would show
// them a stale cart that disagrees with what they'll be charged. Callers (the
// API route) surface failures instead.

const MONEY_FRAGMENT = `{ amount currencyCode }`;

// Every operation returns the whole cart so the client always renders from one
// authoritative snapshot — no local reconciliation of quantities or totals.
const CART_FRAGMENT = `
	id
	checkoutUrl
	totalQuantity
	cost {
		subtotalAmount ${MONEY_FRAGMENT}
	}
	lines(first: 100) {
		nodes {
			id
			quantity
			cost {
				totalAmount ${MONEY_FRAGMENT}
				amountPerQuantity ${MONEY_FRAGMENT}
			}
			merchandise {
				... on ProductVariant {
					id
					title
					availableForSale
					price ${MONEY_FRAGMENT}
					image { url altText }
					product { title handle }
				}
			}
		}
	}
`;

// Shopify's mutation payloads all carry userErrors; a mutation can return HTTP
// 200 with a null cart and an error there (e.g. an unpurchasable variant).
//
// `warnings` is the non-fatal counterpart, and the only way this integration
// can learn about stock: asking for 500 of a variant with 3 on hand succeeds
// with quantity 3 plus a MERCHANDISE_NOT_ENOUGH_STOCK warning whose `target` is
// the cart line's GID. Reading `quantityAvailable` up front would need the
// `unauthenticated_read_product_inventory` scope, which this token lacks.
const USER_ERRORS = `userErrors { field message }`;
const WARNINGS = `warnings { code target }`;

const NOT_ENOUGH_STOCK = 'MERCHANDISE_NOT_ENOUGH_STOCK';

/**
 * The cart a mutation addressed no longer exists. Distinguished from every
 * other failure because it is a normal end of life — carts die after ~10 days
 * idle while the cookie holding the id outlives them — not an outage: the route
 * turns it into a 409 and drops the stale cookie rather than a 502 the shopper
 * would retry forever.
 */
export class CartNotFoundError extends Error {
	constructor(operation: string) {
		super(`Shopify ${operation} returned no cart`);
		this.name = 'CartNotFoundError';
	}
}

type GqlCart = {
	id: string;
	checkoutUrl: string;
	totalQuantity: number;
	cost: { subtotalAmount: ShopifyMoney };
	lines: {
		nodes: Array<{
			id: string;
			quantity: number;
			cost: { totalAmount: ShopifyMoney; amountPerQuantity: ShopifyMoney };
			merchandise: {
				id: string;
				title: string;
				availableForSale: boolean;
				price: ShopifyMoney;
				image: { url: string; altText: string | null } | null;
				product: { title: string; handle: string };
			} | null;
		}>;
	};
};

type GqlCartPayload = {
	cart: GqlCart | null;
	userErrors: Array<{ field: string[] | null; message: string }>;
	warnings?: Array<{ code: string; target: string | null }>;
};

export type CartLineInput = {
	merchandiseId: string;
	quantity: number;
};

function normalizeCart(
	cart: GqlCart,
	/** Cart-line GIDs Shopify capped at available stock on this request. */
	stockCapped: ReadonlySet<string> = new Set()
): ShopifyCart {
	return {
		id: cart.id,
		checkoutUrl: cart.checkoutUrl,
		totalQuantity: cart.totalQuantity,
		subtotal: cart.cost.subtotalAmount,
		lines: cart.lines.nodes.flatMap<ShopifyCartLine>((line) => {
			// `merchandise` is a union; anything that isn't a ProductVariant (gift
			// cards, future types) selects to null rather than failing the query.
			if (!line.merchandise) return [];
			return [
				{
					id: line.id,
					quantity: line.quantity,
					total: line.cost.totalAmount,
					unitPrice: line.cost.amountPerQuantity,
					atStockLimit: stockCapped.has(line.id),
					merchandise: {
						gid: line.merchandise.id,
						title: line.merchandise.title,
						availableForSale: line.merchandise.availableForSale,
						price: line.merchandise.price,
						imageUrl: line.merchandise.image?.url ?? null,
						imageAlt: line.merchandise.image?.altText ?? null,
						productTitle: line.merchandise.product.title,
						productHandle: line.merchandise.product.handle,
					},
				},
			];
		}),
	};
}

/**
 * Every cart request is per-shopper and must never enter Next's fetch cache or
 * carry the `shopify` revalidation tags — a cached cart would leak one
 * shopper's lines to the next.
 */
function cartFetch<T>(query: string, variables: Record<string, unknown>) {
	return shopifyStorefrontFetch<T>({ query, variables, cache: 'no-store' });
}

function unwrap(payload: GqlCartPayload | null, operation: string): ShopifyCart {
	if (payload?.userErrors.length) {
		// An unknown or expired cart comes back as a userError against `cartId`
		// ("The specified cart does not exist"). Match on the field rather than
		// the message, which isn't a stable contract.
		//
		// This branch must stay *above* the cart check: Shopify pairs that error
		// with a freshly minted cart of its own in `cart`, so treating a
		// non-null cart as success would silently swap the shopper onto a new
		// empty cart and persist its id to their cookie.
		if (payload.userErrors.some((e) => e.field?.includes('cartId'))) {
			throw new CartNotFoundError(operation);
		}
		throw new Error(
			`Shopify ${operation} rejected: ${payload.userErrors
				.map((e) => e.message)
				.join('; ')}`
		);
	}
	if (!payload?.cart) {
		throw new CartNotFoundError(operation);
	}
	const stockCapped = new Set(
		(payload.warnings ?? [])
			.filter((w) => w.code === NOT_ENOUGH_STOCK)
			.map((w) => w.target)
			.filter((target): target is string => Boolean(target))
	);
	return normalizeCart(payload.cart, stockCapped);
}

const GET_CART_QUERY = `
	query GetCart($id: ID!) {
		cart(id: $id) { ${CART_FRAGMENT} }
	}
`;

/**
 * Reads an existing cart. Returns null when the id is unknown or expired —
 * Shopify drops carts after roughly 10 days of inactivity, so a stored cookie
 * routinely outlives the cart it points at. Callers treat null as "start a new
 * cart", not as an error.
 */
export async function getCart(cartId: string): Promise<ShopifyCart | null> {
	if (!isShopifyConfigured()) return null;
	const data = await cartFetch<{ cart: GqlCart | null }>(GET_CART_QUERY, {
		id: cartId,
	});
	return data.cart ? normalizeCart(data.cart) : null;
}

const CREATE_CART_MUTATION = `
	mutation CreateCart($lines: [CartLineInput!]!, $country: CountryCode) {
		cartCreate(input: { lines: $lines, buyerIdentity: { countryCode: $country } }) {
			cart { ${CART_FRAGMENT} }
			${USER_ERRORS}
			${WARNINGS}
		}
	}
`;

/**
 * Creates a cart and pins its market once, via buyerIdentity.countryCode.
 *
 * Note the asymmetry with product.ts: those queries carry `@inContext` on every
 * call, but cart operations deliberately do not. A cart stores its own buyer
 * identity, and reading it back under a different country than it was created
 * with is a mismatch error — which is exactly what would happen the moment a
 * shopper switched language mid-session. Pinning the market at creation also
 * means the currency can't change underneath a cart that already has lines in
 * it. `en` maps to no country and so resolves to the store's default market.
 */
export async function createCart(
	lines: CartLineInput[],
	locale: Locale
): Promise<ShopifyCart> {
	const data = await cartFetch<{ cartCreate: GqlCartPayload }>(
		CREATE_CART_MUTATION,
		{ lines, country: LOCALE_SHOPIFY_CONTEXT[locale]?.country ?? null }
	);
	return unwrap(data.cartCreate, 'cartCreate');
}

const ADD_LINES_MUTATION = `
	mutation AddCartLines($cartId: ID!, $lines: [CartLineInput!]!) {
		cartLinesAdd(cartId: $cartId, lines: $lines) {
			cart { ${CART_FRAGMENT} }
			${USER_ERRORS}
			${WARNINGS}
		}
	}
`;

export async function addCartLines(
	cartId: string,
	lines: CartLineInput[]
): Promise<ShopifyCart> {
	const data = await cartFetch<{ cartLinesAdd: GqlCartPayload }>(
		ADD_LINES_MUTATION,
		{ cartId, lines }
	);
	return unwrap(data.cartLinesAdd, 'cartLinesAdd');
}

const UPDATE_LINES_MUTATION = `
	mutation UpdateCartLines($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
		cartLinesUpdate(cartId: $cartId, lines: $lines) {
			cart { ${CART_FRAGMENT} }
			${USER_ERRORS}
			${WARNINGS}
		}
	}
`;

export async function updateCartLine(
	cartId: string,
	lineId: string,
	quantity: number
): Promise<ShopifyCart> {
	const data = await cartFetch<{ cartLinesUpdate: GqlCartPayload }>(
		UPDATE_LINES_MUTATION,
		{ cartId, lines: [{ id: lineId, quantity }] }
	);
	return unwrap(data.cartLinesUpdate, 'cartLinesUpdate');
}

const REMOVE_LINES_MUTATION = `
	mutation RemoveCartLines($cartId: ID!, $lineIds: [ID!]!) {
		cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
			cart { ${CART_FRAGMENT} }
			${USER_ERRORS}
			${WARNINGS}
		}
	}
`;

export async function removeCartLine(
	cartId: string,
	lineId: string
): Promise<ShopifyCart> {
	const data = await cartFetch<{ cartLinesRemove: GqlCartPayload }>(
		REMOVE_LINES_MUTATION,
		{ cartId, lineIds: [lineId] }
	);
	return unwrap(data.cartLinesRemove, 'cartLinesRemove');
}
