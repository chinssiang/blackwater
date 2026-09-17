'use client';

import React from 'react';
import type { Page404QueryResult } from '@/../sanity.types';
import CustomLink from '@/components/CustomLink';
import CustomPortableText from '@/components/CustomPortableText';
import { buttonVariants } from '@/components/ui/Button';

// Picked from the generated query result rather than restated, so a projection
// change fails `tsc` here instead of silently drifting. The hand-written version
// this replaces declared every field non-null, which page404Query never
// guarantees.
type Page404Data = Pick<
	NonNullable<Page404QueryResult>,
	'heading' | 'paragraph' | 'callToAction'
>;

// `data` accepts null, not just undefined: page404Query is a `[0]` projection,
// so it yields null on a dataset with no p404 document, and both callers pass
// the query result straight through. The `data || {}` below already handles it.
export function PageNotFound({ data }: { data?: Page404Data | null }) {
	const { heading, paragraph, callToAction } = data || {};

	return (
		<div className="min-h-main wysiwyg flex flex-col items-center justify-center">
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
