import SectionShell, {
	type SectionAppearance,
} from '@/components/SectionShell';
import CustomPortableText from '@/components/CustomPortableText';
import { cn } from '@/lib/utils';
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from '@/components/ui/Accordion';

export type FaqItem = {
	_id?: string;
	question?: string | null;
	answer?: any;
	answerText?: string | null;
};

type FaqBlockProps = {
	data: {
		heading?: string;
		items?: FaqItem[];
		sectionAppearance?: any;
	};
	headingLevel?: 'h1' | 'h2';
	className?: string;
};

export default function FaqBlock({
	data,
	headingLevel = 'h2',
	className,
}: FaqBlockProps) {
	const { heading, items, sectionAppearance } = data || {};
	// Not SectionShell's `heading` prop (see the note at the render below), so
	// this module switches the tag itself rather than inheriting the shell's.
	const Heading = headingLevel;

	const visible = (items ?? []).filter(
		(i) => i?.question && Array.isArray(i?.answer) && i.answer.length > 0
	);
	if (visible.length === 0) return null;

	return (
		<SectionShell
			// This module's own default predates the shared object's
			// `initialValue: { maxWidth: 'none' }`, so blocks authored before that was
			// added carry no value at all. Keeping the fallback here means they stay
			// the width they have always rendered at instead of going full-bleed.
			appearance={{
				...sectionAppearance,
				maxWidth: sectionAppearance?.maxWidth ?? 'm',
			}}
			className={cn('wysiwyg', className)}
		>
			{/* Rendered here rather than through SectionShell's `heading` prop: inside
			    `wysiwyg` the h2 picks up this module's prose styling, which is what it
			    has always looked like. The shell's own heading is the bare
			    `t-h-2 uppercase` the events and products strips use. Both paths read
			    --t-size-h2, so the two are the same size at every viewport -- they
			    were not until the prose scale and the token scale were joined. */}
			{heading && <Heading>{heading}</Heading>}
			<Accordion type="single" collapsible>
				{visible.map((item, i) => {
					const value = item._id ?? `faq-${i}`;
					return (
						<AccordionItem key={value} value={value}>
							<AccordionTrigger>{item.question}</AccordionTrigger>
							<AccordionContent>
								<CustomPortableText blocks={item.answer} />
							</AccordionContent>
						</AccordionItem>
					);
				})}
			</Accordion>
		</SectionShell>
	);
}
