'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
	CONTACT_NAME_MAX_LENGTH,
	NAME_MAX_LENGTH,
	PHONE_MAX_LENGTH,
} from '@/lib/member/shared';
import { cn } from '@/lib/utils';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { AccountHeading, AccountSectionBlock } from './AccountSections';
import { SubmitButton } from './SubmitButton';
import { toast } from 'sonner';

type Profile = {
	firstName: string;
	lastName: string;
	birthday: string;
	phone: string;
	country: string;
	emergencyContactName: string;
	emergencyContactPhone: string;
};

type FieldSpec = {
	name: keyof Profile;
	label: string;
	autoComplete?: string;
} & Omit<React.ComponentProps<'input'>, 'name'>;

// Mirrors the server's phone rule (auth.ts), so the browser can say what is
// wrong before a round trip. The server's check is the one that counts.
const PHONE_PATTERN = String.raw`\+?[\d ().\-]*\d[\d ().\-]*`;

/**
 * The profile, saved as one form through Better Auth's update-user route,
 * which checks the session and the origin and validates every field
 * (src/lib/member/auth.test.ts pins what it accepts). Every field is optional
 * and can be cleared. A save refreshes the route so the sidebar shows the new
 * name; the fields keep their own state through it.
 */
export function ProfileForm({
	initial,
	email,
	countries,
}: {
	initial: Profile;
	email: string;
	countries: { code: string; name: string }[];
}) {
	const t = useTranslations('account').profile;
	const signInT = useTranslations('account').signIn;
	const locale = useLocale();
	const router = useRouter();
	const [values, setValues] = useState(initial);
	const [saving, setSaving] = useState(false);

	const set = (name: keyof Profile, value: string) =>
		setValues((v) => ({ ...v, [name]: value }));

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (saving) return;
		// Trimmed here as well as on the server, so the fields show what was
		// saved.
		const trimmed = Object.fromEntries(
			Object.entries(values).map(([k, v]) => [k, v.trim()])
		) as Profile;
		setValues(trimmed);
		setSaving(true);
		const res = await fetch('/api/auth/update-user', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(trimmed),
		}).catch(() => undefined);
		if (res?.ok) {
			toast.success(t.saved);
			router.refresh();
		} else if (res?.status === 401) {
			// The session ended while the page was open, so no retry can work.
			// The page is dynamic: a refresh re-renders it with the sign-in form.
			router.refresh();
		} else if (res?.status === 400) {
			toast.error(t.invalid);
		} else {
			toast.error(signInT.errorHeading, { description: signInT.errorBody });
		}
		setSaving(false);
	};

	const nameFields: FieldSpec[] = [
		{
			name: 'firstName',
			label: t.firstName,
			autoComplete: 'given-name',
			maxLength: NAME_MAX_LENGTH,
		},
		{
			name: 'lastName',
			label: t.lastName,
			autoComplete: 'family-name',
			maxLength: NAME_MAX_LENGTH,
		},
	];
	// Family name first, the way a Chinese form asks for it.
	if (locale === 'zh_tw') nameFields.reverse();

	// Not `disabled` while saving, which would throw focus to <body>.
	const input = ({ name, label, className, ...props }: FieldSpec) => (
		<Field key={name} className={className}>
			<FieldLabel htmlFor={`profile-${name}`}>{label}</FieldLabel>
			<Input
				{...props}
				id={`profile-${name}`}
				name={name}
				value={values[name]}
				onChange={(e) => set(name, e.target.value)}
				readOnly={saving}
			/>
		</Field>
	);

	return (
		<>
			<AccountHeading heading={t.heading} intro={t.intro} />
			<form onSubmit={onSubmit}>
				<AccountSectionBlock heading={t.aboutHeading}>
					<div className="grid gap-4 sm:grid-cols-2">
						{nameFields.map(input)}
						{input({
							name: 'birthday',
							label: t.birthday,
							type: 'date',
							autoComplete: 'bday',
							min: '1900-01-01',
						})}
					</div>
				</AccountSectionBlock>

				<AccountSectionBlock heading={t.contactHeading}>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field className="sm:col-span-2">
							<FieldLabel htmlFor="profile-email">{t.email}</FieldLabel>
							{/* Read-only: it is the sign-in key, and changing it means
							    proving the new address, which this form cannot do. */}
							<Input
								id="profile-email"
								type="email"
								value={email}
								readOnly
								aria-describedby="profile-email-note"
								className="text-muted-foreground"
							/>
							<p
								id="profile-email-note"
								className="t-b-2 text-muted-foreground text-pretty"
							>
								{t.emailNote}
							</p>
						</Field>
						{input({
							name: 'phone',
							label: t.phone,
							type: 'tel',
							autoComplete: 'tel',
							inputMode: 'tel',
							pattern: PHONE_PATTERN,
							maxLength: PHONE_MAX_LENGTH,
						})}
						<Field>
							<FieldLabel htmlFor="profile-country">{t.country}</FieldLabel>
							{/* Native, for 249 options: a phone's own picker scrolls and
							    type-selects them better than any popup can. */}
							<select
								id="profile-country"
								name="country"
								autoComplete="country"
								value={values.country}
								onChange={(e) => set('country', e.target.value)}
								// readOnly means nothing to a <select>; this keeps focus
								// where it is while still ignoring changes mid-save.
								aria-disabled={saving || undefined}
								className={cn(
									'border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-10 w-full min-w-0 rounded border bg-transparent px-2 text-base transition-[color,border-color,box-shadow] outline-none focus-visible:ring-3 md:text-sm',
									!values.country && 'text-muted-foreground'
								)}
							>
								<option value="">{t.countryPlaceholder}</option>
								{countries.map(({ code, name }) => (
									<option key={code} value={code} className="text-foreground">
										{name}
									</option>
								))}
							</select>
						</Field>
					</div>
				</AccountSectionBlock>

				<AccountSectionBlock heading={t.emergencyHeading}>
					<p className="t-b-2 text-muted-foreground -mt-2 mb-4 text-pretty">
						{t.emergencyNote}
					</p>
					<div className="grid gap-4 sm:grid-cols-2">
						{input({
							name: 'emergencyContactName',
							label: t.emergencyName,
							autoComplete: 'off',
							maxLength: CONTACT_NAME_MAX_LENGTH,
						})}
						{input({
							name: 'emergencyContactPhone',
							label: t.emergencyPhone,
							type: 'tel',
							autoComplete: 'off',
							inputMode: 'tel',
							pattern: PHONE_PATTERN,
							maxLength: PHONE_MAX_LENGTH,
						})}
					</div>
				</AccountSectionBlock>

				<SubmitButton
					label={t.save}
					pendingLabel={t.saving}
					pending={saving}
					className="mt-8"
				/>
			</form>
		</>
	);
}
