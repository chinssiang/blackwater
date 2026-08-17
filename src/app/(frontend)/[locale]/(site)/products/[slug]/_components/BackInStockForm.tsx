'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn, validateEmail } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field, FieldLabel, FieldStatus } from '@/components/ui/Field';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { interpolate } from '@/lib/dictionary';

type FormState = 'idle' | 'submitting';

// Matches the hard-coded input id below — this form renders at most once per
// page (only under a sold-out product), so neither needs useId.
const ERROR_ID = 'back-in-stock-email-error';

type Props = {
	productTitle: string;
	productSlug: string;
};

export default function BackInStockForm({ productTitle, productSlug }: Props) {
	const locale = useLocale();
	const notify = useTranslations('products').notify;

	const [email, setEmail] = useState('');
	const [formState, setFormState] = useState<FormState>('idle');
	const [validationError, setValidationError] = useState('');
	const [isFocused, setIsFocused] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateEmail(email)) {
			setValidationError(notify.invalidEmail);
			return;
		}

		setValidationError('');
		setFormState('submitting');

		try {
			const res = await fetch('/api/products/back-in-stock', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, productSlug, productTitle, locale }),
			});

			if (res.ok) {
				setEmail('');
				toast.success(notify.successHeading, {
					description: notify.successBody,
				});
				setFormState('idle');
			} else {
				toast.error(notify.errorHeading, { description: notify.errorBody });
				setFormState('idle');
			}
		} catch {
			toast.error(notify.errorHeading, { description: notify.errorBody });
			setFormState('idle');
		}
	};

	return (
		<div className="mt-6 max-w-sm">
			<p className="t-l-1 mb-3 uppercase text-foreground/65">{notify.title}</p>
			<form onSubmit={handleSubmit} noValidate>
				<Field data-invalid={!!validationError || undefined}>
					<FieldLabel htmlFor="back-in-stock-email" className="sr-only">
						{notify.emailLabel}
					</FieldLabel>
					<div className="relative flex gap-3">
						<div className="relative flex-1">
							<Input
								id="back-in-stock-email"
								type="email"
								placeholder={notify.emailPlaceholder}
								value={email}
								onChange={(e) => {
									setEmail(e.target.value);
									if (validationError) setValidationError('');
								}}
								onFocus={() => setIsFocused(true)}
								onBlur={() => setIsFocused(false)}
								aria-invalid={!!validationError}
								aria-describedby={validationError ? ERROR_ID : undefined}
								aria-label={interpolate(notify.ariaLabel, {
									product: productTitle,
								})}
								disabled={formState === 'submitting'}
								autoComplete="email"
								className={cn({ 'pr-8': !!validationError })}
							/>
							<FieldStatus
								fieldState={{
									invalid: !!validationError,
									error: validationError
										? { message: validationError }
										: undefined,
								}}
								isFocused={isFocused}
								isShowErrorOnFocus={true}
							/>
						</div>
						<Button
							type="submit"
							disabled={formState === 'submitting'}
							variant="outline"
							size="lg"
							className="min-w-24 uppercase"
						>
							{formState === 'submitting' ? notify.submitting : notify.submit}
						</Button>
					</div>
					{/* FieldStatus above renders the message only as a tooltip hung off
					    an icon, which reaches neither a screen reader (the tooltip
					    describes the icon, not this input) nor a sighted user who isn't
					    hovering. This is the message's real channel; the icon stays as
					    inline reinforcement. Fixed here rather than in Field.tsx, which
					    has three other consumers.

					    `text-red-700`, not the `text-error` token: that token is
					    red-600, which is 4.26:1 on the light product background — fine
					    for the 20px icon it was written for, short of AA for 12px text. */}
					{validationError && (
						<p
							id={ERROR_ID}
							role="alert"
							className="t-b-2 mt-2 text-red-700"
						>
							{validationError}
						</p>
					)}
				</Field>
			</form>
		</div>
	);
}
