'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { externalLinkDefaults } from '@/sanity/schemaTypes/components/LinkObject';
import { set } from 'sanity';

type LinkMarkDef = {
	_key?: string;
	_type?: string;
	href?: string;
	linkType?: string;
};

type Block = {
	_key?: string;
	_type?: string;
	markDefs?: LinkMarkDef[];
};

// Sanity's input prop unions don't narrow cleanly when registered on a portable
// text array, so we accept a minimal structural shape and call renderDefault as
// the lib expects.
type NormalizerProps = {
	value?: Block[];
	readOnly?: boolean;
	onChange: (patches: unknown) => void;
	renderDefault: (props: unknown) => ReactNode;
};

export const PortableTextNormalizer = (props: NormalizerProps) => {
	const { value, onChange, readOnly, renderDefault } = props;

	useEffect(() => {
		if (readOnly || !Array.isArray(value)) return;

		const patches = [];
		for (const block of value) {
			if (!block || block._type !== 'block' || !block._key) continue;
			const markDefs = block.markDefs;
			if (!Array.isArray(markDefs)) continue;
			for (const mark of markDefs) {
				if (
					!mark ||
					mark._type !== 'link' ||
					!mark._key ||
					!mark.href ||
					mark.linkType
				) {
					continue;
				}
				const basePath = [
					{ _key: block._key },
					'markDefs',
					{ _key: mark._key },
				];
				const { linkType, isNewTab } = externalLinkDefaults(mark.href);
				patches.push(set(linkType, [...basePath, 'linkType']));
				patches.push(set(isNewTab, [...basePath, 'isNewTab']));
			}
		}

		if (patches.length) onChange(patches);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value, readOnly]);

	return renderDefault(props);
};
