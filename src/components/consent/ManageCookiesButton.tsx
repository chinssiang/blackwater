'use client';

import { OPEN_CONSENT_EVENT } from '@/components/consent/ConsentBanner';

// Re-opens the consent preferences dialog from anywhere (e.g. the footer).
export default function ManageCookiesButton({
	label = 'Cookie settings',
	className,
}: {
	label?: string;
	className?: string;
}) {
	return (
		<button
			type="button"
			onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
			className={className}
		>
			{label}
		</button>
	);
}
