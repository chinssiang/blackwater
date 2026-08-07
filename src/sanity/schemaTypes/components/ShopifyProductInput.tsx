'use client';

import React, { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { LaunchIcon, SearchIcon } from '@sanity/icons';
import {
	Badge,
	Button,
	Card,
	Flex,
	Spinner,
	Stack,
	Text,
	TextInput,
} from '@sanity/ui';
import { set, unset, type StringInputProps } from 'sanity';

// Search-as-you-type picker for pProduct.shopify.handle. Talks to
// /api/shopify/search (Admin API proxy); when that isn't configured it
// degrades to the plain string input so handles can still be pasted by hand.
// Only the handle is stored — the linked card is fetched live, so titles,
// thumbnails and status never go stale in the dataset.

type ShopifyProduct = {
	id: string;
	handle: string;
	title: string;
	status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
	imageUrl: string | null;
	adminUrl: string;
};

const STATUS_TONE = {
	ACTIVE: 'positive',
	DRAFT: 'caution',
	ARCHIVED: 'default',
} as const;

type SearchResponse = {
	ok: boolean;
	message?: string;
	products?: ShopifyProduct[];
};

// Async lookups are stored keyed by what they were fetched *for*; everything
// else (loading, idle, stale) is derived at render from key vs. current
// input, so effects never set state synchronously and out-of-order responses
// can't show under the wrong key.
type HandleLookup = {
	for: string;
	product: ShopifyProduct | null;
	state: 'ok' | 'notFound' | 'error';
};

type SearchLookup = {
	for: string;
	products: ShopifyProduct[];
};

async function fetchSearch(
	params: URLSearchParams
): Promise<{ status: number; body: SearchResponse }> {
	const res = await fetch(`/api/shopify/search?${params}`, {
		cache: 'no-store',
	});
	const body = (await res
		.json()
		.catch(() => ({ ok: false }))) as SearchResponse;
	return { status: res.status, body };
}

function Thumb({ product }: { product: ShopifyProduct }) {
	if (!product.imageUrl) {
		return (
			<Card tone="transparent" style={{ width: 33, height: 33 }} radius={1} />
		);
	}
	return (
		// eslint-disable-next-line @next/next/no-img-element -- Studio-only UI; the Shopify CDN isn't in next/image's remote allowlist.
		<img
			src={product.imageUrl}
			alt=""
			width={33}
			height={33}
			style={{ objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
		/>
	);
}

export function ShopifyProductInput(props: StringInputProps) {
	const { value, onChange, readOnly } = props;

	const [unconfigured, setUnconfigured] = useState(false);
	const [query, setQuery] = useState('');
	const [handleLookup, setHandleLookup] = useState<HandleLookup | null>(null);
	const [searchLookup, setSearchLookup] = useState<SearchLookup | null>(null);

	// Resolve the stored handle into a live product card.
	useEffect(() => {
		if (!value || handleLookup?.for === value) return;
		let cancelled = false;
		fetchSearch(new URLSearchParams({ handle: value }))
			.then(({ status, body }) => {
				if (cancelled) return;
				if (status === 503) {
					setUnconfigured(true);
					return;
				}
				const product = body.products?.[0] ?? null;
				setHandleLookup({
					for: value,
					product,
					state: !body.ok ? 'error' : product ? 'ok' : 'notFound',
				});
			})
			.catch(() => {
				if (!cancelled)
					setHandleLookup({ for: value, product: null, state: 'error' });
			});
		return () => {
			cancelled = true;
		};
	}, [value, handleLookup]);

	// Debounced search while unlinked.
	const trimmedQuery = query.trim();
	useEffect(() => {
		if (value || !trimmedQuery || searchLookup?.for === trimmedQuery) return;
		let cancelled = false;
		const timeout = setTimeout(() => {
			fetchSearch(new URLSearchParams({ q: trimmedQuery }))
				.then(({ status, body }) => {
					if (cancelled) return;
					if (status === 503) setUnconfigured(true);
					setSearchLookup({ for: trimmedQuery, products: body.products ?? [] });
				})
				.catch(() => {
					if (!cancelled)
						setSearchLookup({ for: trimmedQuery, products: [] });
				});
		}, 300);
		return () => {
			cancelled = true;
			clearTimeout(timeout);
		};
	}, [value, trimmedQuery, searchLookup]);

	if (unconfigured) {
		return (
			<Stack space={2}>
				<Text size={1} muted>
					Shopify search is not configured (SHOPIFY_ADMIN_API_TOKEN) — paste
					the product handle manually.
				</Text>
				{props.renderDefault(props)}
			</Stack>
		);
	}

	if (value) {
		const current = handleLookup?.for === value ? handleLookup : null;
		const linked = current?.product ?? null;
		return (
			<Card padding={2} radius={2} border>
				<Flex align="center" gap={3}>
					{!current ? <Spinner muted /> : linked ? <Thumb product={linked} /> : null}
					<Stack space={2} flex={1}>
						<Text size={1} weight="medium" textOverflow="ellipsis">
							{linked?.title ?? value}
						</Text>
						<Text size={1} muted textOverflow="ellipsis">
							{current?.state === 'notFound'
								? 'Not found in Shopify — check the handle'
								: current?.state === 'error'
									? 'Could not reach Shopify'
									: value}
						</Text>
					</Stack>
					{linked && (
						<Badge tone={STATUS_TONE[linked.status]}>{linked.status}</Badge>
					)}
					{linked && (
						<Button
							as="a"
							href={linked.adminUrl}
							target="_blank"
							rel="noopener noreferrer"
							icon={LaunchIcon}
							mode="bleed"
							title="Open in Shopify admin"
						/>
					)}
					{!readOnly && (
						<Button
							text="Unlink"
							mode="ghost"
							tone="critical"
							onClick={() => onChange(unset())}
						/>
					)}
				</Flex>
			</Card>
		);
	}

	const results = searchLookup?.for === trimmedQuery ? searchLookup.products : null;
	const searching = Boolean(trimmedQuery) && results === null;

	return (
		<Stack space={2}>
			<TextInput
				icon={SearchIcon}
				placeholder="Search Shopify products…"
				value={query}
				readOnly={readOnly}
				onChange={(event: ChangeEvent<HTMLInputElement>) =>
					setQuery(event.currentTarget.value)
				}
			/>
			{searching && (
				<Flex padding={2} justify="center">
					<Spinner muted />
				</Flex>
			)}
			{results && results.length === 0 && (
				<Card padding={2}>
					<Text size={1} muted>
						No products found
					</Text>
				</Card>
			)}
			{results && results.length > 0 && (
				<Stack space={1}>
					{results.map((product) => (
						<Card
							key={product.id}
							as="button"
							type="button"
							padding={2}
							radius={2}
							border
							onClick={() => {
								onChange(set(product.handle));
								setQuery('');
							}}
						>
							<Flex align="center" gap={3}>
								<Thumb product={product} />
								<Stack space={2} flex={1}>
									<Text size={1} weight="medium" textOverflow="ellipsis">
										{product.title}
									</Text>
									<Text size={1} muted textOverflow="ellipsis">
										{product.handle}
									</Text>
								</Stack>
								<Badge tone={STATUS_TONE[product.status]}>
									{product.status}
								</Badge>
							</Flex>
						</Card>
					))}
				</Stack>
			)}
		</Stack>
	);
}
