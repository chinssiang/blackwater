import PageModules from '@/components/PageModules';
import { AnimatedTitle } from './AnimatedTitle';

interface PageHomeProps {
	data: {
		pageModules?: Array<any>;
		landingTitle?: string;
	};
}

export default function PageHome({ data }: PageHomeProps) {
	const { pageModules, landingTitle } = data || {};

	return (
		<div className="flex lg:min-h-main-(--height-newsletter) min-h-main-[calc(var(--height-newsletter))*0.36] flex-col justify-center gap-5 py-20">
			<div className="px-contain mx-auto max-w-sm text-center text-sm text-balance uppercase sm:max-w-6xl">
				<AnimatedTitle title={landingTitle} />
			</div>
			{pageModules?.map((module) => (
				<PageModules key={module._key} module={module} />
			))}
		</div>
	);
}
