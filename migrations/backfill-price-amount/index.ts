import { at, defineMigration, set } from 'sanity/migrate';
import type { NodePatch } from 'sanity/migrate';

/*
	Backfills the numeric `priceAmount` on pProduct from the free-text `price`
	string, so products can be sorted and filtered by price. Best-effort: takes the
	first number found in the string (e.g. "$1,299 or From $49/mo" -> 1299,
	"From $49/mo" -> 49). Review subscription / multi-price items afterwards.
	Values are New Taiwan Dollars. Idempotent: skips docs that already have a
	numeric priceAmount (including manual edits).

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
			if (typeof d.price !== 'string') return undefined;
			const amount = parsePrice(d.price);
			return amount != null ? [at('priceAmount', set(amount))] : undefined;
		},
	},
});
