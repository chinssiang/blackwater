'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { interpolate } from '@/lib/dictionary';
import {
	CODE_LENGTH,
	LOCALE_HEADER,
	SIGN_IN_ERRORS,
} from '@/lib/member/shared';
import { validateEmail } from '@/lib/utils';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

type Step = 'email' | 'code';

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
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const codeInput = useRef<HTMLInputElement>(null);

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
		if (res?.status === 400) setError(t.invalidEmail);
		else failed(res);
		return false;
	};

	const onSubmitEmail = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validateEmail(email)) return setError(t.invalidEmail);
		setError('');
		setSubmitting(true);
		if (await sendCode()) setStep('code');
		setSubmitting(false);
	};

	// The two secondary actions ignore a click while a request is in flight
	// rather than disabling: a disabled button drops keyboard focus to <body>,
	// and the "new code sent" notice below is announced from where focus stays.
	const onResend = async () => {
		if (submitting) return;
		setError('');
		setNotice('');
		setCode('');
		setSubmitting(true);
		if (await sendCode()) setNotice(t.resent);
		setSubmitting(false);
	};

	const onChangeEmail = () => {
		if (submitting) return;
		setStep('email');
		setCode('');
		setError('');
		setNotice('');
	};

	const onSubmitCode = async (e: React.FormEvent) => {
		e.preventDefault();
		if (code.length !== CODE_LENGTH) return setError(t.invalidCode);
		setError('');
		setNotice('');
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

	const errorId = 'sign-in-error';
	const submitClass = 'min-w-22 bg-black text-white';

	if (step === 'email') {
		return (
			<>
				<h1 className="t-h-1 mb-3 font-medium text-balance">{t.heading}</h1>
				<p className="t-b-1 mb-6 text-pretty">{t.intro}</p>
				<form onSubmit={onSubmitEmail} noValidate>
					<Field data-invalid={!!error || undefined}>
						<FieldLabel htmlFor="sign-in-email">{t.emailLabel}</FieldLabel>
						<div className="flex gap-3">
							<Input
								id="sign-in-email"
								type="email"
								autoComplete="email"
								placeholder={t.emailPlaceholder}
								value={email}
								onChange={(e) => {
									setEmail(e.target.value);
									if (error) setError('');
								}}
								aria-invalid={!!error}
								aria-describedby={error ? errorId : undefined}
								disabled={submitting}
							/>
							<Button
								type="submit"
								variant="outline"
								size="lg"
								disabled={submitting}
								className={submitClass}
							>
								{submitting ? t.sending : t.sendCode}
							</Button>
						</div>
						{error && (
							<p id={errorId} role="alert" className="t-b-2 text-destructive">
								{error}
							</p>
						)}
					</Field>
				</form>
				<p className="t-b-2 text-foreground/60 mt-4 text-pretty">{t.privacy}</p>
			</>
		);
	}

	return (
		<>
			<h1 className="t-h-1 mb-3 font-medium text-balance">{t.codeHeading}</h1>
			<p className="t-b-1 mb-6 break-words">
				{interpolate(t.codeSentTo, { email })}
			</p>
			<form onSubmit={onSubmitCode} noValidate>
				<Field data-invalid={!!error || undefined}>
					<FieldLabel htmlFor="sign-in-code">{t.codeLabel}</FieldLabel>
					<div className="flex gap-3">
						<Input
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
								if (error) setError('');
							}}
							aria-invalid={!!error}
							aria-describedby={error ? errorId : undefined}
							disabled={submitting}
							className="tracking-[0.3em]"
						/>
						<Button
							type="submit"
							variant="outline"
							size="lg"
							disabled={submitting}
							className={submitClass}
						>
							{submitting ? t.verifying : t.verify}
						</Button>
					</div>
					{error && (
						<p id={errorId} role="alert" className="t-b-2 text-destructive">
							{error}
						</p>
					)}
				</Field>
			</form>
			<p role="status" className="t-b-2 mt-3 min-h-[1.5em]">
				{notice}
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
