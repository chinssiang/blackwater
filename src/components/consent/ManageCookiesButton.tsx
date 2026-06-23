'use client';

import { OPEN_CONSENT_EVENT } from '@/components/consent/ConsentBanner';
import { useTranslations } from '@/components/LocaleProvider';

// Re-opens the consent preferences dialog from anywhere (e.g. the footer).
export default function ManageCookiesButton({
	label,
	className,
}: {
	label?: string;
	className?: string;
}) {
	const t = useTranslations('consent');
	return (
		<button
			type="button"
			onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
			className={className}
		>
			{label ?? t.manageCookiesLabel}
		</button>
	);
}
