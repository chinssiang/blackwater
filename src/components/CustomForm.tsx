'use client';
import { motion } from 'motion/react';
import { fadeAnim } from '@/lib/animate';
import CustomPortableText from '@/components/CustomPortableText';
import React, { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
	Controller,
	useForm,
	FieldValues,
	Control,
	ControllerFieldState,
} from 'react-hook-form';
import * as z from 'zod';
import { cn, hasArrayValue, formatObjectToHtml } from '@/lib/utils';

import { Button } from '@/components/ui/Button';
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldStatus,
} from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectGroup,
} from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';

// Type definitions
type FormState = 'idle' | 'submitting' | 'success' | 'error';

const FORM_STATES: Record<string, FormState> = {
	IDLE: 'idle',
	SUBMITTING: 'submitting',
	SUCCESS: 'success',
	ERROR: 'error',
} as const;

interface ValidationPattern {
	value: RegExp;
	message: string;
}

const VALIDATION_PATTERNS: Record<string, ValidationPattern> = {
	email: {
		value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
		message: 'Please enter a valid email address',
	},
	phone: {
		value:
			/^(\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})$/,
		message: 'Please enter a valid phone number',
	},
};

interface SelectOption {
	_key: string;
	value: string | null;
	title: string | null;
}

interface FormField {
	_key: string;
	fieldName?: string | null;
	fieldLabel: string | null;
	required?: boolean | null;
	inputType?:
		| 'text'
		| 'email'
		| 'tel'
		| 'textarea'
		| 'select'
		| 'checkbox'
		| 'file'
		| null;
	minLength?: number;
	placeholder?: string | null;
	selectOptions?: SelectOption[] | null;
	fieldWidth?: 'full' | 'half' | null;
	description?: string | null;
}

interface CustomFormData {
	formTitle: any;
	formFields: Array<{
		placeholder: string | null;
		_key: string;
		required: boolean | null;
		fieldLabel: string | null;
		inputType:
			| 'checkbox'
			| 'email'
			| 'file'
			| 'select'
			| 'tel'
			| 'text'
			| 'textarea'
			| null;
		fieldName: string | null;
		fieldWidth: 'full' | 'half' | null;
		selectOptions: Array<{
			_key: string;
			title: string | null;
			value: string | null;
		}> | null;
	}> | null;
	successMessage: string | null;
	errorMessage: string | null;
	sendToEmail: string | null;
	emailSubject: string | null;
	formFailureNotificationEmail: string | null;
}

interface CustomFormProps {
	id: string;
	data?: CustomFormData | null;
	className?: string;
	fieldGapX?: number;
}

interface EmailData {
	email: string;
	emailSubject: string;
	emailHtmlContent: string;
}

interface SendEmailParams {
	apiUrl: string;
	emailData: EmailData;
}

interface SendErrorNotificationParams {
	emailTo: string;
	bodyData: {
		sendToEmail?: string;
		emailSubject?: string;
		formData: FieldValues;
	};
	errorInfo: string;
}

interface EmailResult {
	success: boolean;
	attempts: number;
	lastError?: Error;
}

interface FieldComponentTypeProps {
	id: string;
	field: FormField;
	fieldState: ControllerFieldState;
	controllerField: any; // You can use ControllerRenderProps from react-hook-form for more specific typing
}

interface FormItemProps {
	form: {
		control: Control<any>;
		handleSubmit: any;
		reset: () => void;
	};
	field: FormField;
}

export function createDynamicResolver(fieldsArray: FormField[]) {
	const shape: Record<string, z.ZodTypeAny> = {};

	fieldsArray.forEach((field) => {
		const { fieldName, required, inputType, minLength } = field;
		if (!fieldName) return;

		let schema: z.ZodTypeAny = z.string();

		if (required) {
			schema = z.string().min(1, { message: 'This field is required' });
		} else {
			schema = z.string().optional().or(z.literal(''));
		}

		if (inputType === 'email') {
			schema = z.string().email('Invalid email format');
		}

		if (inputType === 'tel') {
			schema = z
				.string()
				.regex(
					VALIDATION_PATTERNS.phone.value,
					VALIDATION_PATTERNS.phone.message
				);
		}

		if (minLength) {
			schema = z.string().min(minLength, {
				message: `Must be at least ${minLength} characters`,
			});
		}

		shape[fieldName] = schema;
	});
	return zodResolver(z.object(shape));
}

const FieldComponentType: React.FC<FieldComponentTypeProps> = ({
	id,
	field,
	fieldState,
	controllerField,
}) => {
	const { inputType, placeholder, selectOptions } = field || {};

	switch (inputType) {
		case 'textarea':
			return (
				<Textarea
					{...controllerField}
					id={id}
					placeholder={placeholder}
					className={cn('h-40 resize-none')}
				/>
			);
		case 'select':
			return (
				<Select
					name={field.fieldName ?? undefined}
					value={controllerField.value || undefined}
					onValueChange={controllerField.onChange}
				>
					<SelectTrigger
						id={id}
						className={cn('w-full', { ' pr-8': fieldState.invalid })}
					>
						<SelectValue placeholder={placeholder ?? undefined} />
					</SelectTrigger>

					<SelectContent side="bottom" position="popper">
						<SelectGroup>
							{selectOptions?.map((item) => (
								<SelectItem key={item._key} value={item.value ?? ''}>
									{item.title}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			);
		default:
			return (
				<Input
					{...controllerField}
					id={id}
					placeholder={placeholder}
					className={cn({ 'pr-8': fieldState.invalid })}
				/>
			);
	}
};

const FormItem: React.FC<FormItemProps> = ({ form, field }) => {
	const { fieldLabel, fieldWidth, description, inputType } = field;
	const [isFocused, setIsFocused] = useState<boolean>(false);

	return (
		<Controller
			name={field.fieldName ?? ''}
			control={form.control}
			render={({ field: controllerField, fieldState }) => {
				const isInvalid = fieldState.invalid;
				const id = (field.fieldName ?? field._key) + '-' + field._key;
				return (
					<Field
						orientation="horizontal"
						data-invalid={isInvalid}
						className={cn('basis-full', {
							'basis-[calc(50%-var(--gap-x)/2)]': fieldWidth === 'half',
						})}
					>
						<FieldContent>
							<FieldLabel
								htmlFor={id}
								className={cn({
									"after:content-['*']": field.required,
								})}
							>
								{fieldLabel}
							</FieldLabel>
							{description && (
								<FieldDescription>{description}</FieldDescription>
							)}
							<div className="relative grid">
								<FieldComponentType
									id={id}
									field={field}
									controllerField={{
										...controllerField,
										onFocus: () => {
											setIsFocused(true);
										},
										onBlur: () => {
											controllerField?.onBlur?.();
											setIsFocused(false);
										},
									}}
									fieldState={fieldState}
								/>
								<FieldStatus
									fieldState={fieldState}
									isFocused={isFocused}
									isShowErrorOnFocus={true}
									className={cn({
										'top-5': inputType === 'textarea',
									})}
								/>
							</div>
						</FieldContent>
					</Field>
				);
			}}
		/>
	);
};

export function CustomForm({
	id,
	data,
	className,
	fieldGapX,
}: CustomFormProps) {
	const {
		formTitle,
		formFields,
		successMessage,
		errorMessage,
		sendToEmail,
		emailSubject,
		formFailureNotificationEmail,
	} = data || {};

	const [formState, setFormState] = useState<FormState>(FORM_STATES.IDLE);

	const defaultValues = useMemo(() => {
		if (!hasArrayValue(formFields)) return {};

		return formFields.reduce((acc: Record<string, string>, item) => {
			const name = item.fieldName || '';
			if (name) acc[name] = '';
			return acc;
		}, {});
	}, [formFields]);

	const form = useForm({
		resolver: createDynamicResolver(formFields || []),
		defaultValues,
		mode: 'onSubmit',
	});

	if (!hasArrayValue(formFields)) return null;

	const onHandleSubmit = async (formData: FieldValues) => {
		setFormState(FORM_STATES.SUBMITTING);

		const bodyData = {
			sendToEmail: sendToEmail ?? undefined,
			emailSubject: emailSubject ?? undefined,
			formData: formData,
		};

		try {
			const response = await fetch('/api/contact-form/submit', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(bodyData),
			});

			if (!response.ok) {
				const errorText = await response.text();
				sendErrorNotificationEmail({
					emailTo: formFailureNotificationEmail || '',
					bodyData: bodyData,
					errorInfo: errorText,
				});
				setFormState(FORM_STATES.ERROR);
				throw new Error(errorText);
			}
			form.reset();

			setFormState(FORM_STATES.SUCCESS);
		} catch (error) {
			if (process.env.NODE_ENV !== 'production') {
				console.error('Form submission error:', error);
			}
			setFormState(FORM_STATES.ERROR);
			sendErrorNotificationEmail({
				emailTo: formFailureNotificationEmail || '',
				bodyData: bodyData,
				errorInfo: error instanceof Error ? error.message : String(error),
			});
		}
	};

	return (
		<form
			onSubmit={form.handleSubmit(onHandleSubmit)}
			className={cn(className)}
		>
			<div className="t-b-2 mb-15 wysiwyg">
				{formTitle && <CustomPortableText blocks={formTitle as any} />}
				{formState === FORM_STATES.SUCCESS && (
					<motion.p
						key={FORM_STATES.SUCCESS}
						initial="hide"
						animate="show"
						variants={fadeAnim}
						transition={{
							duration: 0.6,
							delay: 0.3,
							ease: [0, 0.71, 0.2, 1.01],
						}}
						className="t-b-1 bg-success p-2"
					>
						{successMessage || 'Success. Your message has been sent.'}
					</motion.p>
				)}
				{formState === FORM_STATES.ERROR && (
					<motion.p
						key={FORM_STATES.ERROR}
						initial="hide"
						animate="show"
						variants={fadeAnim}
						transition={{
							duration: 0.6,
							delay: 0.3,
							ease: [0, 0.71, 0.2, 1.01],
						}}
						className="t-b-1 bg-error p-2"
					>
						{errorMessage ||
							'Error. There was an issue submitting your message. Please try again later.'}
					</motion.p>
				)}
			</div>
			<FieldGroup
				className="flex flex-wrap gap-x-(--gap-x) gap-y-4"
				style={{ '--gap-x': `${fieldGapX}px` } as React.CSSProperties}
			>
				{formFields.map((field) => (
					<FormItem key={field._key} field={field} form={form} />
				))}
			</FieldGroup>
			<Button
				type="submit"
				disabled={formState === FORM_STATES.SUBMITTING}
				className="mt-15 cursor-pointer"
				size="xl"
			>
				{formState === FORM_STATES.SUBMITTING ? (
					<svg
						className="mr-3 -ml-1 size-5 animate-spin text-accent"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							className="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							strokeWidth="4"
						></circle>
						<path
							className="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				) : (
					'Submit'
				)}
			</Button>
		</form>
	);
}

/**
 * Sends an error notification email with form data and error information.
 * Attempts multiple backup email endpoints if primary fails.
 * @param {string} params.emailTo - Recipient email address
 * @param {Object} params.formData - Form data to include in email
 * @param {string} params.errorInfo - Error information to include in email
 * @returns {Promise<{success: boolean, attempts: number, lastError?: Error}>}
 */
async function sendErrorNotificationEmail({
	emailTo,
	bodyData,
	errorInfo,
}: SendErrorNotificationParams): Promise<EmailResult> {
	const { sendToEmail, emailSubject, formData } = bodyData;
	const emailData: EmailData = {
		email: emailTo,
		emailSubject: emailSubject || 'Form Submission Error',
		emailHtmlContent: `
			<p>
				Your form failed to send. Please notify your website administrator. A backup is provided below.
			</p>
			<p>
				<strong>Error Details: </strong><br>
				Page URL: ${window.location.href}<br>
				Timestamp: ${new Date().toISOString()}<br>
				${formatObjectToHtml(errorInfo)}
			</p>
      <p>
				<strong>Form Data: </strong><br>
				Send to: ${sendToEmail}<br>
				Subject: ${emailSubject}<br>
				${formatObjectToHtml(formData)}
			</p>`,
	};

	async function sendEmail({
		apiUrl,
		emailData,
	}: SendEmailParams): Promise<boolean> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

		try {
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(emailData),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`HTTP error! status: ${response.status}, body: ${errorText}`
				);
			}

			return true;
		} catch (error) {
			if (process.env.NODE_ENV !== 'production') {
				console.error(`Email sending failed for ${apiUrl}:`, error);
			}
			return false;
		} finally {
			clearTimeout(timeout);
		}
	}

	const emailApiUrls: string[] = [
		'/api/send-notification-email',
		'/api/send-backup-email',
		'/api/send-backup-email?useTransporter2=true',
	];

	let attempts = 0;
	let lastError: Error | null = null;

	for (const apiUrl of emailApiUrls) {
		attempts++;

		try {
			const success = await sendEmail({ apiUrl, emailData });
			if (success) {
				return { success: true, attempts };
			}
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			console.error(`Attempt ${attempts} failed:`, error);
		}

		// Add delay between retries
		if (attempts < emailApiUrls.length) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}

	return {
		success: false,
		attempts,
		lastError: lastError || undefined,
	};
}
