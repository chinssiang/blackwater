'use client';

import { useEffect, useTransition } from 'react';
import { useIsPresentationTool } from 'next-sanity/hooks';
import { useRouter } from 'next/navigation';
import { disableDraftMode } from '@/app/actions';
import { toast } from 'sonner';

export default function DraftModeToast() {
	const isPresentationTool = useIsPresentationTool();
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	useEffect(() => {
		if (isPresentationTool === false) {
			/**
			 * We delay the toast in case we're inside Presentation Tool
			 */
			const toastId = toast('Draft Mode Enabled', {
				// Unconditionally "live" now. next-sanity 13 removed
				// `useDraftModeEnvironment`, whose 'live' value answered "is
				// <SanityLive> running?" — and since v13 fixed the request cascade
				// that forced it behind a draft-mode gate, it always is. See
				// layout/HtmlShell.tsx.
				description: 'Content is live, refreshing automatically',
				duration: Infinity,
				action: {
					label: 'Disable',
					onClick: async () => {
						await disableDraftMode();
						startTransition(() => {
							router.refresh();
						});
					},
				},
			});
			return () => {
				toast.dismiss(toastId);
			};
		}
	}, [router, isPresentationTool]);

	useEffect(() => {
		if (pending) {
			const toastId = toast.loading('Disabling draft mode...');
			return () => {
				toast.dismiss(toastId);
			};
		}
	}, [pending]);

	return null;
}
