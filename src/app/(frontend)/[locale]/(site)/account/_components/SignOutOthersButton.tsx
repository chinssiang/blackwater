'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

/** Better Auth's revoke-other-sessions: deletes every session row but this
 *  one, so each other browser is signed out on its next request. */
export function SignOutOthersButton({ className }: { className?: string }) {
	const account = useTranslations('account');
	const t = account.settings;
	const router = useRouter();
	const [pending, setPending] = useState(false);

	const onClick = async () => {
		setPending(true);
		const res = await fetch('/api/auth/revoke-other-sessions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}',
		}).catch(() => undefined);
		if (res?.ok) {
			toast.success(t.signedOutOthers);
			router.refresh();
		} else if (res?.status === 401) {
			router.refresh();
		} else {
			toast.error(account.signIn.errorHeading, {
				description: account.signIn.errorBody,
			});
		}
		setPending(false);
	};

	return (
		<Button
			type="button"
			variant="outline"
			size="lg"
			className={className}
			disabled={pending}
			onClick={onClick}
		>
			{pending ? t.signingOutOthers : t.signOutOthers}
		</Button>
	);
}
