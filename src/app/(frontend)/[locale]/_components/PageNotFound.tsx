'use client';
import React from 'react';
import CustomLink from '@/components/CustomLink';
import { Button } from '@/components/ui/Button';
import CustomPortableText from '@/components/CustomPortableText';

import { PortableTextBlock } from '@portabletext/types';

interface Page404Data {
	heading?: string;
	paragraph?: PortableTextBlock[];
	callToAction?: { link: { href: string }; label: string };
}

export function PageNotFound({ data }: { data?: Page404Data }) {
	const { heading, paragraph, callToAction } = data || {};

	return (
		<div className="min-h-[inherit] wysiwyg flex flex-col justify-center items-center">
			<h1 className="t-h-6 uppercase">{heading || 'Page not found'}</h1>

			{paragraph && <CustomPortableText blocks={paragraph} />}

			{callToAction && callToAction?.link && callToAction?.label && (
				<Button asChild>
					<CustomLink link={callToAction.link}>{callToAction.label}</CustomLink>
				</Button>
			)}
		</div>
	);
}
