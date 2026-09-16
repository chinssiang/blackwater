import type { PageGeneralQueryResult } from '@/../sanity.types';
import { format } from 'date-fns';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import { getDictionary } from '@/lib/dictionary.server';
import type { Locale } from '@/lib/i18n';
import CustomPortableText from '@/components/CustomPortableText';
import { heroBlockIsRenderable } from '@/components/HeroBlock';
import PageModules from '@/components/PageModules';

// Picked from the generated query result rather than restated, so a projection
// change fails `tsc` here instead of silently drifting.
type PageGeneralData = Pick<
	NonNullable<PageGeneralQueryResult>,
	'title' | 'content' | 'pageModules' | '_updatedAt'
>;

interface PageGeneralProps {
	data: PageGeneralData;
	locale: Locale;
}

export default async function PageGeneral({ data, locale }: PageGeneralProps) {
	const { title, content, pageModules, _updatedAt } = data || {};
	const dict = await getDictionary(locale);
	const dateFnsLocale = DATE_FNS_LOCALES[locale];

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
			<section className="min-h-main p-x-max mx-auto flex flex-col justify-center gap-10 py-10 lg:flex-row lg:py-17.5">
				<div className="lg:top-header h-fit flex-1 lg:sticky">
					{title && <h1 className="t-b-1 uppercase">{title}</h1>}
					{_updatedAt && (
						<p className="t-b-1 mt-1 uppercase">
							{dict.common.lastUpdated}:{' '}
							{format(new Date(_updatedAt), 'PPP', { locale: dateFnsLocale })}
						</p>
					)}
				</div>

				<div className="flex-1">
					<div className="wysiwyg-page max-w-md">
						<CustomPortableText blocks={content} />
					</div>
				</div>
			</section>

			{pageModules?.map((module) => (
				<PageModules
					key={module._key}
					module={module}
					locale={locale}
					// No headingLevel: the page title above already owns this page's h1.
					ownsWeatherWidget={!!widgetHeroKey && module._key === widgetHeroKey}
				/>
			))}
		</>
	);
}
