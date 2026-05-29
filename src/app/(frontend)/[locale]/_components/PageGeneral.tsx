import CustomPortableText from '@/components/CustomPortableText';
import { getDictionary } from '@/lib/dictionary.server';
import type { Locale } from '@/lib/i18n';
import { format } from 'date-fns';
import { enUS, zhTW } from 'date-fns/locale';

interface PageGeneralData {
	title?: string;
	content?: any; // TODO: Refine this type if possible, e.g., PortableTextBlock[]
	_updatedAt?: string;
}

interface PageGeneralProps {
	data: PageGeneralData;
	locale: Locale;
}

export default async function PageGeneral({ data, locale }: PageGeneralProps) {
	const { title, content, _updatedAt } = data || {};
	const dict = await getDictionary(locale);
	const dateFnsLocale = locale === 'zh_tw' ? zhTW : enUS;

	return (
		<section className="min-h-main flex flex-col lg:flex-row justify-center p-x-max mx-auto py-10 lg:py-17.5 gap-10">
			<div className="flex-1 lg:sticky lg:top-header h-fit">
				{title && <h1 className="t-b-1 uppercase">{title}</h1>}
				{_updatedAt && (
					<p className="t-b-1 uppercase mt-1">
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
	);
}
