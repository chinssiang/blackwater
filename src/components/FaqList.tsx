import { cn, getSpacingClass } from '@/lib/utils';
import { buildRgbaCssString } from '@/lib/image-utils';
import CustomPortableText from '@/components/CustomPortableText';

type MaxWidthType = 'none' | 'xl' | 'l' | 'm' | 's' | 'xs';

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
	console.log('🚀 ~ FaqList ~ data:', data);
	const { heading, items, sectionAppearance } = data || {};

	const visible = (items ?? []).filter(
		(i) => i?.question && Array.isArray(i?.answer) && i.answer.length > 0
	);
	if (visible.length === 0) return null;

	const {
		backgroundColor,
		textColor,
		textAlign = 'text-left',
		maxWidth = 'm',
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
				xl: 'max-w-7xl',
				l: 'max-w-5xl',
				m: 'max-w-3xl',
				s: 'max-w-xl',
				xs: 'max-w-xs',
			} as const
		)[maxWidth] || 'max-w-3xl';

	return (
		<section
			className={cn(
				'wysiwyg px-contain mx-auto',
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
			<dl>
				{visible.map((item, i) => (
					<div key={item._id ?? i}>
						<dt>
							<h3>{item.question}</h3>
						</dt>
						<dd>
							<CustomPortableText blocks={item.answer} />
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
