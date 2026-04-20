'use client';
import CustomPortableText from '@/components/CustomPortableText';
import { CustomForm } from '@/components/CustomForm';

interface PageContactData {
	title?: string | null;
	description?: string | null;
	contactForm?: {
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
	} | null;
	legalConsent?: any;
}

interface PageContactProps {
	data?: PageContactData;
}

export function PageContact({ data }: PageContactProps) {
	const { title, description, contactForm, legalConsent } = data || {};

	return (
		<div className="p-x-max m-auto flex flex-col md:flex-row md:justify-center min-h-main gap-2.5 py-10 lg:py-17.5">
			<div className="md:flex-1 space-y-2 text-left w-full">
				{title && <h1 className="t-h-5 uppercase">{title}</h1>}
				{description && <p>{description}</p>}
			</div>
			<div className="md:flex-1 flex flex-col">
				<div className="max-w-md">
					<CustomForm
						id="page-contact-form"
						data={contactForm}
						className="[&_button[type=submit]]:w-full [&_label]:uppercase [&_button[type=submit]]:sticky [&_button[type=submit]]:bottom-[calc(var(--height-g-toolbar)+1rem)] [&_button[type=submit]]:md:relative [&_button[type=submit]]:md:bottom-0"
						fieldGapX={10}
					/>
					{legalConsent && (
						<div className="mt-4 t-b-2 wysiwyg">
							<CustomPortableText blocks={legalConsent as any} />
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
