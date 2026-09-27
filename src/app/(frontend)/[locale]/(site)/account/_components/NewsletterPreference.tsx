'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { interpolate } from '@/lib/dictionary';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { Checkbox } from '@/components/ui/Checkbox';
import { Label } from '@/components/ui/Label';
import { setNewsletterSubscription } from '../actions';
import { toast } from 'sonner';

/**
 * Klaviyo's answer for the member's email, changed on click. Klaviyo applies a
 * change as a background job, so a reload moments later can still show the
 * old answer; the box keeps what was clicked rather than re-reading.
 */
export function NewsletterPreference({
	initial,
	email,
}: {
	initial: boolean;
	email: string;
}) {
	const account = useTranslations('account');
	const t = account.settings;
	const locale = useLocale();
	const router = useRouter();
	const [checked, setChecked] = useState(initial);
	const [saving, setSaving] = useState(false);

	const onChange = async (next: boolean) => {
		if (saving) return;
		setChecked(next);
		setSaving(true);
		const result = await setNewsletterSubscription(next, locale).catch(
			() => 'failed' as const
		);
		if (result === 'ok') {
			toast.success(t.saved);
		} else {
			setChecked(!next);
			if (result === 'signedOut') router.refresh();
			else
				toast.error(account.signIn.errorHeading, {
					description: account.signIn.errorBody,
				});
		}
		setSaving(false);
	};

	return (
		<div className="flex items-start gap-3">
			<Checkbox
				id="newsletter"
				checked={checked}
				onCheckedChange={onChange}
				aria-describedby="newsletter-note"
				className="mt-0.5"
			/>
			<div>
				<Label htmlFor="newsletter" className="t-b-1">
					{t.newsletterLabel}
				</Label>
				<p
					id="newsletter-note"
					className="t-b-2 text-muted-foreground mt-1 text-pretty break-words"
				>
					{interpolate(t.newsletterNote, { email })}
				</p>
			</div>
		</div>
	);
}
