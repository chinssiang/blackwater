export const apiVersion =
	process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-08-08';

export const dataset = assertValue(
	process.env.NEXT_PUBLIC_SANITY_DATASET,
	'Missing environment variable: NEXT_PUBLIC_SANITY_DATASET'
);

export const projectId = assertValue(
	process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
	'Missing environment variable: NEXT_PUBLIC_SANITY_PROJECT_ID'
);

export const useCdn = process.env.NODE_ENV === 'production';
export const token = process.env.SANITY_API_READ_TOKEN;
export const revalidateSecret = process.env.SANITY_REVALIDATE_SECRET;

/**
 * Used to configure edit intent links, for Presentation Mode, as well as to configure where the Studio is mounted in the router.
 */

// Ternary, not `|| fallback`: a template literal is ALWAYS truthy, so the old
// `` `${process.env.SITE_URL}/sanity` || '…' `` never reached its fallback and an
// unset SITE_URL yielded the literal string "undefined/sanity" — which
// Presentation then used as its edit-intent origin.
export const studioUrl = process.env.SITE_URL
	? `${process.env.SITE_URL}/sanity`
	: 'http://localhost:3000/sanity';

function assertValue<T>(v: T | undefined, errorMessage: string): T {
	if (v === undefined) {
		throw new Error(errorMessage);
	}

	return v;
}
