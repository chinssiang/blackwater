'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Combobox } from '@base-ui/react/combobox';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import {
	CONTACT_NAME_MAX_LENGTH,
	NAME_MAX_LENGTH,
	PHONE_MAX_LENGTH,
} from '@/lib/member/shared';
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

type Country = { code: string; name: string; dialCode: string };

type FieldSpec = {
	name: keyof Profile;
	label: string;
	autoComplete?: string;
} & Omit<React.ComponentProps<'input'>, 'name'>;

// Mirrors the server's phone rule (auth.ts), so the browser can say what is
// wrong before a round trip. The server's check is the one that counts.
// Parens escaped: browsers compile `pattern` with the `v` flag, which
// rejects them bare inside a class and then ignores the whole pattern.
const PHONE_PATTERN = String.raw`\+?[\d \(\)\.\-]*\d[\d \(\)\.\-]*`;

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
	countries: Country[];
}) {
	const t = useTranslations('account').profile;
	const signInT = useTranslations('account').signIn;
	const locale = useLocale();
	const router = useRouter();
	const [values, setValues] = useState(initial);
	const [saving, setSaving] = useState(false);

	const selectedCountry =
		countries.find((c) => c.code === values.country) ?? null;
	const { contains } = Combobox.useFilter({ sensitivity: 'base' });
	// A name ("taiw", "台灣"), a calling code with or without its "+", or the
	// ISO code itself.
	const filterCountry = (c: Country, query: string) => {
		const digits = query.replace(/^\+/, '');
		return (
			contains(c.name, query) ||
			(/^\d+$/.test(digits) && c.dialCode.slice(1).startsWith(digits)) ||
			c.code.toLowerCase() === query.toLowerCase()
		);
	};

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
						<Field>
							<FieldLabel htmlFor="profile-phone">{t.phone}</FieldLabel>
							<div className="flex gap-2">
								{/* The member's country, shown as its calling code in front
								    of the number. Typing filters by name or code; emptying
								    the input clears it. The input stays as narrow as
								    "+886"; the popup is wide enough for the full names. */}
								<Combobox.Root
									items={countries}
									value={selectedCountry}
									onValueChange={(c) => set('country', c?.code ?? '')}
									itemToStringLabel={(c) => c.dialCode}
									itemToStringValue={(c) => c.code}
									filter={filterCountry}
									autoHighlight
									readOnly={saving}
								>
									<Combobox.InputGroup className="relative w-24 shrink-0">
										<Combobox.Input
											aria-label={t.country}
											placeholder="+"
											className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 placeholder:text-muted-foreground h-10 w-full min-w-0 rounded border bg-transparent pr-8 pl-2.5 text-base transition-colors outline-none focus-visible:ring-3 md:text-sm"
										/>
										<Combobox.Trigger
											aria-label={t.country}
											className="text-muted-foreground absolute inset-y-0 right-0 flex items-center px-2.5"
										>
											<ChevronDownIcon className="size-4" />
										</Combobox.Trigger>
									</Combobox.InputGroup>
									<Combobox.Portal>
										<Combobox.Positioner
											align="start"
											sideOffset={4}
											className="isolate z-50"
										>
											<Combobox.Popup className="bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 w-72 overflow-hidden rounded-lg shadow-md ring-1 duration-100 motion-reduce:animate-none">
												<Combobox.Empty className="text-muted-foreground px-3 py-2 text-sm empty:hidden">
													{t.countryNoMatch}
												</Combobox.Empty>
												{/* A static cap alongside the var: Floating UI measures
												    the natural height before the var exists, and a list
												    this long would otherwise flip the popup sideways. */}
												<Combobox.List className="max-h-[min(20rem,var(--available-height,20rem))] overflow-y-auto p-1 empty:p-0">
													{(c: Country) => (
														<Combobox.Item
															key={c.code}
															value={c}
															className="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-sm outline-hidden select-none"
														>
															<span className="flex-1 truncate">{c.name}</span>
															<span className="text-muted-foreground tabular-nums">
																{c.dialCode}
															</span>
															<span className="flex size-4 items-center justify-center">
																<Combobox.ItemIndicator>
																	<CheckIcon className="size-4" />
																</Combobox.ItemIndicator>
															</span>
														</Combobox.Item>
													)}
												</Combobox.List>
											</Combobox.Popup>
										</Combobox.Positioner>
									</Combobox.Portal>
								</Combobox.Root>
								<Input
									id="profile-phone"
									name="phone"
									type="tel"
									autoComplete="tel-national"
									inputMode="tel"
									pattern={PHONE_PATTERN}
									maxLength={PHONE_MAX_LENGTH}
									value={values.phone}
									onChange={(e) => set('phone', e.target.value)}
									readOnly={saving}
								/>
							</div>
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
