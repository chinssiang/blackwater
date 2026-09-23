import type { PageHomeQueryResult } from '@/../sanity.types';
import type { Locale } from '@/lib/i18n';
import { heroBlockIsRenderable } from '@/components/HeroBlock';
import PageModules from '@/components/PageModules';
import { WeatherWidget } from '@/components/WeatherWidgetLazy';

// Picked from the generated query result rather than restated, so a projection
// change fails `tsc` here instead of silently drifting.
interface PageHomeProps {
	data: Pick<NonNullable<PageHomeQueryResult>, 'pageModules'>;
	locale: Locale;
}

export default function PageHome({ data, locale }: PageHomeProps) {
	const { pageModules } = data || {};

	// One weather widget per page, owned by the first hero that will actually
	// RENDER — a builder of [freeform, heroBlock] still gets one, which gating on
	// slot 0 would not, and an empty placeholder hero no longer wins the election
	// and then returns null with the page's only widget. Same predicate HeroBlock
	// bails on, per the `<SizeChartTable>.isRenderable()` idiom.
	const widgetHeroKey = pageModules?.find(
		(module) => module._type === 'heroBlock' && heroBlockIsRenderable(module)
	)?._key;

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
					// Same slot, separate fact: this one drops the entrance fade from
					// the element Chrome is about to measure as the LCP. It was missing
					// here while PageGeneral passed it, so the homepage -- the page that
					// fix was written for -- kept starting its <h1> at opacity: 0.
					isPageOpener={index === 0}
					ownsWeatherWidget={!!widgetHeroKey && module._key === widgetHeroKey}
				/>
			))}
			{/* The homepage always carries the widget, which is why
			    `shouldShowWeatherWidget` no longer needs to name "/" and cannot
			    double up with the hero copy. Dropping that route rule on the premise
			    that the homepage opens with a hero left prod — whose pHome documents
			    still have no pageModules at all — with no widget in either locale,
			    and did the same for any homepage opening with another module type or
			    whose hero is switched off. */}
			{!widgetHeroKey && <WeatherWidget className="fixed lg:bottom-6" />}
		</>
	);
}
