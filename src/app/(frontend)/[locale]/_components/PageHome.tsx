import PageModules from '@/components/PageModules';
import type { Locale } from '@/lib/i18n';

interface PageHomeProps {
	data: {
		pageModules?: Array<any>;
		/** Read only by the migration guard below, never rendered. */
		landingTitle?: string | null;
		/**
		 * pageModules counted BEFORE `moduleVisible` filters it, so the guard can
		 * tell "no modules authored" from "every module parked with the eye".
		 */
		moduleCount?: number | null;
	};
	locale: Locale;
}

export default function PageHome({ data, locale }: PageHomeProps) {
	const { pageModules, landingTitle, moduleCount } = data || {};

	// Trimmed, for the reason HeroBlock spells out over `hasHeading`: a title an
	// editor blanked to spaces is truthy, and firing on it failed the production
	// build for a document carrying no real title -- on the exact value the
	// migration script (which trims) reads as "nothing to carry".
	const strayTitle = !!landingTitle?.trim();

	// The UNFILTERED count, not `pageModules.length`. `moduleVisible` filters
	// hidden modules in GROQ, so a homepage whose only module is parked with the
	// eye toggle arrives here as an empty array and used to reproduce the
	// unmigrated signature exactly -- wedging `next build` on a change an editor
	// made in the Studio, with a remedy the error message could not fix.
	const noModulesAuthored = (moduleCount ?? 0) === 0;

	// A pHome that predates the hero migration renders a completely blank page:
	// `landingTitle` and the <AnimatedTitle> fallback are gone, so nothing is
	// left to draw. That is worth failing a build over -- but only that.
	//
	// TWO THINGS THIS GOT WRONG BEFORE, both of which made it worse than the
	// blank page it was guarding:
	//
	//  - The predicate was `!pageModules`, i.e. "has no modules", which is the
	//    permanent shape of any freshly created homepage. `pageHomeQuery` sorts a
	//    locale-matching document ahead of the `en` fallback, so publishing a new
	//    locale homepage with just a title took the whole build down. The
	//    unmigrated signature is a non-blank `landingTitle` AND no modules
	//    AUTHORED (see `moduleCount`), which self-expires: the script unsets
	//    `landingTitle`, so once prod is migrated this can never fire again and
	//    both it and the schema field can go. The field is also readOnly in the
	//    Studio now, so an editor cannot re-arm it.
	//  - It threw unconditionally. There is no error.tsx anywhere under src/app,
	//    so at runtime that replaced the entire document -- and in draft mode the
	//    Presentation iframe showed Next's error page, which means the app never
	//    mounted and <VisualEditing /> never attached, on the one document the
	//    editor needed to click into to fix it. Production also redacts the
	//    message to an opaque digest, so the remedy reached the logs only.
	//
	// So: loud at build time, where a human is watching and the message survives;
	// silent-but-blank at runtime, which is no worse than before and keeps the
	// Studio usable.
	if (strayTitle && noModulesAuthored) {
		const message =
			'pHome still has `landingTitle` and no page modules, so the homepage ' +
			'would render blank. Run `node scripts/migrate-home-hero.mjs --execute` ' +
			'against this dataset (or add a Hero module to the homepage).';

		if (process.env.NEXT_PHASE === 'phase-production-build') {
			throw new Error(message);
		}

		console.error(`[PageHome] ${message}`);
	}

	return (
		<>
			{pageModules?.map((module, index) => (
				<PageModules
					key={module._key}
					module={module}
					locale={locale}
					// The first module opens the page, so it owns the <h1>; everything
					// below falls through to HeroBlock's 'h2' default. Hidden modules are
					// filtered out in GROQ (`moduleVisible`), so slot 0 is what a visitor
					// actually sees.
					headingLevel={index === 0 ? 'h1' : undefined}
				/>
			))}
		</>
	);
}
