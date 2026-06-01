import { cn, getSpacingClass } from '@/lib/utils';
import { buildRgbaCssString } from '@/lib/image-utils';
import CustomPortableText from '@/components/CustomPortableText';
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from '@/components/ui/Accordion';

type MaxWidthType = 'none' | 'xl' | 'lg' | 'md' | 's' | 'xs';

export type FaqItem = {
	_id?: string;
	question?: string | null;
	answer?: any;
	answerText?: string | null;
};

type FaqListProps = {
	data: {
		heading?: string;
		items?: FaqItem[];
		sectionAppearance?: any;
	};
	className?: string;
};

export default function FaqList({ data, className }: FaqListProps) {
	const { heading, items, sectionAppearance } = data || {};

	const visible = (items ?? []).filter(
		(i) => i?.question && Array.isArray(i?.answer) && i.answer.length > 0
	);
	if (visible.length === 0) return null;

	const {
		backgroundColor,
		textColor,
		textAlign = 'text-left',
		maxWidth = 'md',
		spacingTop,
		spacingBottom,
		spacingTopDesktop,
		spacingBottomDesktop,
	} = (sectionAppearance as {
		backgroundColor?: any;
		textColor?: any;
		textAlign?: string;
		maxWidth?: MaxWidthType;
		spacingTop?: any;
		spacingBottom?: any;
		spacingTopDesktop?: any;
		spacingBottomDesktop?: any;
	}) || {};

	const hasBackground = !!backgroundColor;

	const spacingClasses = [
		getSpacingClass('marginTop', spacingTop, hasBackground),
		getSpacingClass('marginBottom', spacingBottom, hasBackground),
		getSpacingClass('marginTopDesktop', spacingTopDesktop, hasBackground),
		getSpacingClass('marginBottomDesktop', spacingBottomDesktop, hasBackground),
	].filter(Boolean);

	const maxWidthClasses =
		(
			{
				none: 'w-full',
				xl: 'p-x-xl',
				lg: 'p-x-lg',
				md: 'p-x-md',
				s: 'p-x-s',
				xs: 'p-x-xs',
			} as const
		)[maxWidth] || 'p-x-md';

	return (
		<section
			className={cn(
				'wysiwyg mx-auto',
				textAlign,
				maxWidthClasses,
				...spacingClasses,
				className
			)}
			style={{
				color: buildRgbaCssString(textColor) || 'inherit',
				backgroundColor: buildRgbaCssString(backgroundColor) || undefined,
			}}
		>
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
		</section>
	);
}
