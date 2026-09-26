'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { interpolate } from '@/lib/dictionary';
import {
	CODE_LENGTH,
	LOCALE_HEADER,
	SIGN_IN_ERRORS,
} from '@/lib/member/shared';
import { cn, validateEmail } from '@/lib/utils';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel, FieldStatus } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

type Step = 'email' | 'code';

/** One line under the field: an error, or the "new code sent" notice. One
 *  state rather than two, so setting either always clears the other. */
type Message = { kind: 'error' | 'notice'; text: string } | null;

const ERROR_ID = 'sign-in-error';

/**
 * Two steps on one page: an email, then the code emailed to it. A member row
 * is created by the first successful code, so signing up and signing in are
 * the same flow.
 *
 * Plain fetch to Better Auth's endpoints, like the site's other forms, rather
 * than its client library: this page is the only caller, and the endpoints
 * and their error codes are pinned by src/lib/member/auth.test.ts.
 */
export function SignInForm() {
	const t = useTranslations('account').signIn;
	const locale = useLocale();
	const router = useRouter();

	const [step, setStep] = useState<Step>('email');
	const [email, setEmail] = useState('');
	const [code, setCode] = useState('');
	const [message, setMessage] = useState<Message>(null);
	const [submitting, setSubmitting] = useState(false);
	const codeInput = useRef<HTMLInputElement>(null);

	const error = message?.kind === 'error' ? message.text : '';
	const setError = (text: string) => setMessage({ kind: 'error', text });

	// The heading and the field both change under the member, so put them
	// where the next keystroke goes.
	useEffect(() => {
		if (step === 'code') codeInput.current?.focus();
	}, [step]);

	const failed = (res?: Response) => {
		if (res?.status === 429) {
			// Retrying at once cannot work, so "try again" would be a loop.
			toast.error(t.rateLimitedHeading, { description: t.rateLimitedBody });
		} else {
			toast.error(t.errorHeading, { description: t.errorBody });
		}
	};

	/** Returns whether a code is on its way. */
	const sendCode = async () => {
		const res = await fetch('/api/auth/email-otp/send-verification-otp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', [LOCALE_HEADER]: locale },
			body: JSON.stringify({ email, type: 'sign-in' }),
		}).catch(() => undefined);
		if (res?.ok) return true;
		// Only the email step has an email field to attach that message to; on
		// the code step (a resend) it would sit under the code.
		if (res?.status === 400 && step === 'email') setError(t.invalidEmail);
		else failed(res);
		return false;
	};

	const onSubmitEmail = async (e: React.FormEvent) => {
		e.preventDefault();
		if (submitting) return;
		if (!validateEmail(email)) return setError(t.invalidEmail);
		setMessage(null);
		setSubmitting(true);
		if (await sendCode()) setStep('code');
		setSubmitting(false);
	};

	// The two secondary actions ignore a click while a request is in flight
	// rather than disabling: a disabled button drops keyboard focus to <body>,
	// and the "new code sent" notice below is announced from where focus stays.
	const onResend = async () => {
		if (submitting) return;
		setMessage(null);
		setCode('');
		setSubmitting(true);
		if (await sendCode()) setMessage({ kind: 'notice', text: t.resent });
		setSubmitting(false);
	};

	const onChangeEmail = () => {
		if (submitting) return;
		setStep('email');
		setCode('');
		setMessage(null);
	};

	const onSubmitCode = async (e: React.FormEvent) => {
		e.preventDefault();
		if (submitting) return;
		if (code.length !== CODE_LENGTH) return setError(t.invalidCode);
		setMessage(null);
		setSubmitting(true);
		const res = await fetch('/api/auth/sign-in/email-otp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, otp: code }),
		}).catch(() => undefined);
		if (res?.ok) {
			// The page is dynamic, so a refresh re-renders it signed in.
			// `submitting` stays set: the form is about to be replaced.
			router.refresh();
			return;
		}
		const body = await res?.json().catch(() => undefined);
		const reason = (body as { code?: string } | undefined)?.code;
		if (reason === SIGN_IN_ERRORS.invalid) setError(t.invalidCode);
		else if (reason === SIGN_IN_ERRORS.expired) setError(t.expiredCode);
		else if (reason === SIGN_IN_ERRORS.tooManyAttempts)
			setError(t.tooManyAttempts);
		else failed(res);
		setSubmitting(false);
	};

	// The props both steps' inputs share. `readOnly`, never `disabled`, while a
	// request is in flight: disabling the field the member just pressed Enter in
	// throws focus to <body>, and nothing brings it back when the code is wrong.
	const inputProps = {
		'aria-invalid': !!error,
		'aria-describedby': error ? ERROR_ID : undefined,
		readOnly: submitting,
	};

	if (step === 'email') {
		return (
			<>
				<h1 className="t-h-1 mb-3 font-medium text-balance">{t.heading}</h1>
				<p className="t-b-1 mb-6 text-pretty">{t.intro}</p>
				<InlineField
					id="sign-in-email"
					label={t.emailLabel}
					submitLabel={t.sendCode}
					submittingLabel={t.sending}
					onSubmit={onSubmitEmail}
					submitting={submitting}
					error={error}
				>
					<Input
						{...inputProps}
						id="sign-in-email"
						type="email"
						autoComplete="email"
						placeholder={t.emailPlaceholder}
						value={email}
						onChange={(e) => {
							setEmail(e.target.value);
							if (error) setMessage(null);
						}}
					/>
				</InlineField>
				<p className="t-b-2 text-foreground/60 mt-4 text-pretty">{t.privacy}</p>
			</>
		);
	}

	return (
		<>
			<h1 className="t-h-1 mb-3 font-medium text-balance">{t.codeHeading}</h1>
			<p className="t-b-1 mb-6 wrap-break-word">
				{interpolate(t.codeSentTo, { email })}
			</p>
			<InlineField
				id="sign-in-code"
				label={t.codeLabel}
				submitLabel={t.verify}
				submittingLabel={t.verifying}
				onSubmit={onSubmitCode}
				submitting={submitting}
				error={error}
			>
				<Input
					{...inputProps}
					ref={codeInput}
					id="sign-in-code"
					// A numeric keypad on phones, and iOS/Android offer the code
					// straight from the incoming email.
					inputMode="numeric"
					autoComplete="one-time-code"
					pattern="[0-9]*"
					maxLength={CODE_LENGTH}
					value={code}
					onChange={(e) => {
						setCode(e.target.value.replace(/\D/g, ''));
						if (error) setMessage(null);
					}}
					className="tracking-[0.3em]"
				/>
			</InlineField>
			<p role="status" className="t-b-2 mt-3 min-h-[1.5em]">
				{message?.kind === 'notice' ? message.text : ''}
			</p>
			<div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
				<Button
					type="button"
					variant="link"
					className="h-auto px-0"
					onClick={onResend}
					aria-disabled={submitting || undefined}
				>
					{t.resend}
				</Button>
				<Button
					type="button"
					variant="link"
					className="h-auto px-0"
					onClick={onChangeEmail}
					aria-disabled={submitting || undefined}
				>
					{t.changeEmail}
				</Button>
			</div>
		</>
	);
}

/** A labelled input with its submit button beside it. The error shows as the
 *  contact forms' icon-and-tooltip (FieldStatus) inside the input; the text
 *  also stays in the DOM, visually hidden, because the tooltip only mounts
 *  while open and the input's aria-describedby needs a target. */
function InlineField({
	id,
	label,
	submitLabel,
	submittingLabel,
	onSubmit,
	submitting,
	error,
	children,
}: {
	id: string;
	label: string;
	submitLabel: string;
	submittingLabel: string;
	onSubmit: (e: React.FormEvent) => void;
	submitting: boolean;
	error: string;
	children: React.ReactNode;
}) {
	// Focus events bubble in React, so the wrapper sees the input's without
	// either step's <Input> having to report it.
	const [isFocused, setIsFocused] = useState(false);

	return (
		<form onSubmit={onSubmit} noValidate>
			<Field data-invalid={!!error || undefined}>
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
				<div className="flex gap-3">
					<div
						className={cn('relative grid flex-1', error && '[&_input]:pr-8')}
						onFocus={() => setIsFocused(true)}
						onBlur={() => setIsFocused(false)}
					>
						{children}
						<FieldStatus
							fieldState={{ invalid: !!error, error: { message: error } }}
							isFocused={isFocused}
						/>
					</div>
					{/* aria-disabled for the same focus reason as the inputs; the
					    handlers ignore a submit while busy. */}
					<Button
						type="submit"
						variant="outline"
						size="lg"
						aria-disabled={submitting || undefined}
						className="min-w-22 bg-black text-white aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
					>
						{/* Both labels share one grid cell, so the button is always as
						    wide as the longer one and the input beside it never
						    shifts. `invisible` also drops the idle one from the
						    accessible name. */}
						<span className="grid text-center">
							<span
								className={cn(
									'col-start-1 row-start-1',
									submitting && 'invisible'
								)}
							>
								{submitLabel}
							</span>
							<span
								className={cn(
									'col-start-1 row-start-1',
									!submitting && 'invisible'
								)}
							>
								{submittingLabel}
							</span>
						</span>
					</Button>
				</div>
				{error && (
					<p id={ERROR_ID} role="alert" className="sr-only">
						{error}
					</p>
				)}
			</Field>
		</form>
	);
}
