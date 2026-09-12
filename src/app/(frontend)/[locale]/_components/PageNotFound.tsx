'use client';
import React from 'react';
import CustomLink from '@/components/CustomLink';
import { buttonVariants } from '@/components/ui/Button';
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
		<div className="min-h-main wysiwyg flex flex-col justify-center items-center">
			<h1 className="t-b-1 uppercase">{heading || 'Page not found'}</h1>

			{paragraph && <CustomPortableText blocks={paragraph} />}

			{callToAction && callToAction?.link && callToAction?.label && (
				<CustomLink link={callToAction.link} className={buttonVariants()}>
					{callToAction.label}
				</CustomLink>
			)}
		</div>
	);
}
