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
	className?: string;
};

export default function FaqBlock({ data, className }: FaqBlockProps) {
	const { heading, items, sectionAppearance } = data || {};

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
			    `t-h-3 uppercase` the events and products strips use. */}
			{heading && <h2>{heading}</h2>}
			<Accordion type="single" collapsible>
				{visible.map((item, i) => {
					const value = item._id ?? `faq-${i}`;
					return (
						<AccordionItem key={value} value={value}>
							<AccordionTrigger>{item.question}</AccordionTrigger>
							<AccordionContent className="[&_p]:leading-[125%]">
								<CustomPortableText blocks={item.answer} />
							</AccordionContent>
						</AccordionItem>
					);
				})}
			</Accordion>
		</SectionShell>
	);
}
