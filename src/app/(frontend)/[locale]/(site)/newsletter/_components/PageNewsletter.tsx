'use client';
import {
	Newsletter,
	type NewsletterData,
} from '@/components/layout/Newsletter';

interface PageNewsletterData {
	title?: string | null;
	newsletter?: NewsletterData | null;
}

interface PageNewsletterProps {
	data?: PageNewsletterData;
}

export function PageNewsletter({ data }: PageNewsletterProps) {
	const { title, newsletter } = data || {};

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5 flex items-center justify-center">
			{title && <h1 className="sr-only">{title}</h1>}
			{newsletter && (
				<Newsletter
					data={newsletter}
					className="space-y-3"
					placement="page"
				/>
			)}
		</div>
	);
}
