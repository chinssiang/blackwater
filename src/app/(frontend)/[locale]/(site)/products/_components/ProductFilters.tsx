'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
	Sheet,
	SheetContent,
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
import { interpolate, pickPlural } from '@/lib/dictionary';

export type FacetOption = { value: string; label: string; count: number };
type Dimension = 'category' | 'brand' | 'badge';

type Props = {
	categories: FacetOption[];
	brands: FacetOption[];
	badges: FacetOption[];
	selected: { categories: string[]; brands: string[]; badges: string[] };
	sort: string;
};

const SORT_KEYS = ['az', 'za', 'newest', 'oldest'] as const;

export default function ProductFilters({
	categories,
	brands,
	badges,
	selected,
	sort,
}: Props) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const t = useTranslations('products');
	const [open, setOpen] = useState(false);

	const filters = t.filters;
	const activeCount =
		selected.categories.length + selected.brands.length + selected.badges.length;

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
		router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
	}

	function toggle(dimension: Dimension, value: string) {
		const next = new Set(
			selected[
				dimension === 'category'
					? 'categories'
					: dimension === 'brand'
						? 'brands'
						: 'badges'
			]
		);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		commit({ [dimension]: [...next] });
	}

	function clearAll() {
		commit({ category: null, brand: null, badge: null });
	}

	// Map a stored slug/value back to its display label for the active chips.
	const labelFor = (options: FacetOption[], value: string) =>
		options.find((o) => o.value === value)?.label ?? value;

	const activeChips: Array<{ dimension: Dimension; value: string; label: string }> =
		[
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
			selected: selected.categories,
		},
		{
			dimension: 'brand' as const,
			label: filters.brand,
			options: brands,
			selected: selected.brands,
		},
		{
			dimension: 'badge' as const,
			label: filters.badge,
			options: badges,
			selected: selected.badges,
		},
	].filter((f) => f.options.length > 0);

	return (
		<div className="mb-10 flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-4">
				{/* Filters panel trigger */}
				<Sheet open={open} onOpenChange={setOpen}>
					<SheetTrigger asChild>
						<Button variant="outline" className="gap-2">
							<SlidersHorizontal />
							{filters.title}
							{activeCount > 0 && (
								<span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
									{activeCount}
								</span>
							)}
						</Button>
					</SheetTrigger>
					<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-[28rem]">
						<SheetHeader className="border-b border-foreground/10">
							<SheetTitle className="t-h-3 uppercase">
								{filters.title}
							</SheetTitle>
						</SheetHeader>

						<div className="flex-1 overflow-y-auto px-4 py-2">
							{facets.map((facet) => (
								<fieldset
									key={facet.dimension}
									className="border-b border-foreground/10 py-5 last:border-b-0"
								>
									<legend className="t-l-2 mb-3 uppercase text-foreground/65">
										{facet.label}
									</legend>
									<ul className="space-y-1">
										{facet.options.map((option) => {
											const checked = facet.selected.includes(option.value);
											return (
												<li key={option.value}>
													<label className="flex cursor-pointer items-center gap-3 py-1.5">
														<Checkbox
															checked={checked}
															onCheckedChange={() =>
																toggle(facet.dimension, option.value)
															}
														/>
														<span className="t-b-2 flex-1 text-foreground">
															{option.label}
														</span>
														<span className="t-spec text-foreground/40">
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
							{activeCount > 0 && (
								<Button
									variant="ghost"
									className="flex-1"
									onClick={clearAll}
								>
									{filters.clearAll}
								</Button>
							)}
							<Button className="flex-1" onClick={() => setOpen(false)}>
								{filters.showResults}
							</Button>
						</SheetFooter>
					</SheetContent>
				</Sheet>

				{/* Sort */}
				<div className="flex items-center gap-2">
					<span className="t-l-2 uppercase text-foreground/65">
						{filters.sortBy}
					</span>
					<Select
						value={sort}
						onValueChange={(value) =>
							commit({ sort: value === 'az' ? null : value })
						}
					>
						<SelectTrigger className="min-w-40" aria-label={filters.sort}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SORT_KEYS.map((key) => (
								<SelectItem key={key} value={key}>
									{
										(filters.sortOptions as Record<string, string>)[
											key
										]
									}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Active filter chips */}
			{activeChips.length > 0 && (
				<div className="flex flex-wrap items-center gap-2">
					{activeChips.map((chip) => (
						<button
							key={`${chip.dimension}:${chip.value}`}
							type="button"
							onClick={() => toggle(chip.dimension, chip.value)}
							className="t-l-2 inline-flex items-center gap-1.5 rounded-full border border-foreground/15 py-1.5 pl-3 pr-2 uppercase text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground"
						>
							{chip.label}
							<X className="size-3.5" />
						</button>
					))}
					<button
						type="button"
						onClick={clearAll}
						className="t-l-2 px-2 py-1.5 uppercase text-foreground/50 underline-offset-4 transition-colors hover:text-foreground hover:underline"
					>
						{interpolate(pickPlural(filters.filterCount, activeCount), {
							count: activeCount,
						})}
						{' · '}
						{filters.clearAll}
					</button>
				</div>
			)}
		</div>
	);
}
