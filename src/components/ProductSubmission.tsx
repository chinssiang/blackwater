'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { cn, isValidUrl } from '@/lib/utils';
import useWindowDimensions from '@/hooks/useWindowDimensions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import {
	Field,
	FieldContent,
	FieldGroup,
	FieldLabel,
	FieldStatus,
} from '@/components/ui/Field';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/Dialog';
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

// Animated paper-plane shown inside the success panel: the plane lifts off
// (slides up-right and fades in) while its two strokes draw on, signalling
// the submission was sent. Falls back to a static icon when motion is reduced.
function SuccessSend({ reduce }: { reduce: boolean }) {
	return (
		<span className="grid size-12 place-items-center overflow-hidden rounded-full text-foreground">
			<motion.svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5}
				strokeLinecap="round"
				strokeLinejoin="round"
				className="size-10"
				aria-hidden="true"
				initial={reduce ? false : { x: -7, y: 7, opacity: 0 }}
				animate={{
					x: 0,
					y: 0,
					opacity: 1,
					transition: reduce
						? { duration: 0 }
						: { type: 'spring', stiffness: 260, damping: 18, delay: 0.05 },
				}}
			>
				<motion.path
					d="m22 2-7 20-4-9-9-4Z"
					initial={reduce ? false : { pathLength: 0 }}
					animate={{
						pathLength: 1,
						transition: reduce
							? { duration: 0 }
							: { duration: 0.4, ease: 'easeInOut', delay: 0.15 },
					}}
				/>
				<motion.path
					d="M22 2 11 13"
					initial={reduce ? false : { pathLength: 0 }}
					animate={{
						pathLength: 1,
						transition: reduce
							? { duration: 0 }
							: { duration: 0.3, ease: 'easeOut', delay: 0.45 },
					}}
				/>
			</motion.svg>
		</span>
	);
}

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

	// `useWindowDimensions` returns the real width on the client's first render
	// but 0 on the server, so gate the container choice behind a mount flag:
	// server + first client render use the Popover branch (matching markup, no
	// hydration mismatch), then we switch to the mobile Dialog after mount. The
	// closed trigger is identical in both, so the swap is invisible.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const { isDesktop } = useWindowDimensions();
	const useMobileDialog = mounted && !isDesktop;

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

	// The state revert is deferred past the popover close animation so the
	// success panel swap and the FAB revert don't compete in the same frames.
	// Field values are intentionally never reset on close — typed input
	// survives reopening (onSubmit clears them after a successful send).
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
			// Reopened before the deferred revert fired — revert now so the
			// popover shows the form instead of the stale success panel.
			if (resetTimeout.current) {
				clearTimeout(resetTimeout.current);
				resetTimeout.current = null;
				setFormState('idle');
			}
			return;
		}
		resetTimeout.current = setTimeout(() => {
			resetTimeout.current = null;
			setFormState('idle');
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

	// Shared across the desktop popover and the mobile sheet.
	const fab = (
		<Button
			size="icon-lg"
			aria-label={t.triggerLabel}
			className={cn(
				'pointer-events-auto relative size-12 border-0 bg-transparent text-white',
				showSuccess ? 'rounded-full' : 'rounded-xl'
			)}
		>
			<svg
				viewBox="0 0 48 48"
				className="absolute inset-0 size-full"
				aria-hidden="true"
			>
				<motion.rect
					x="0"
					y="0"
					width="48"
					height="48"
					initial={false}
					animate={{ rx: showSuccess ? 24 : 12 }}
					transition={
						reduce
							? { duration: 0 }
							: { type: 'spring', stiffness: 300, damping: 25 }
					}
					className={cn(
						'transition-[fill]',
						reduce ? 'duration-0' : 'duration-300',
						showSuccess
							? 'fill-success'
							: 'fill-primary/95 group-hover/button:fill-primary'
					)}
				/>
			</svg>
			<span className="relative grid size-5 place-items-center">
				<AnimatePresence initial={false}>
					{showSuccess ? (
						<motion.svg
							key="check"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							strokeLinejoin="round"
							className="col-start-1 row-start-1 size-5"
							exit={{
								opacity: 0,
								transition: {
									duration: reduce ? 0 : 0.15,
									ease: 'easeOut',
								},
							}}
						>
							<motion.path
								d="M4 12 9 17 20 6"
								initial={reduce ? false : { pathLength: 0 }}
								animate={{
									pathLength: 1,
									transition: reduce
										? { duration: 0 }
										: { duration: 0.36, ease: 'easeInOut', delay: 0.2 },
								}}
							/>
						</motion.svg>
					) : (
						<motion.svg
							key="plus"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							strokeLinejoin="round"
							className="col-start-1 row-start-1 size-5"
							exit={{
								opacity: 0,
								transition: {
									duration: reduce ? 0 : 0.15,
									ease: 'easeOut',
								},
							}}
						>
							<motion.path
								d="M5 12h14"
								initial={reduce ? false : { pathLength: 0 }}
								animate={{
									pathLength: 1,
									transition: reduce
										? { duration: 0 }
										: { duration: 0.25, ease: 'easeOut', delay: 0.1 },
								}}
							/>
							<motion.path
								d="M12 5v14"
								initial={reduce ? false : { pathLength: 0 }}
								animate={{
									pathLength: 1,
									transition: reduce
										? { duration: 0 }
										: { duration: 0.25, ease: 'easeOut', delay: 0.3 },
								}}
							/>
						</motion.svg>
					)}
				</AnimatePresence>
			</span>
		</Button>
	);

	const fields = FIELDS.map(({ name, type, maxLength }) => (
		<ProductField
			key={name}
			name={name}
			type={type}
			maxLength={maxLength}
			control={form.control}
			label={t.fields[name].label}
			placeholder={t.fields[name].placeholder}
		/>
	));

	const submitContent =
		formState === 'submitting' ? (
			<>
				<Spinner className="text-accent" />
				<span className="sr-only">{t.submitting}</span>
			</>
		) : (
			t.submit
		);

	// Shared form block; mobile uses a larger submit for touch targets.
	const formBlock = (
		<form onSubmit={form.handleSubmit(onSubmit)} noValidate>
			<FieldGroup className="gap-3">{fields}</FieldGroup>
			{formState === 'error' && (
				<p role="alert" className="t-b-2 text-destructive mt-3">
					{t.error}
				</p>
			)}
			<Button
				type="submit"
				size={useMobileDialog ? 'xl' : undefined}
				disabled={formState === 'submitting'}
				className="mt-3 w-full"
			>
				{submitContent}
			</Button>
		</form>
	);

	// Mobile: a dialog anchored near the top so the keyboard can't cover it.
	// Position is set with inline styles in iOS-safe units (no `svh`, which
	// older iOS Safari ignores — that left the panel off-screen, overlay-only)
	// and via top/left/right + auto margins instead of a transform, so the
	// open zoom animation can't fight the positioning. It fades/zooms in place.
	if (useMobileDialog) {
		return (
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogTrigger asChild>{fab}</DialogTrigger>
				<DialogContent className="max-h-[85svh] gap-3 overflow-y-auto rounded-xl p-4">
					<DialogHeader className="pr-8 text-left">
						<DialogTitle>{t.title}</DialogTitle>
						<DialogDescription>{t.description}</DialogDescription>
					</DialogHeader>
					{showSuccess ? (
						<div
							role="status"
							className="flex flex-col items-center gap-4 py-4 text-center"
						>
							<SuccessSend reduce={reduce} />
							<p className="t-b-1">{t.success}</p>
						</div>
					) : (
						formBlock
					)}
				</DialogContent>
			</Dialog>
		);
	}

	// Desktop: keep the FAB + popover anchored to the trigger.
	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>{fab}</PopoverTrigger>
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
				{showSuccess ? (
					<p role="status" className="t-b-1">
						{t.success}
					</p>
				) : (
					formBlock
				)}
			</PopoverContent>
		</Popover>
	);
}
