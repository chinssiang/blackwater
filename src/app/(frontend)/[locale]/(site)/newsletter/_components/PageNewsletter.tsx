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
	newsletter?: NewsletterFormData | null;
}

interface PageNewsletterProps {
	data?: PageNewsletterData;
}

export function PageNewsletter({ data }: PageNewsletterProps) {
	const { title, newsletter } = data || {};

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5 flex items-center justify-center">
			{title && <h1 className="sr-only">{title}</h1>}
			{newsletter && <Newsletter data={newsletter} className="space-y-3" />}
		</div>
	);
}
