'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Check } from '@/components/SvgIcons';
import { stegaClean } from '@sanity/client/stega';
import { useTranslations } from '@/components/LocaleProvider';
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

const EMAIL_SUBJECT = 'Product Submission';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

type FormValues = {
	name: string;
	email: string;
	productUrl: string;
};

const FIELDS = [
	{ name: 'name', type: 'text' },
	{ name: 'email', type: 'email' },
	{ name: 'productUrl', type: 'text' },
] as const;

function ProductField({
	name,
	type,
	control,
	label,
	placeholder,
}: {
	name: keyof FormValues;
	type: 'text' | 'email';
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

export function ProductSubmission({
	recipientEmail,
}: {
	recipientEmail: string;
}) {
	const t = useTranslations('productSubmission');
	const pathname = usePathname();
	const reduce = useReducedMotion() ?? false;
	const [open, setOpen] = useState(false);
	const [formState, setFormState] = useState<FormState>('idle');
	const showSuccess = formState === 'success';

	// Mounted outside the pathname-keyed <Main>, so it survives client
	// navigation — close the popover when the route changes.
	useEffect(() => setOpen(false), [pathname]);

	const resolver = useMemo(
		() =>
			zodResolver(
				z.object({
					name: z.string().trim().min(1, t.validation.nameRequired),
					email: z
						.string()
						.trim()
						.min(1, t.validation.emailRequired)
						.email(t.validation.emailInvalid),
					productUrl: z
						.string()
						.trim()
						.min(1, t.validation.urlRequired)
						.refine(isValidUrl, t.validation.urlInvalid),
				})
			),
		[t]
	);

	const form = useForm<FormValues>({
		resolver,
		defaultValues: { name: '', email: '', productUrl: '' },
	});

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) {
			setFormState('idle');
			form.reset();
		}
	};

	const onSubmit = async (values: FormValues) => {
		setFormState('submitting');
		try {
			const productUrl = /^https?:\/\//i.test(values.productUrl)
				? values.productUrl
				: `https://${values.productUrl}`;
			const response = await fetch('/api/contact-form/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sendToEmail: stegaClean(recipientEmail),
					emailSubject: EMAIL_SUBJECT,
					// Keys are load-bearing: the API uses formData.email as
					// reply-to and appends [formData.name] to the subject.
					formData: { ...values, productUrl },
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
						'fixed right-contain bottom-[calc(var(--height-g-toolbar)+1rem)] z-g-toolbar size-12 shadow-default lg:bottom-6 border-0 backdrop-blur-lg rounded-xl',
						reduce ? 'duration-0' : 'duration-300 ease-out',
						showSuccess
							? 'bg-success text-white hover:bg-success'
							: 'bg-primary/90 hover:bg-primary'
					)}
				>
					<AnimatePresence mode="wait" initial={false}>
						{showSuccess ? (
							<motion.span
								key="check"
								className="inline-flex"
								initial={reduce ? false : { scale: 0, opacity: 0 }}
								animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
								exit={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
								transition={
									reduce
										? { duration: 0 }
										: { type: 'spring', stiffness: 500, damping: 22 }
								}
							>
								<Check className="size-5" />
							</motion.span>
						) : (
							<motion.span
								key="plus"
								className="inline-flex"
								initial={false}
								animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
								exit={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
								transition={reduce ? { duration: 0 } : { duration: 0.15 }}
							>
								<Plus className="size-5" />
							</motion.span>
						)}
					</AnimatePresence>
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
							{FIELDS.map(({ name, type }) => (
								<ProductField
									key={name}
									name={name}
									type={type}
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
