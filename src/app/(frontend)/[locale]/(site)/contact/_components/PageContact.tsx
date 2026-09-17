import { CustomForm } from '@/components/CustomForm';
import CustomPortableText from '@/components/CustomPortableText';

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
	} | null;
	legalConsent?: any;
}

interface PageContactProps {
	data?: PageContactData;
}

export function PageContact({ data }: PageContactProps) {
	const { title, description, contactForm, legalConsent } = data || {};

	return (
		<div className="p-x-max min-h-main m-auto flex flex-col gap-2.5 py-10 md:flex-row md:justify-center lg:py-17.5">
			<div className="w-full space-y-2 text-left md:flex-1">
				{title && <h1 className="t-h-2 uppercase">{title}</h1>}
				{description && <p>{description}</p>}
			</div>

			<div className="max-w-md flex-1">
				<CustomForm
					id="page-contact-form"
					data={contactForm}
					className="[&_button[type=submit]]:sticky [&_button[type=submit]]:bottom-[calc(var(--height-g-toolbar)+1rem)] [&_button[type=submit]]:w-full [&_button[type=submit]]:md:relative [&_button[type=submit]]:md:bottom-0 [&_label]:uppercase"
					fieldGapX={10}
				/>
				{legalConsent && (
					<div className="t-b-2 wysiwyg mt-4">
						<CustomPortableText blocks={legalConsent as any} />
					</div>
				)}
			</div>
		</div>
	);
}
