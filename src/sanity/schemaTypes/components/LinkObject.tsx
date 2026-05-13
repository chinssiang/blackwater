'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { client } from '@/sanity/lib/client';
import {
	DocumentPdfIcon,
	LinkIcon,
	MasterDetailIcon,
	SearchIcon,
} from '@sanity/icons';
import { Autocomplete, Card, Flex, Stack, Switch, Text } from '@sanity/ui';
import { isValidUrl, validateEmail } from '@/lib/utils';
import { resolveHref } from '@/lib/routes';
import { set, unset, type ObjectInputProps } from 'sanity';

type LinkType = 'internal' | 'external';

type LinkValue = {
	_type?: string;
	linkType?: LinkType;
	internalLink?: { _type?: 'reference'; _ref?: string };
	href?: string;
	isNewTab?: boolean;
	/** legacy field, pre-migration */
	externalUrl?: string;
};

type OptionPayload = {
	pageTitle: string;
	_id?: string;
	_type?: string;
	slug?: string;
	route?: string;
	isInternal: boolean;
	isFile: boolean;
	fileSize?: number;
};

type LinkOption = {
	value: string;
	payload: OptionPayload;
	isNew?: boolean;
};

export const externalLinkDefaults = (
	href: string
): { linkType: LinkType; isNewTab: boolean } => ({
	linkType: 'external',
	isNewTab: !href.startsWith('#'),
});

const pageDocumentOrder = [
	'pHome',
	'pGeneral',
	'pCuratedIndex',
	'pCurated',
	'pCuratedCategory',
	'pCuratedCollection',
	'pEvents',
	'pEvent',
	'pContact',
	'pBlogIndex',
	'pBlog',
];

type PageFetch = {
	title?: string;
	_type: string;
	_id: string;
	slug?: string;
};

type FileFetch = {
	_id: string;
	originalFilename: string;
	url: string;
	size?: number;
};

const fetchOptions = async (): Promise<LinkOption[]> => {
	const groqQuery = `{
    "pages": * [_type in ${JSON.stringify(pageDocumentOrder)}] {
      title,
      _type,
      _id,
      "slug": slug.current,
    },
    "files": * [_type == "sanity.fileAsset" && mimeType == "application/pdf"] {
      _id,
      originalFilename,
      url,
      size
    }
  }`;

	const data = await client.fetch<{
		pages?: PageFetch[];
		files?: FileFetch[];
	}>(groqQuery);

	const sortOrderMap = new Map(pageDocumentOrder.map((type, i) => [type, i]));
	const DEFAULT_RANK = pageDocumentOrder.length;

	const getPageTitle = (type: string, title?: string): string =>
		type === 'pHome' ? 'Home Page' : title ?? '';

	const fileOptions: LinkOption[] = (data.files || []).map((fileItem) => ({
		value: fileItem.url,
		payload: {
			pageTitle: fileItem.originalFilename,
			_id: fileItem._id,
			_type: 'pdf',
			route: fileItem.url,
			isInternal: false,
			isFile: true,
			fileSize: fileItem.size,
		},
	}));

	const pageOptions: LinkOption[] = (data.pages || [])
		.map(({ _type, slug, _id, title }) => ({
			value: _id,
			payload: {
				pageTitle: getPageTitle(_type, title),
				_id,
				_type,
				slug,
				route: resolveHref({ documentType: _type, slug }),
				isInternal: true,
				isFile: false,
			},
		}))
		.sort((a, b) => {
			const rankA = sortOrderMap.has(a.payload._type!)
				? sortOrderMap.get(a.payload._type!)!
				: DEFAULT_RANK;
			const rankB = sortOrderMap.has(b.payload._type!)
				? sortOrderMap.get(b.payload._type!)!
				: DEFAULT_RANK;
			return rankA - rankB;
		});

	return [...pageOptions, ...fileOptions];
};

const optionIconStyle = { fontSize: 36 };

const renderOption = (option: LinkOption) => {
	const { isNew, payload } = option;
	const { pageTitle, route, isFile, fileSize } = payload;

	const formatFileSize = (bytes?: number): string => {
		if (!bytes) return '';
		const mb = bytes / (1024 * 1024);
		return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
	};

	return (
		<Card as="button" padding={[4, 2]}>
			<Flex>
				{isNew ? (
					<LinkIcon style={optionIconStyle} />
				) : isFile ? (
					<DocumentPdfIcon style={optionIconStyle} />
				) : (
					<MasterDetailIcon style={optionIconStyle} />
				)}
				<Stack space={2} flex={1} paddingLeft={1}>
					<Text size={[1, 1, 2]} textOverflow="ellipsis">
						{pageTitle}
					</Text>
					<Text size={1} muted>
						{isFile && fileSize
							? `${route} • ${formatFileSize(fileSize)}`
							: route || option.value}
					</Text>
				</Stack>
			</Flex>
		</Card>
	);
};

export const LinkObject = (props: ObjectInputProps<LinkValue>) => {
	const { elementProps, onChange, schemaType, value } = props;
	const hideNewTab = (
		schemaType?.options as { hideNewTab?: boolean } | undefined
	)?.hideNewTab;
	const [loading, setLoading] = useState(true);
	const [pageItemData, setPageItemData] = useState<LinkOption[]>([]);
	const [optionsList, setOptionsList] = useState<LinkOption[]>([]);

	const handleChange = useCallback(
		(selectedValue: string) => {
			if (!selectedValue) {
				onChange([
					set('internal', ['linkType']),
					unset(['internalLink']),
					unset(['href']),
				]);
				return;
			}

			const selectedOption = optionsList.find(
				(option) => option.value === selectedValue
			);

			if (selectedOption?.payload?.isInternal) {
				onChange([
					set('internal', ['linkType']),
					set({ _type: 'reference', _ref: selectedValue }, ['internalLink']),
					unset(['href']),
					set(false, ['isNewTab']),
				]);
			} else {
				const isBareEmail =
					!selectedValue.startsWith('mailto:') &&
					validateEmail(selectedValue);
				const hrefValue = isBareEmail
					? `mailto:${selectedValue}`
					: selectedValue;
				const { linkType, isNewTab } = externalLinkDefaults(hrefValue);

				onChange([
					set(linkType, ['linkType']),
					unset(['internalLink']),
					set(hrefValue, ['href']),
					set(isNewTab, ['isNewTab']),
				]);
			}
		},
		[onChange, optionsList]
	);

	const handleQueryChange = useCallback(
		(query: string | null) => {
			const q = query ?? '';
			const filteredOptions = pageItemData.filter(({ payload }) => {
				const queryLower = q.toLowerCase();

				return (
					payload.route?.toLowerCase().includes(queryLower) ||
					payload.pageTitle?.toLowerCase().includes(queryLower) ||
					payload._id?.toLowerCase().includes(queryLower)
				);
			});

			const isSpecialLink =
				q.startsWith('mailto:') || q.startsWith('tel:');
			const isHashLink = q.startsWith('#') && q.length > 1;
			const isEmail = !isSpecialLink && validateEmail(q);
			const processedQuery = isEmail ? `mailto:${q}` : q;

			const result: LinkOption[] = filteredOptions.length
				? filteredOptions
				: isValidUrl(q) || isSpecialLink || isHashLink || isEmail
					? [
							{
								value: processedQuery,
								payload: {
									pageTitle: processedQuery,
									route: processedQuery,
									isInternal: false,
									isFile: false,
								},
								isNew: true,
							},
						]
					: pageItemData;

			setOptionsList(result);
		},
		[pageItemData]
	);

	useEffect(() => {
		const loadPageItems = async () => {
			setLoading(true);
			const result = await fetchOptions();
			setPageItemData(result);
			setOptionsList(result);
			setLoading(false);
		};
		loadPageItems();
	}, []);

	// Pasted <a> tags or legacy data arrive with href but no linkType — set it once.
	useEffect(() => {
		if (value?.href && !value.linkType) {
			const { linkType, isNewTab } = externalLinkDefaults(value.href);
			onChange([set(linkType, ['linkType']), set(isNewTab, ['isNewTab'])]);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value?.href, value?.linkType]);

	const getCurrentValue = useCallback((): string => {
		if (!value) return '';
		const { internalLink, linkType, href } = value;

		if (linkType === 'internal' && internalLink?._ref) {
			const referencedPage = pageItemData.find(
				(page) => page.value === internalLink._ref
			);
			if (referencedPage) {
				return referencedPage.value;
			}
			return internalLink._ref;
		}

		if (linkType === 'external' && href) {
			return href;
		}

		// Defensive: legacy `externalUrl` from pre-migration content.
		if (linkType === 'external' && value.externalUrl) {
			return value.externalUrl;
		}

		return '';
	}, [value, pageItemData]);

	const getDisplayTitle = useCallback(
		(currentValue: LinkValue | undefined): string => {
			if (!currentValue) return '';

			if (
				currentValue.linkType === 'internal' &&
				currentValue.internalLink?._ref
			) {
				const referencedPage = pageItemData.find(
					(page) => page.value === currentValue.internalLink?._ref
				);
				return referencedPage
					? referencedPage.payload.pageTitle
					: currentValue.internalLink._ref;
			}

			const externalHref = currentValue.href || currentValue.externalUrl;
			if (currentValue.linkType === 'external' && externalHref) {
				const fileOption = pageItemData.find(
					(item) => item.payload.isFile && item.value === externalHref
				);
				return fileOption ? fileOption.payload.pageTitle : externalHref;
			}

			return '';
		},
		[pageItemData]
	);

	const handleNewTabChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			onChange(set(e.currentTarget.checked, ['isNewTab']));
		},
		[onChange]
	);

	return (
		<Stack space={3}>
			<Autocomplete
				{...elementProps}
				loading={loading}
				disabled={loading}
				options={optionsList}
				value={getCurrentValue()}
				openButton
				filterOption={() => true}
				onChange={handleChange}
				onQueryChange={handleQueryChange}
				icon={SearchIcon}
				placeholder="Paste a link or search"
				renderOption={renderOption as (option: unknown) => React.ReactElement}
				renderValue={(currentValue: string, option?: LinkOption) => {
					if (!option) {
						return getDisplayTitle(value);
					}
					return option.payload.pageTitle;
				}}
			/>
			{!hideNewTab && (
				<Flex as="label" align="center" gap={2} style={{ cursor: 'pointer' }}>
					<Switch
						checked={value?.isNewTab || false}
						onChange={handleNewTabChange}
					/>
					<Text size={1} muted>
						Open in new tab
					</Text>
				</Flex>
			)}
		</Stack>
	);
};
