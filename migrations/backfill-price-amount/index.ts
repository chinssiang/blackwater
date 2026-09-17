import { at, defineMigration, set } from 'sanity/migrate';
import type { NodePatch } from 'sanity/migrate';

/*
	Backfills the numeric `priceAmount` on pProduct from the free-text `price`
	string, so products can be sorted and filtered by price. Best-effort: takes the
	first number found in the string (e.g. "$1,299 or From $49/mo" -> 1299,
	"From $49/mo" -> 49). Review subscription / multi-price items afterwards.
	Values are New Taiwan Dollars. Idempotent: skips docs that already have a
	numeric priceAmount (including manual edits).

	KNOWN GAP, and it is the common case for a linked product rather than a rare
	one. `price` is the Sanity-side FALLBACK: p-product.ts requires it only while
	there is no Shopify link, and warns against filling it once there is ("Not
	shown while Shopify is reachable"). So a Shopify-linked product usually has
	no `price` for this to read, gets no priceAmount, and then silently drops out
	of every /products/all price bucket and sorts last under both price sorts —
	while its card shows a live Shopify price. This migration cannot close that:
	it runs inside the Sanity CLI with no Shopify access, and if `price` is empty
	there is no number in the dataset to convert. Every skip of that shape is
	logged below so the run reports them rather than passing silently; fill those
	in the Studio (the priceAmount field warns when empty), or derive them from
	Shopify — a `scripts/` script can, since scripts hold SANITY_READ_WRITE_TOKEN
	and can reach the Storefront API, which is the real fix.

	Run order (confirm the real prod dataset name first — prod vs production):
	  1. Ship the schema change (p-product.ts has priceAmount) + `npm run typegen`.
	  2. Dry-run:  npx sanity migration run backfill-price-amount
	  3. Apply:    npx sanity migration run backfill-price-amount --no-dry-run
	  4. Prod:     npx sanity migration run backfill-price-amount --no-dry-run --dataset <prod>
	  5. Validate: npx sanity documents validate -y
*/

function parsePrice(price: string): number | undefined {
	const match = price.replace(/,/g, '').match(/\d+(\.\d+)?/);
	if (!match) return undefined;
	const n = Number(match[0]);
	return Number.isFinite(n) ? n : undefined;
}

export default defineMigration({
	title: 'Backfill numeric priceAmount from free-text price',
	documentTypes: ['pProduct'],
	migrate: {
		document(doc): NodePatch[] | undefined {
			const d = doc as Record<string, unknown>;
			// Idempotent: never overwrite an existing numeric value.
			if (typeof d.priceAmount === 'number') return undefined;

			const amount =
				typeof d.price === 'string' ? parsePrice(d.price) : undefined;
			if (amount != null) return [at('priceAmount', set(amount))];

			// Left with no priceAmount. Named rather than skipped quietly — see the
			// KNOWN GAP note above; a linked product is the case that needs a human.
			const handle = (d.shopify as { handle?: unknown } | undefined)?.handle;
			console.warn(
				`[backfill-price-amount] no priceAmount for ${d._id as string}` +
					(typeof handle === 'string' && handle
						? ` (Shopify: ${handle}) — set it in the Studio`
						: ' — `price` is empty or has no number in it')
			);
			return undefined;
		},
	},
});
