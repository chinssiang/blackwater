'use client';
import { cn } from '@/lib/utils';
import { OPEN_CONSENT_EVENT } from '@/components/consent/ConsentBanner';
import { useTranslations } from '@/components/LocaleProvider';

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
				'cursor-pointer t-l-1 uppercase transition-colors',
				className
			)}
		>
			{prefix}
			{t.manageCookiesLabel}
		</button>
	);
}
