'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

export function SignOutButton({ className }: { className?: string }) {
	const t = useTranslations('account');
	const router = useRouter();
	const [pending, setPending] = useState(false);

	const signOut = async () => {
		setPending(true);
		const res = await fetch('/api/auth/sign-out', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}',
		}).catch(() => undefined);
		if (res?.ok) {
			// `pending` stays set: the refresh replaces this view with the form.
			router.refresh();
			return;
		}
		toast.error(t.signIn.errorHeading, { description: t.signIn.errorBody });
		setPending(false);
	};

	return (
		<Button
			type="button"
			variant="outline"
			size="lg"
			className={className}
			disabled={pending}
			onClick={signOut}
		>
			{pending ? t.details.signingOut : t.details.signOut}
		</Button>
	);
}
