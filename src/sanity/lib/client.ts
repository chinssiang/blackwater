import { createClient } from 'next-sanity';
import { apiVersion, dataset, projectId, studioUrl } from '@/sanity/env';

export const client = createClient({
	projectId,
	dataset,
	apiVersion,
	useCdn: true, // Set to false if statically generating pages, using ISR or tag-based revalidation
	perspective: 'published',
	stega: {
		studioUrl,
		// Set logger to 'console' for more verbose logging
		// logger: console,
		filter: (props) => {
			if (props.sourcePath.at(-1) === 'title') {
				return true;
			}

			// `richDate.timezone` is an IANA identifier that is never rendered — it
			// is fed to `Intl`, which throws a RangeError on anything it does not
			// recognise. `filterDefault` has no reason to skip it (its denylist
			// covers `status`, and the value is neither date-like nor URL-like), so
			// in the Presentation tool it was encoded for EVERY event and took
			// `/events` to its error boundary on any dataset. Opting it out here is
			// the root fix: readers get a clean value, editors lose nothing, and
			// `defineLive` shares this client so draft mode is covered too.
			if (props.sourcePath.at(-1) === 'timezone') {
				return false;
			}

			// `pProduct.badge` holds schema tokens (`new`, `founders-pick`), never
			// display text: they key the `products.badges` dictionary and the rank
			// cards order by. Encoded, the dictionary lookup misses and the raw
			// slug renders in its place.
			//
			// NOT the free win `timezone` above is, though: that value is never
			// rendered, so editors lose nothing. A badge IS rendered, and it is the
			// only surface for this field on a listing — so opting out also drops
			// its Presentation click-to-edit target. The trade is worth it because
			// the encoded chip showed the slug rather than the label, but it is a
			// trade.
			//
			// `at(-2)`, not `at(-1)`: this is an array of plain strings, so the
			// last path segment is the member's index. Make it an array of objects
			// and this arm stops matching — and if such a member carries a `title`,
			// the arm ABOVE force-encodes it, which `filterDefault` could otherwise
			// have declined. Either way the raw slugs come back, silently and only
			// for editors.
			if (props.sourcePath.at(-2) === 'badge') {
				return false;
			}

			return props.filterDefault(props);
		},
	},
	requestTagPrefix: 'website',
});
