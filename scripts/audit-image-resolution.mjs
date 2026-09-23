/**
 * Read-only report: which images are too small for the slots they render in.
 *
 * `/_next/image` and the Sanity CDN both refuse to upscale, so an asset narrower
 * than its rendered slot is stretched by the browser and there is nothing the
 * pipeline can do about it. Every product asset in both datasets is currently a
 * 1080x1080 original, while the product page's own frame is ~58vw — about
 * 2230 device pixels on a 1920px screen at 2x DPR. This lists what needs
 * re-uploading and at what size.
 *
 * The threshold is a rendered width, not a taste: see MIN_WIDTH below.
 *
 * Writes nothing and takes no --execute flag. It reads published documents only
 * (perspective 'raw' plus an `_id` filter), because a draft's asset is not what
 * visitors are being served.
 *
 * Usage:
 *   set -a; . ./.env.local; set +a
 *   node scripts/audit-image-resolution.mjs
 *   SANITY_DATASET=prod node scripts/audit-image-resolution.mjs
 */
import { createClient } from '@sanity/client';

const DATASET = process.env.SANITY_DATASET || 'dev';
const TOKEN =
	process.env.SANITY_READ_WRITE_TOKEN || process.env.SANITY_API_READ_TOKEN;
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;

// Per type, because the slots differ by more than rounding. A pProduct image is
// the page hero -- lg:col-span-7 of 12, i.e. ~58vw, so a 1920px viewport at 2x DPR
// asks for ~2230 device pixels and 2400 covers it with room to spare. A category
// or collection cover is only ever a grid card (a quarter width at 2xl, ~470px
// capped), so holding it to the hero's bar would report every one of them as a
// problem it does not have and bury the list that matters.
const MIN_WIDTH = {
	pProduct: 2400,
	pProductCategory: 1200,
	pProductCollection: 1200,
};
const LOWEST_BAR = Math.min(...Object.values(MIN_WIDTH));

if (!TOKEN || !PROJECT_ID) {
	console.error(
		'Missing SANITY_READ_WRITE_TOKEN (or SANITY_API_READ_TOKEN) / NEXT_PUBLIC_SANITY_PROJECT_ID — source .env.local first.'
	);
	process.exit(1);
}

const client = createClient({
	projectId: PROJECT_ID,
	dataset: DATASET,
	apiVersion: '2025-02-19',
	token: TOKEN,
	useCdn: false,
	perspective: 'raw',
});

// mainImage.image is the one asset a product card and the product page both
// render, so it is the one that has to clear the bar. `title` is an
// internationalizedArray on this family (field-level i18n), hence the [0].value.
const QUERY = /* groq */ `
*[
  _type in ["pProduct", "pProductCategory", "pProductCollection"]
  && !(_id in path("drafts.**"))
]{
  _id,
  _type,
  "slug": slug.current,
  "title": coalesce(title[language == "en"][0].value, title[0].value, title),
  "asset": coalesce(mainImage.image.asset, coverImage.image.asset)->{
    _id,
    originalFilename,
    "width": metadata.dimensions.width,
    "height": metadata.dimensions.height
  }
} | order(_type asc, slug asc)`;

const docs = await client.fetch(QUERY);

const missing = docs.filter((d) => !d.asset);
const withAsset = docs.filter((d) => d.asset?.width);
const tooSmall = withAsset.filter(
	(d) => d.asset.width < (MIN_WIDTH[d._type] ?? LOWEST_BAR)
);

console.log(`Dataset: ${DATASET}`);
console.log(
	`${docs.length} documents, ${withAsset.length} with a sized image, ` +
		`${tooSmall.length} below the bar for their type ` +
		`(${Object.entries(MIN_WIDTH)
			.map(([t, w]) => `${t} ${w}px`)
			.join(', ')}).\n`
);

if (tooSmall.length) {
	const pad = (s, n) =>
		String(s ?? '')
			.padEnd(n)
			.slice(0, n);
	console.log(
		`${pad('TYPE', 20)} ${pad('SLUG', 34)} ${pad('SIZE', 12)} ${pad('NEEDS', 8)} FILENAME`
	);
	for (const d of tooSmall) {
		console.log(
			`${pad(d._type, 20)} ${pad(d.slug, 34)} ` +
				`${pad(`${d.asset.width}x${d.asset.height}`, 12)} ` +
				`${pad(`${MIN_WIDTH[d._type] ?? LOWEST_BAR}px`, 8)} ${d.asset.originalFilename ?? ''}`
		);
	}
	console.log('');
}

if (missing.length) {
	console.log(`${missing.length} documents have no main/cover image:`);
	for (const d of missing) console.log(`  ${d._type}  ${d.slug ?? d._id}`);
	console.log('');
}

// Distinct assets, since one image can back several documents — this is the
// number of files someone actually has to re-export.
const distinct = new Set(tooSmall.map((d) => d.asset._id));
console.log(
	tooSmall.length
		? `${distinct.size} distinct assets to re-upload, at the NEEDS width above.`
		: 'Every sized image clears the bar for its type.'
);
