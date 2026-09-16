'use client';

import { cn } from '@/lib/utils';
import CustomPortableText from '@/components/CustomPortableText';
import SectionShell, {
	type SectionAppearance,
} from '@/components/SectionShell';

type FreeformProps = {
	data: any;
	className?: string;
};

export default function Freeform({ data, className }: FreeformProps) {
	const { content, sectionAppearance } = data;

	return (
		<SectionShell
			appearance={sectionAppearance as SectionAppearance}
			// `wysiwyg` is this module's own contribution to the class list; the
			// container, alignment, max-width and spacing all come from the shell.
			className={cn('wysiwyg', className)}
		>
			<CustomPortableText blocks={content} />
		</SectionShell>
	);
}
