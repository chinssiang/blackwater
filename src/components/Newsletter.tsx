'use client';

import { useState } from 'react';
import { cn, validateEmail } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
	Field,
	FieldLabel,
	FieldStatus,
	FieldDescription,
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
	const [isFocused, setIsFocused] = useState(false);

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
				{successHeading && (
					<p className="t-b-1 font-medium">{successHeading}</p>
				)}
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
					<p className="t-b-2 text-foreground">
						Something went wrong. Please try again.
					</p>
				)}
			</div>
		);
	}

	return (
		<div
			className={cn(
				'flex gap-2 items-center justify-between w-full flex-wrap',
				className
			)}
		>
			<div className="space-y-1 basis-full">
				{heading && (
					<p className="t-b-1 text-balance font-medium mb-2">{heading}</p>
				)}
				{subheading && <p className="t-b-2 text-balance">{subheading}</p>}
			</div>

			<form
				onSubmit={handleSubmit}
				noValidate
				className="basis-full md:flex-1 mt-3"
			>
				<Field data-invalid={!!validationError || undefined}>
					<FieldLabel htmlFor="newsletter-email" className="sr-only">
						Email address
					</FieldLabel>
					<div className="relative flex flex-1 gap-3">
						<div className="relative flex-1">
							<Input
								id="newsletter-email"
								type="email"
								placeholder="Your email"
								value={email}
								onChange={(e) => {
									setEmail(e.target.value);
									if (validationError) setValidationError('');
								}}
								onFocus={() => setIsFocused(true)}
								onBlur={() => setIsFocused(false)}
								aria-invalid={!!validationError}
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
						>
							{formState === 'submitting'
								? 'Subscribing…'
								: submitButtonText || 'Subscribe'}
						</Button>
					</div>
				</Field>
				{disclaimer && (
					<div className="t-b-2 mt-3 text-pretty">
						<CustomPortableText blocks={disclaimer as any} />
					</div>
				)}
			</form>
		</div>
	);
}
