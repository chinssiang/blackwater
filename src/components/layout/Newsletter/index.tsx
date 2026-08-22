'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { fadeAnim } from '@/lib/animate';
import { cn, validateEmail } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field, FieldLabel, FieldStatus } from '@/components/ui/Field';
import CustomPortableText from '@/components/CustomPortableText';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import type { SiteDataQueryResult } from 'sanity.types';

type FormState = 'idle' | 'submitting' | 'success';

/** The `newsletterFormFields` projection. Derived rather than restated so a
 *  change to that projection cannot leave a stale mirror compiling clean. */
export type NewsletterData = Partial<
	NonNullable<SiteDataQueryResult['newsletter']>
>;

export function Newsletter({
	data,
	className,
	setGlobalHeightVar = false,
	placement = 'footer',
}: {
	data: NewsletterData;
	className?: string;
	setGlobalHeightVar?: boolean;
	/** Reported to Klaviyo as custom_source. This one component serves both the
	 *  global footer and the dedicated /newsletter page, which were previously
	 *  both attributed to the footer. */
	placement?: 'footer' | 'page';
}) {
	const {
		signupEnabled,
		heading,
		subheading,
		submitButtonText,
		disclaimer,
		successHeading,
		successBody,
		errorHeading,
		errorBody,
	} = data || {};

	const t = useTranslations('newsletter');
	const locale = useLocale();

	const [email, setEmail] = useState('');
	const [formState, setFormState] = useState<FormState>('idle');
	const [validationError, setValidationError] = useState('');
	const [isFocused, setIsFocused] = useState(false);
	const [formHeight, setFormHeight] = useState<number | null>(null);
	const sectionRef = useRef<HTMLDivElement>(null);
	const formRef = useRef<HTMLFormElement>(null);

	useEffect(() => {
		if (!setGlobalHeightVar) return;
		const el = sectionRef.current;
		if (!el) return;
		const root = document.documentElement;
		const observer = new ResizeObserver(([entry]) => {
			const height =
				entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
			root.style.setProperty('--h-newsletter', `${height + 2}px`);
		});
		observer.observe(el);
		return () => {
			observer.disconnect();
			root.style.removeProperty('--h-newsletter');
		};
	}, [setGlobalHeightVar]);

	useEffect(() => {
		const el = formRef.current;
		if (!el) return;
		const observer = new ResizeObserver(([entry]) => {
			const height =
				entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
			setFormHeight(height);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [formState]);

	// Not this locale's own list id — see `newsletterFormFields` in queries.ts.
	if (!signupEnabled) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateEmail(email)) {
			setValidationError(t.invalidEmail);
			return;
		}

		setValidationError('');
		setFormState('submitting');

		try {
			const res = await fetch('/api/newsletter/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, locale, placement }),
			});

			if (res.ok) {
				setEmail('');
				setFormState('success');
			} else if (res.status === 429) {
				// Distinct from a generic failure: retrying immediately cannot work,
				// so saying "please try again" would send the visitor in a loop.
				toast.error(t.rateLimitedHeading, {
					description: t.rateLimitedBody,
				});
				setFormState('idle');
			} else {
				toast.error(errorHeading || t.errorHeading, {
					description: errorBody || t.errorBody,
				});
				setFormState('idle');
				// Logged after the toast so draining the body doesn't delay it. The
				// route's reason is the only signal a misconfigured list produces.
				const detail = await res.text();
				console.error(
					'[newsletter] subscribe failed',
					locale,
					res.status,
					detail
				);
			}
		} catch {
			toast.error(errorHeading || t.errorHeading, {
				description: errorBody || t.errorBody,
			});
			setFormState('idle');
		}
	};

	return (
		<div ref={sectionRef} className={cn('text-foreground', className)}>
			{heading && (
				<p className="t-h-1 text-balance font-medium mb-3">{heading}</p>
			)}

			{formState === 'success' ? (
				<motion.div
					key="newsletter-success"
					initial="hide"
					animate="show"
					variants={fadeAnim}
					transition={{
						duration: 0.6,
						delay: 0.1,
						ease: [0, 0.71, 0.2, 1.01],
					}}
					className="max-w-sm flex flex-col justify-center"
					style={formHeight ? { minHeight: formHeight } : undefined}
					role="status"
					aria-live="polite"
				>
					{/* Dictionary fallback, matching the error path: both Sanity fields
					    are optional, and without a fallback a successful subscribe
					    swapped the form out for an empty box. */}
					<p className="t-b-1 font-medium">
						{successHeading || t.successHeading}
					</p>
					<p className="t-b-2 mt-1 text-pretty">
						{successBody || t.successBody}
					</p>
				</motion.div>
			) : (
				<div className="space-y-4 w-full md:flex-1 md:max-w-[500px]">
					{subheading && <p className="t-b-1 text-balance">{subheading}</p>}
					<form
						ref={formRef}
						onSubmit={handleSubmit}
						noValidate
						className="max-w-sm"
					>
						<Field data-invalid={!!validationError || undefined}>
							<FieldLabel htmlFor="newsletter-email" className="sr-only">
								{t.emailLabel}
							</FieldLabel>
							<div className="relative flex flex-1 gap-3">
								<div className="field-hint-ring relative flex-1">
									<Input
										id="newsletter-email"
										type="email"
										placeholder={t.emailPlaceholder}
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
									size="lg"
									className="bg-black text-white min-w-22"
								>
									{formState === 'submitting'
										? t.submitting
										: submitButtonText || t.submit}
								</Button>
							</div>
						</Field>
					</form>
					{disclaimer && (
						<div className="t-b-2 text-pretty">
							<CustomPortableText blocks={disclaimer as any} />
						</div>
					)}
				</div>
			)}
		</div>
	);
}
