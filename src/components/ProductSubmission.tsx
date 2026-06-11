'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Check } from '@/components/SvgIcons';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { cn, isValidUrl } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
	Field,
	FieldContent,
	FieldGroup,
	FieldLabel,
	FieldStatus,
} from '@/components/ui/Field';
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from '@/components/Popover';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

type FormValues = {
	name: string;
	email: string;
	productUrl: string;
};

// maxLength mirrors the API route's zod caps (productUrl leaves room for
// the auto-prepended protocol) so over-long pastes can't pass client
// validation only to get a generic 400 from the server.
const FIELDS = [
	{ name: 'name', type: 'text', maxLength: 200 },
	{ name: 'email', type: 'email', maxLength: 320 },
	{ name: 'productUrl', type: 'text', maxLength: 1990 },
] as const;

function ProductField({
	name,
	type,
	maxLength,
	control,
	label,
	placeholder,
}: {
	name: keyof FormValues;
	type: 'text' | 'email';
	maxLength: number;
	control: Control<FormValues>;
	label: string;
	placeholder: string;
}) {
	const [isFocused, setIsFocused] = useState(false);
	const id = `product-submission-${name}`;

	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<Field data-invalid={fieldState.invalid}>
					<FieldContent className="gap-1.5">
						<FieldLabel htmlFor={id}>{label}</FieldLabel>
						<div className="relative grid">
							<Input
								{...field}
								id={id}
								type={type}
								maxLength={maxLength}
								inputMode={name === 'productUrl' ? 'url' : undefined}
								placeholder={placeholder}
								aria-invalid={fieldState.invalid}
								className={cn({ 'pr-8': fieldState.invalid })}
								onFocus={() => setIsFocused(true)}
								onBlur={() => {
									field.onBlur();
									setIsFocused(false);
								}}
							/>
							<FieldStatus
								fieldState={fieldState}
								isFocused={isFocused}
								isShowErrorOnFocus
							/>
						</div>
					</FieldContent>
				</Field>
			)}
		/>
	);
}

export function ProductSubmission() {
	const t = useTranslations('productSubmission');
	const locale = useLocale();
	const reduce = useReducedMotion() ?? false;
	const [open, setOpen] = useState(false);
	const [formState, setFormState] = useState<FormState>('idle');
	const showSuccess = formState === 'success';

	const resolver = useMemo(
		() =>
			zodResolver(
				z.object({
					name: z.string().trim().min(1, t.validation.nameRequired).max(200),
					email: z
						.string()
						.trim()
						.min(1, t.validation.emailRequired)
						.email(t.validation.emailInvalid)
						.max(320),
					productUrl: z
						.string()
						.trim()
						.min(1, t.validation.urlRequired)
						.max(2000)
						.refine(isValidUrl, t.validation.urlInvalid),
				})
			),
		[t]
	);

	const form = useForm<FormValues>({
		resolver,
		defaultValues: { name: '', email: '', productUrl: '' },
	});

	// Reset is deferred past the popover close animation so the form
	// re-mount and the FAB revert don't compete in the same frames.
	const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (resetTimeout.current) clearTimeout(resetTimeout.current);
		},
		[]
	);

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		if (next) {
			// Reopened before the deferred reset fired — reset now so the
			// popover shows a fresh form instead of the stale success panel.
			if (resetTimeout.current) {
				clearTimeout(resetTimeout.current);
				resetTimeout.current = null;
				setFormState('idle');
				form.reset();
			}
			return;
		}
		resetTimeout.current = setTimeout(() => {
			resetTimeout.current = null;
			setFormState('idle');
			form.reset();
		}, 200);
	};

	const onSubmit = async (values: FormValues) => {
		setFormState('submitting');
		try {
			const productUrl = /^https?:\/\//i.test(values.productUrl)
				? values.productUrl
				: `https://${values.productUrl}`;
			const response = await fetch('/api/product-submission/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					// Keys are load-bearing: the API uses formData.email for
					// reply-to + the confirmation email, formData.name in the
					// subject, and locale for the confirmation language.
					formData: { ...values, productUrl },
					locale,
				}),
			});
			if (!response.ok) throw new Error(await response.text());
			form.reset();
			setFormState('success');
		} catch {
			setFormState('error');
		}
	};

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					size="icon-lg"
					aria-label={t.triggerLabel}
					className={cn(
						'pointer-events-auto size-12 shadow-default border-0 rounded-xl ',
						'transition-[border-radius,background-color,color]',
						reduce ? 'duration-0' : 'duration-300 ease-out',
						showSuccess
							? 'bg-success text-white'
							: 'bg-primary/90 hover:bg-primary backdrop-blur-lg'
					)}
				>
					<span className="grid size-5 place-items-center">
						<AnimatePresence initial={false}>
							{showSuccess ? (
								<motion.span
									key="check"
									className="col-start-1 row-start-1 inline-flex"
									initial={reduce ? false : { scale: 0, opacity: 0 }}
									animate={
										reduce
											? { opacity: 1 }
											: {
													scale: 1,
													opacity: 1,
													transition: {
														type: 'spring',
														stiffness: 500,
														damping: 22,
													},
												}
									}
									exit={
										reduce
											? { opacity: 0, transition: { duration: 0 } }
											: {
													scale: 0.6,
													opacity: 0,
													transition: { duration: 0.15, ease: 'easeOut' },
												}
									}
								>
									<Check className="size-5" />
								</motion.span>
							) : (
								<motion.span
									key="plus"
									className="col-start-1 row-start-1 inline-flex"
									initial={reduce ? false : { scale: 0.6, opacity: 0 }}
									animate={
										reduce
											? { opacity: 1 }
											: {
													scale: 1,
													opacity: 1,
													transition: { duration: 0.18, ease: 'easeOut' },
												}
									}
									exit={
										reduce
											? { opacity: 0, transition: { duration: 0 } }
											: {
													scale: 0.6,
													opacity: 0,
													transition: { duration: 0.15, ease: 'easeOut' },
												}
									}
								>
									<Plus className="size-5" />
								</motion.span>
							)}
						</AnimatePresence>
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="end"
				sideOffset={8}
				collisionPadding={12}
				className="z-popover w-80 max-h-(--radix-popover-content-available-height) gap-3 overflow-y-auto p-4"
			>
				<PopoverHeader>
					<PopoverTitle>{t.title}</PopoverTitle>
					<PopoverDescription>{t.description}</PopoverDescription>
				</PopoverHeader>
				{formState === 'success' ? (
					<p role="status" className="t-b-1">
						{t.success}
					</p>
				) : (
					<form onSubmit={form.handleSubmit(onSubmit)} noValidate>
						<FieldGroup className="gap-3">
							{FIELDS.map(({ name, type, maxLength }) => (
								<ProductField
									key={name}
									name={name}
									type={type}
									maxLength={maxLength}
									control={form.control}
									label={t.fields[name].label}
									placeholder={t.fields[name].placeholder}
								/>
							))}
						</FieldGroup>
						{formState === 'error' && (
							<p role="alert" className="t-b-2 text-destructive mt-3">
								{t.error}
							</p>
						)}
						<Button
							type="submit"
							disabled={formState === 'submitting'}
							className="mt-3 w-full"
						>
							{formState === 'submitting' ? t.submitting : t.submit}
						</Button>
					</form>
				)}
			</PopoverContent>
		</Popover>
	);
}
