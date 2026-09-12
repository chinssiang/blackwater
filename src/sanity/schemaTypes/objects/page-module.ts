import { defineField, isKeySegment, type ValidationContext } from 'sanity';

// The schema half of the page-module visibility toggle. The Studio control that
// writes the flag is components/PageModuleItem.tsx; this file is everything the
// schema needs, and is deliberately plain `.ts` so it stays testable in the
// node test environment rather than dragging @sanity/ui and JSX in with it.

/** The array field name on both `pHome` and `pGeneral`. */
export const PAGE_MODULES_FIELD = 'pageModules';

/**
 * The `hidden` flag the eye button writes. Add it to every page-module object
 * type, alongside `components: pageModuleComponents` — register one without the
 * other and either the module can never be hidden, or the eye writes a field the
 * schema does not declare (the Studio then files the row under "Fields not
 * defined in schema"). `pageModuleComponents` is both Studio halves: the eye
 * itself lives in `item`, so registering only that still shows it on editable
 * rows — what `preview` adds is the read-only state indicator and the fallback
 * placement for when the portal anchor is missing.
 *
 * Kept out of the form (`hidden: true`) because the eye is the control; the
 * value still lives in the document and is readable via the Inspect view.
 */
export function pageModuleHidden() {
	return defineField({
		name: 'hidden',
		type: 'boolean',
		hidden: true,
	});
}

/**
 * Whether the page module enclosing the field being validated is switched off.
 *
 * Prefer `moduleRule()` below to calling this directly — the exemption should be
 * named once per rule, not spelled out per call site.
 */
export function hostModuleHidden(context: ValidationContext): boolean {
	const { document, path } = context;

	// Both `pageModules` arrays are top-level fields, so the module is always at
	// path[0..1]. Matching only there keeps this in step with the document lookup
	// below: searching the whole path would happily match a nested array whose
	// value `document[PAGE_MODULES_FIELD]` could not read, and silently return
	// false for it.
	if (!path || path[0] !== PAGE_MODULES_FIELD) return false;

	const segment = path[1];
	const key = isKeySegment(segment) ? segment._key : undefined;
	const modules = document?.[PAGE_MODULES_FIELD];

	return (
		!!key &&
		Array.isArray(modules) &&
		modules.some((m) => m?._key === key && m.hidden === true)
	);
}

// `true | string`, not `boolean | string`: Sanity's CustomValidatorResult has no
// meaning for `false`, and the rule bodies already infer exactly this -- in
// `!link || !!value || 'msg'` the `||` chain drops the falsy half of each
// boolean, so the expression is `true | string` on its own.
type ModuleCheck = (
	value: unknown,
	context: ValidationContext
) => true | string;

/**
 * Wraps a page-module `Rule.custom` check so a module switched off with the eye
 * button stops reporting errors.
 *
 * Every source-dependent field in these modules already exempts itself on
 * exactly the condition that hides it — see `sourceOf` in faq-block.ts. The eye
 * adds a SECOND sense of hidden that no rule consulted, so a half-built module
 * still held its whole page unpublishable, with the offending field hidden from
 * the form: an error pointing at a control the editor cannot see, on a section
 * they had already parked. Switching a module off is the normal way to park
 * something unfinished, so it has to clear those errors too.
 *
 * This exists as a wrapper rather than a disjunct pasted into each rule because
 * the exemption is one global invariant across five files, and hand-editing
 * every call site is how you miss one — which is exactly what happened to
 * events-block's two CTA rules on the first pass. `Rule.custom(moduleRule(...))`
 * makes a missing wrapper visible when scanning, and page-module.test.ts fails
 * when one is absent.
 *
 * `hostModuleHidden` runs only when the check was about to report an error, so
 * the document scan never touches the passing path.
 *
 * SCOPE, because it is narrower than "a parked module never blocks publishing":
 * this can only wrap a `Rule.custom`. `Rule.required()`, `min`, `max` and
 * `regex` have no callback to wrap, so a module field carrying one blocks its
 * page whether or not the module is switched off — prefer a `Rule.custom`
 * through this wrapper over `Rule.required()` on a module field. The same gap
 * covers validators on the shared objects a module renders (`section-appearance`,
 * `custom-image`, `call-to-action`, `link`): their errors surface at paths under
 * `pageModules[…]`, but those files are not module files, so neither this
 * wrapper nor page-module.test.ts's guard reaches them. Of those, `call-to-action`
 * DOES carry validation -- `Rule.required()` on its `link` field -- so reaching
 * for `callToAction({ ... })` to de-duplicate heroBlock's and eventsBlock's
 * identical inline CTAs would attach an unwrappable required rule to a module
 * field and reintroduce the bug. It is only harmless today because no module
 * uses that factory. The other three carry none; adding one has the same cost.
 */
export const moduleRule =
	(check: ModuleCheck) => (value: unknown, context: ValidationContext) => {
		const result = check(value, context);

		// `result === true` rather than `typeof result !== 'string'`. The old test
		// treated anything non-string as a pass and handed it straight back, so a
		// Promise, a ValidationError or a localized-message object would skip the
		// exemption entirely -- and `ModuleCheck`'s `true | string` was the only
		// thing keeping those out. It is also exactly the type someone widens to
		// add an async check. Written this way the invariant holds whatever the
		// check returns: anything that is not a plain pass is treated as reporting,
		// and a switched-off module clears it.
		if (result === true) return true;
		return hostModuleHidden(context) ? true : result;
	};
