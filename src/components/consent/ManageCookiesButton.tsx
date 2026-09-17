'use client';

import { cn } from '@/lib/utils';
import { useTranslations } from '@/components/LocaleProvider';
import { OPEN_CONSENT_EVENT } from '@/components/consent/ConsentBanner';

export default function ManageCookiesButton({
	className,
	prefix,
}: {
	className?: string;
	prefix?: React.ReactNode;
}) {
	const t = useTranslations('consent');
	return (
		<button
			type="button"
			onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
			className={cn(
				't-l-1 cursor-pointer uppercase transition-colors',
				className
			)}
		>
			{prefix}
			{t.manageCookiesLabel}
		</button>
	);
}
