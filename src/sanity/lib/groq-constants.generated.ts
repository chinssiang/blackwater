// GENERATED FILE — DO NOT EDIT BY HAND.
// Source: src/lib/routes.ts · Generator: scripts/generate-groq-constants.mjs
// Refresh with `npm run generate:groq` (also runs via `predev`, `prebuild` and
// `typegen`). `src/sanity/lib/groq-constants.test.ts` fails when it is stale.
//
// Sanity TypeGen cannot evaluate function calls when resolving GROQ template
// interpolations, so the expression built from DOCUMENT_ROUTES is materialised
// here as a plain string literal. Edit src/lib/routes.ts, not this file.
//
// `as const` is load-bearing: a plain template literal widens to `string`, which
// widens every query interpolating it and drops them back to an untyped result.

/** Resolves an internal link object to its locale-aware href. */
export const RESOLVED_HREF_GROQ = `select(
		linkType == "internal" => internalLink-> {
			"url": select(
				_type == "pHome" => select($locale == "zh_tw" => "/zh_tw", "/"),
				select($locale == "zh_tw" => "/zh_tw", "") + select(
					_type == "pGeneral" => "/" + slug.current,
					_type == "pProductIndex" => "/products",
					_type == "pProduct" => "/products/" + slug.current,
					_type == "pProductCategory" => "/products/categories/" + slug.current,
					_type == "pProductCollection" => "/products/collections/" + slug.current,
					_type == "pEvents" => "/events",
					_type == "pEvent" => "/events/" + slug.current,
					_type == "pContact" => "/contact",
					_type == "pFaq" => "/faq",
					_type == "pSizeGuide" => "/size-guide",
					_type == "pNewsletter" => "/newsletter",
					defined(slug.current) => "/" + slug.current,
					null
				)
			)
		}.url,
		href
	)` as const;
