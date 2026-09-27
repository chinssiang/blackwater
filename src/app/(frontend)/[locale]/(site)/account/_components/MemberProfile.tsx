'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMemberName } from '@/lib/member/name';
import { NAME_MAX_LENGTH } from '@/lib/member/shared';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { SubmitButton } from './SubmitButton';
import { toast } from 'sonner';

const NOTE_ID = 'profile-name-note';

/**
 * The signed-in page's heading, `children`, then the name form -- one client
 * component so a save updates the heading from the values it just saved,
 * without re-rendering the route. The name is saved through Better Auth's
 * update-user route (src/lib/member/auth.test.ts pins what it accepts). Both
 * parts are optional and either can be cleared.
 */
export function MemberProfile({
	firstName,
	lastName,
	children,
}: {
	firstName: string;
	lastName: string;
	children: React.ReactNode;
}) {
	const t = useTranslations('account');
	const locale = useLocale();
	const router = useRouter();
	const [saved, setSaved] = useState({ firstName, lastName });
	const [first, setFirst] = useState(firstName);
	const [last, setLast] = useState(lastName);
	const [saving, setSaving] = useState(false);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (saving) return;
		// Trimmed here as well as on the server, so the fields and the heading
		// show what was saved.
		const name = { firstName: first.trim(), lastName: last.trim() };
		setFirst(name.firstName);
		setLast(name.lastName);
		setSaving(true);
		const res = await fetch('/api/auth/update-user', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(name),
		}).catch(() => undefined);
		if (res?.ok) {
			setSaved(name);
			toast.success(t.profile.saved);
		} else if (res?.status === 401) {
			// The session ended while the page was open, so no retry can work.
			// The page is dynamic: a refresh re-renders it with the sign-in form.
			router.refresh();
		} else {
			toast.error(t.signIn.errorHeading, { description: t.signIn.errorBody });
		}
		setSaving(false);
	};

	const fields = [
		{
			id: 'profile-first-name',
			label: t.profile.firstName,
			autoComplete: 'given-name',
			value: first,
			onChange: setFirst,
		},
		{
			id: 'profile-last-name',
			label: t.profile.lastName,
			autoComplete: 'family-name',
			value: last,
			onChange: setLast,
		},
	];
	// Family name first, the way a Chinese form asks for it.
	if (locale === 'zh_tw') fields.reverse();

	return (
		<>
			<h1 className="t-h-1 mb-3 font-medium text-balance break-words">
				{formatMemberName(saved.firstName, saved.lastName) || t.details.heading}
			</h1>
			{children}
			<form onSubmit={onSubmit} className="mt-8">
				<div className="grid grid-cols-2 gap-3">
					{fields.map((field) => (
						<Field key={field.id}>
							<FieldLabel htmlFor={field.id}>{field.label}</FieldLabel>
							<Input
								id={field.id}
								autoComplete={field.autoComplete}
								maxLength={NAME_MAX_LENGTH}
								value={field.value}
								onChange={(e) => field.onChange(e.target.value)}
								aria-describedby={NOTE_ID}
								// Not `disabled`, which would throw focus to <body> mid-save.
								readOnly={saving}
							/>
						</Field>
					))}
				</div>
				<p id={NOTE_ID} className="t-b-2 text-foreground/60 mt-2 text-pretty">
					{t.profile.note}
				</p>
				<SubmitButton
					label={t.profile.save}
					pendingLabel={t.profile.saving}
					pending={saving}
					className="mt-4"
				/>
			</form>
		</>
	);
}
