import PageModules from '@/components/PageModules';
import type { Locale } from '@/lib/i18n';
import { AnimatedTitle } from './AnimatedTitle';

interface PageHomeProps {
	data: {
		pageModules?: Array<any>;
		landingTitle?: string;
	};
	locale: Locale;
}

export default function PageHome({ data, locale }: PageHomeProps) {
	const { pageModules, landingTitle } = data || {};

	return (
		<div className="flex min-h-main flex-col justify-center gap-5 py-40">
			<div className="px-contain mx-auto max-w-sm text-center text-sm text-balance uppercase sm:max-w-6xl">
				<AnimatedTitle title={landingTitle} />
			</div>
			{pageModules?.map((module) => (
				<PageModules key={module._key} module={module} locale={locale} />
			))}
		</div>
	);
}
