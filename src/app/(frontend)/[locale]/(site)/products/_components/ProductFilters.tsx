'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/Sheet';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/Select';
import { useTranslations } from '@/components/LocaleProvider';
import useWindowDimensions from '@/hooks/useWindowDimensions';
import { interpolate, pickPlural } from '@/lib/dictionary';
import { cn } from '@/lib/utils';

export type FacetOption = {
	value: string;
	label: string;
	count: number;
	disabled?: boolean;
};
type Dimension = 'category' | 'brand' | 'badge' | 'price';

// URL param name per dimension is the Dimension string itself; the local state
// object keys are plural. This maps a dimension to its state key.
const DIMENSION_KEY = {
	category: 'categories',
	brand: 'brands',
	badge: 'badges',
	price: 'priceBuckets',
} as const;

type Props = {
	categories: FacetOption[];
	brands: FacetOption[];
	badges: FacetOption[];
	prices: FacetOption[];
	selected: {
		categories: string[];
		brands: string[];
		badges: string[];
		priceBuckets: string[];
	};
	sort: string;
	/** Total products matching the active filters, shown in the status line. */
	total: number;
	/**
	 * Show the result count in the status line. Off on pages that already show a
	 * count in their header (e.g. /products/all) so the number isn't duplicated.
	 */
	showCount?: boolean;
};

const SORT_KEYS = [
	'az',
	'za',
	'newest',
	'oldest',
	'price-asc',
	'price-desc',
] as const;

export default function ProductFilters({
	categories,
	brands,
	badges,
	prices,
	selected,
	sort,
	total,
	showCount = true,
}: Props) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const t = useTranslations('products');
	const { isSm } = useWindowDimensions();
	const prefersReducedMotion = useReducedMotion();
	const [isPending, startTransition] = useTransition();
	const [open, setOpen] = useState(false);
	// Phones get a bottom sheet (thumb-reachable); larger screens keep the side
	// drawer. The panel content only mounts on open, so width is resolved by then.
	const side = isSm ? 'bottom' : 'right';
	// Drawer checkboxes stage into a local draft; nothing is fetched until the
	// user taps "Show results". Sort and the active-filter chips stay live.
	const [draft, setDraft] = useState(selected);

	const filters = t.filters;
	const activeCount =
		selected.categories.length +
		selected.brands.length +
		selected.badges.length +
		selected.priceBuckets.length;

	// Push a new URL with the given param patches. Arrays/strings that are empty
	// drop the param entirely; every change resets pagination to page 1.
	function commit(patch: Record<string, string[] | string | null>) {
		const params = new URLSearchParams(searchParams.toString());
		params.delete('page');
		for (const [key, value] of Object.entries(patch)) {
			const isEmpty =
				value == null ||
				value === '' ||
				(Array.isArray(value) && value.length === 0);
			if (isEmpty) params.delete(key);
			else params.set(key, Array.isArray(value) ? value.join(',') : value);
		}
		const qs = params.toString();
		startTransition(() => {
			router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
		});
	}

	function toggle(dimension: Dimension, value: string) {
		const next = new Set(selected[DIMENSION_KEY[dimension]]);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		commit({ [dimension]: [...next] });
	}

	function clearAll() {
		commit({ category: null, brand: null, badge: null, price: null });
	}

	// Drawer-local helpers operate on the draft, not the URL. The draft re-syncs
	// from the applied filters each time the drawer opens, so closing via the X
	// or backdrop simply discards any unapplied changes.
	function toggleDraft(dimension: Dimension, value: string) {
		const key = DIMENSION_KEY[dimension];
		setDraft((prev) => {
			const next = new Set(prev[key]);
			if (next.has(value)) next.delete(value);
			else next.add(value);
			return { ...prev, [key]: [...next] };
		});
	}

	function clearDraft() {
		setDraft({ categories: [], brands: [], badges: [], priceBuckets: [] });
	}

	function applyDraft() {
		commit({
			category: draft.categories,
			brand: draft.brands,
			badge: draft.badges,
			price: draft.priceBuckets,
		});
		setOpen(false);
	}

	function handleOpenChange(next: boolean) {
		if (next) setDraft(selected);
		setOpen(next);
	}

	const draftCount =
		draft.categories.length +
		draft.brands.length +
		draft.badges.length +
		draft.priceBuckets.length;

	// Map a stored slug/value back to its display label for the active chips.
	// Unknown values (e.g. a badge whose catalogue count dropped to 0 but is
	// still in the URL) fall back to a humanized slug, never a raw "founders-pick".
	const humanize = (value: string) =>
		value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	const labelFor = (options: FacetOption[], value: string) =>
		options.find((o) => o.value === value)?.label ?? humanize(value);

	const activeChips: Array<{
		dimension: Dimension;
		value: string;
		label: string;
	}> = [
		...selected.categories.map((v) => ({
			dimension: 'category' as const,
			value: v,
			label: labelFor(categories, v),
		})),
		...selected.brands.map((v) => ({
			dimension: 'brand' as const,
			value: v,
			label: labelFor(brands, v),
		})),
		...selected.badges.map((v) => ({
			dimension: 'badge' as const,
			value: v,
			label: labelFor(badges, v),
		})),
		...selected.priceBuckets.map((v) => ({
			dimension: 'price' as const,
			value: v,
			label: labelFor(prices, v),
		})),
	];

	const facets: Array<{
		dimension: Dimension;
		label: string;
		options: FacetOption[];
		selected: string[];
	}> = [
		{
			dimension: 'category' as const,
			label: filters.category,
			options: categories,
			selected: draft.categories,
		},
		{
			dimension: 'brand' as const,
			label: filters.brand,
			options: brands,
			selected: draft.brands,
		},
		{
			dimension: 'badge' as const,
			label: filters.badge,
			options: badges,
			selected: draft.badges,
		},
		{
			dimension: 'price' as const,
			label: filters.price,
			options: prices,
			selected: draft.priceBuckets,
		},
	].filter((f) => f.options.length > 0);

	return (
		<div className="mb-10" aria-busy={isPending}>
			{/* Controls bar — pinned under the header (matches the events pages) */}
			<div className="sticky top-header z-10 flex items-center justify-between gap-3 bg-background/95 py-3 backdrop-blur-sm">
				{/* Filters panel trigger */}
				<Sheet open={open} onOpenChange={handleOpenChange}>
					<SheetTrigger asChild>
						<Button variant="outline" className="gap-2 pointer-coarse:min-h-11">
							<SlidersHorizontal />
							{filters.title}
							{activeCount > 0 && (
								<span className="t-spec ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-primary/20 px-1.5 text-primary">
									{activeCount}
								</span>
							)}
						</Button>
					</SheetTrigger>
					<SheetContent
						side={side}
						className={cn(
							'gap-0',
							side === 'bottom'
								? 'max-h-[85svh] rounded-t-2xl'
								: 'w-full sm:max-w-112'
						)}
					>
						{side === 'bottom' && (
							<div
								aria-hidden
								className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-foreground/20"
							/>
						)}
						<SheetHeader className="border-b border-foreground/10">
							<SheetTitle className="t-h-3 uppercase">
								{filters.title}
							</SheetTitle>
							<SheetDescription className="sr-only">
								{filters.description}
							</SheetDescription>
						</SheetHeader>

						<div className="flex-1 overflow-y-auto px-4 pt-6 space-y-6">
							{facets.map((facet) => (
								<fieldset
									key={facet.dimension}
									className="border-foreground/10 not-last:border-b"
								>
									<legend className="t-l-2 mb-3 uppercase text-foreground/65">
										{facet.label}
									</legend>
									<ul className="pb-6">
										{facet.options.map((option) => {
											const checked = facet.selected.includes(option.value);
											// Disable options that yield nothing under the applied
											// filters, but never a checked one (it must stay
											// removable). Counts reflect the applied selection, not
											// the in-progress draft, so they refresh on "Show results".
											const disabled = Boolean(option.disabled) && !checked;
											return (
												<li key={option.value}>
													<label
														className={cn(
															'flex items-center gap-3 py-1.5',
															disabled ? 'cursor-not-allowed' : 'cursor-pointer'
														)}
													>
														<Checkbox
															checked={checked}
															disabled={disabled}
															onCheckedChange={() =>
																toggleDraft(facet.dimension, option.value)
															}
														/>
														<span
															className={cn(
																't-b-2 flex-1',
																disabled
																	? 'text-foreground/35'
																	: 'text-foreground'
															)}
														>
															{option.label}
														</span>
														<span
															className={cn(
																't-spec',
																disabled
																	? 'text-foreground/25'
																	: 'text-foreground/40'
															)}
														>
															{option.count}
														</span>
													</label>
												</li>
											);
										})}
									</ul>
								</fieldset>
							))}
						</div>

						<SheetFooter className="flex-row gap-3 border-t border-foreground/10">
							{draftCount > 0 && (
								<Button variant="ghost" className="flex-1" onClick={clearDraft}>
									{filters.clearAll}
								</Button>
							)}
							<Button className="flex-1" onClick={applyDraft}>
								{filters.showResults}
							</Button>
						</SheetFooter>
					</SheetContent>
				</Sheet>

				<div className="flex items-center gap-2">
					<span className="t-l-2 uppercase text-foreground/65 hidden sm:inline">
						{filters.sortBy}
					</span>
					<Select
						value={sort}
						onValueChange={(value) =>
							commit({ sort: value === 'az' ? null : value })
						}
					>
						<SelectTrigger
							className="min-w-40 pointer-coarse:min-h-11"
							aria-label={filters.sort}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent position="popper" side="bottom">
							{SORT_KEYS.map((key) => (
								<SelectItem key={key} value={key}>
									{(filters.sortOptions as Record<string, string>)[key]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Indeterminate bar while the server re-fetches the filtered list. */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
				>
					{isPending &&
						(prefersReducedMotion ? (
							<div className="h-full w-full bg-primary/50" />
						) : (
							<motion.div
								className="h-full w-1/3 bg-primary"
								initial={{ x: '-120%' }}
								animate={{ x: '360%' }}
								transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
							/>
						))}
				</div>
			</div>

			{/* Filtering status — result count, active chips, clear. Shown when
			   filters are active, or (where a count is shown) when a non-default
			   sort has flattened the showcase, so the change is never silent. */}
			{(activeChips.length > 0 || (showCount && sort !== 'az')) && (
				<div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
					{showCount && (
						<span className="t-l-1 shrink-0 uppercase text-foreground/90 font-medium">
							{interpolate(pickPlural(t.productCount, total), {
								count: total,
							})}
						</span>
					)}
					{activeChips.length > 0 && (
						<div className="flex flex-wrap items-center gap-2">
							{activeChips.map((chip) => (
								<Button
									key={`${chip.dimension}:${chip.value}`}
									onClick={() => toggle(chip.dimension, chip.value)}
									variant="ghost"
									size="sm"
									className="gap-1.5 border border-foreground/15 uppercase hover:bg-foreground/5"
								>
									{chip.label}
									<X className="size-3.5" />
								</Button>
							))}
							<Button
								type="button"
								onClick={clearAll}
								className="uppercase text-foreground/50 underline-offset-4 hover:underline"
								variant="ghost"
								size="sm"
							>
								{filters.clearFilters}
							</Button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
