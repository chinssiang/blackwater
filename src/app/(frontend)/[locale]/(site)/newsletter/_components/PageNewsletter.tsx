'use client';
import { Newsletter } from '@/components/layout/Newsletter';
import type { PortableTextSimple } from 'sanity.types';

interface NewsletterFormData {
	klaviyoListID?: string | null;
	heading?: string | null;
	subheading?: string | null;
	submitButtonText?: string | null;
	disclaimer?: PortableTextSimple | null;
	successHeading?: string | null;
	successBody?: string | null;
	errorHeading?: string | null;
	errorBody?: string | null;
}

interface PageNewsletterData {
	title?: string | null;
	intro?: string | null;
	newsletter?: NewsletterFormData | null;
}

interface PageNewsletterProps {
	data?: PageNewsletterData;
}

export function PageNewsletter({ data }: PageNewsletterProps) {
	const { title, intro, newsletter } = data || {};

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5 flex gap-10 justify-between flex-col lg:flex-row">
			<div className="text-foreground lg:flex-1">
				{title && <h1 className="t-h-3 uppercase">{title}</h1>}
				{intro && <p className="mt-2 whitespace-pre-line">{intro}</p>}
			</div>
			{newsletter && (
				<Newsletter data={newsletter} className="flex-1 space-y-3" />
			)}
		</div>
	);
}
