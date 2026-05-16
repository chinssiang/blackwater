'use client';

import { useState } from 'react';
import { validateEmail } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
	Field,
	FieldError,
	FieldLabel,
} from '@/components/ui/Field';
import CustomPortableText from '@/components/CustomPortableText';
import type { PortableTextSimple } from 'sanity.types';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

type NewsletterData = {
	klaviyoListID?: string | null;
	heading?: string | null;
	subheading?: string | null;
	submitButtonText?: string | null;
	disclaimer?: PortableTextSimple | null;
	successHeading?: string | null;
	successBody?: string | null;
	errorHeading?: string | null;
	errorBody?: string | null;
};

export function Newsletter({
	data,
	className,
}: {
	data: NewsletterData;
	className?: string;
}) {
	const {
		klaviyoListID,
		heading,
		subheading,
		submitButtonText,
		disclaimer,
		successHeading,
		successBody,
		errorHeading,
		errorBody,
	} = data || {};

	const [email, setEmail] = useState('');
	const [formState, setFormState] = useState<FormState>('idle');
	const [validationError, setValidationError] = useState('');

	if (!klaviyoListID) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateEmail(email)) {
			setValidationError('Please enter a valid email address.');
			return;
		}

		setValidationError('');
		setFormState('submitting');

		try {
			const res = await fetch('/api/newsletter/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, listId: klaviyoListID }),
			});

			if (res.ok) {
				setEmail('');
				setFormState('success');
			} else {
				setFormState('error');
			}
		} catch {
			setFormState('error');
		}
	};

	if (formState === 'success') {
		return (
			<div className={className}>
				{successHeading && <p className="t-b-1 font-medium">{successHeading}</p>}
				{successBody && <p className="t-b-2 text-foreground">{successBody}</p>}
				{!successHeading && !successBody && (
					<p className="t-b-2 text-foreground">You&apos;re subscribed!</p>
				)}
			</div>
		);
	}

	if (formState === 'error') {
		return (
			<div className={className}>
				{errorHeading && <p className="t-b-1 font-medium">{errorHeading}</p>}
				{errorBody && <p className="t-b-2 text-foreground">{errorBody}</p>}
				{!errorHeading && !errorBody && (
					<p className="t-b-2 text-foreground">Something went wrong. Please try again.</p>
				)}
			</div>
		);
	}

	return (
		<div className={className}>
			{heading && <p className="t-b-1 font-medium">{heading}</p>}
			{subheading && <p className="t-b-2">{subheading}</p>}
			<form onSubmit={handleSubmit} noValidate>
				<Field data-invalid={!!validationError || undefined}>
					<FieldLabel htmlFor="newsletter-email" className="sr-only">
						Email address
					</FieldLabel>
					<div className="flex gap-2 items-start">
						<div className="flex-1 flex flex-col gap-1">
							<Input
								id="newsletter-email"
								type="email"
								placeholder="Your email"
								value={email}
								onChange={(e) => {
									setEmail(e.target.value);
									if (validationError) setValidationError('');
								}}
								aria-invalid={!!validationError}
								disabled={formState === 'submitting'}
								autoComplete="email"
							/>
							{validationError && <FieldError>{validationError}</FieldError>}
							{disclaimer && (
								<div className="t-b-3">
									<CustomPortableText blocks={disclaimer as any} />
								</div>
							)}
						</div>
						<Button
							type="submit"
							disabled={formState === 'submitting'}
							variant="outline"
						>
							{formState === 'submitting'
								? 'Subscribing…'
								: submitButtonText || 'Subscribe'}
						</Button>
					</div>
				</Field>
			</form>
		</div>
	);
}
