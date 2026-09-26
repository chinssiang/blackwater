'use client';

import React, { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
	Control,
	Controller,
	ControllerFieldState,
	FieldValues,
	useForm,
} from 'react-hook-form';
import * as z from 'zod';
import { fadeAnim } from '@/lib/animate';
import { cn, hasArrayValue } from '@/lib/utils';
import CustomPortableText from '@/components/CustomPortableText';
import { useLocale } from '@/components/LocaleProvider';
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
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import { motion } from 'motion/react';

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
}

interface CustomFormProps {
	id: string;
	data?: CustomFormData | null;
	className?: string;
	fieldGapX?: number;
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

		// The format checks chain onto one string schema rather than replacing it,
		// so a required email still says "required" when empty and an optional one
		// still accepts being left blank. `required` goes first because the
		// resolver reports only the first issue per field.
		let schema = z.string();

		if (required) {
			schema = schema.min(1, { message: 'This field is required' });
		}

		if (inputType === 'email') {
			schema = schema.email('Invalid email format');
		}

		if (inputType === 'tel') {
			schema = schema.regex(
				VALIDATION_PATTERNS.phone.value,
				VALIDATION_PATTERNS.phone.message
			);
		}

		if (minLength) {
			schema = schema.min(minLength, {
				message: `Must be at least ${minLength} characters`,
			});
		}

		shape[fieldName] = required ? schema : schema.optional().or(z.literal(''));
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

	// One derivation feeding both the `items` prop and the rendered options, so
	// the label the trigger shows can never drift from the item picked. Memoized
	// because Base UI keys its store on `items` by identity: a fresh array each
	// render re-runs its layout effect and re-renders <SelectValue>.
	const options = useMemo(
		() =>
			(selectOptions ?? []).map((item) => ({
				key: item._key,
				value: item.value ?? '',
				label: item.title,
			})),
		[selectOptions]
	);

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
					// `items` lets the trigger show the option's title before the popup has
					// ever mounted; without it Base UI can only echo the raw value.
					items={options}
					// null, not undefined: undefined would flip the select to uncontrolled,
					// and null is Base UI's "nothing selected", which shows the placeholder.
					value={controllerField.value || null}
					onValueChange={controllerField.onChange}
				>
					<SelectTrigger
						id={id}
						className={cn('w-full', { 'pr-8': fieldState.invalid })}
					>
						<SelectValue placeholder={placeholder ?? undefined} />
					</SelectTrigger>

					<SelectContent side="bottom" alignItemWithTrigger={false}>
						<SelectGroup>
							{options.map((item) => (
								<SelectItem key={item.key} value={item.value}>
									{item.label}
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
	const { formTitle, formFields, successMessage, errorMessage } = data || {};

	const locale = useLocale();
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

		// Deliberately NOT sending sendToEmail/emailSubject: the route resolves
		// both from pContact itself, so a caller cannot name the recipient. The
		// locale only picks which pContact translation to read.
		const bodyData = {
			locale,
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
				throw new Error(await response.text());
			}
			form.reset();

			setFormState(FORM_STATES.SUCCESS);
		} catch (error) {
			if (process.env.NODE_ENV !== 'production') {
				console.error('Form submission error:', error);
			}
			setFormState(FORM_STATES.ERROR);
		}
	};

	return (
		<form
			onSubmit={form.handleSubmit(onHandleSubmit)}
			className={cn(className)}
		>
			<div className="t-b-2 wysiwyg mb-15">
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
					<Spinner className="text-accent mr-3 -ml-1" />
				) : (
					'Submit'
				)}
			</Button>
		</form>
	);
}
