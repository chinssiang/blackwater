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
				</Field>
			</form>
		</div>
	);
}
