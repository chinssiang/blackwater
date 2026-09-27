'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/components/LocaleProvider';
import { Label } from '@/components/ui/Label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { toast } from 'sonner';

// Each language named in itself, so a member who landed on the wrong page can
// still find theirs.
const OPTIONS = [
	{ value: 'en', label: 'English' },
	{ value: 'zh_tw', label: '中文' },
] as const;

/** Saved on change, through Better Auth's update-user route like the profile;
 *  auth.ts reads it when it emails a sign-in code. */
export function LanguagePreference({ initial }: { initial: string }) {
	const account = useTranslations('account');
	const t = account.settings;
	const router = useRouter();
	const [value, setValue] = useState(initial);
	const [saving, setSaving] = useState(false);

	const onChange = async (next: string) => {
		if (saving || next === value) return;
		const previous = value;
		setValue(next);
		setSaving(true);
		const res = await fetch('/api/auth/update-user', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ preferredLocale: next }),
		}).catch(() => undefined);
		if (res?.ok) {
			toast.success(t.saved);
		} else {
			setValue(previous);
			if (res?.status === 401) router.refresh();
			else
				toast.error(account.signIn.errorHeading, {
					description: account.signIn.errorBody,
				});
		}
		setSaving(false);
	};

	return (
		<>
			<p
				id="language-intro"
				className="t-b-2 text-muted-foreground mb-4 text-pretty"
			>
				{t.languageIntro}
			</p>
			<RadioGroup
				value={value}
				onValueChange={(next) => onChange(String(next))}
				aria-labelledby="language-intro"
			>
				{[{ value: '', label: t.languageFollowPage }, ...OPTIONS].map(
					(option) => (
						<div key={option.value} className="flex items-center gap-3">
							<RadioGroupItem
								value={option.value}
								id={`language-${option.value || 'page'}`}
							/>
							<Label
								htmlFor={`language-${option.value || 'page'}`}
								className="t-b-1"
							>
								{option.label}
							</Label>
						</div>
					)
				)}
			</RadioGroup>
		</>
	);
}
