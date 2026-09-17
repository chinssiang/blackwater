'use client';

import { useMemo, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { SlidersHorizontal, X } from 'lucide-react';
import { cartOverlay } from '@/lib/animate';
import {
	DEFAULT_PRODUCT_SORT,
	PRODUCT_SORT_KEYS,
	type ProductFilterSelection,
	countActiveFilters,
} from '@/lib/productFilters';
import { CONTROL_FOCUS, cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useProductFilterParams } from '@/hooks/useProductFilterParams';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useTranslations } from '@/components/LocaleProvider';
import { CloseIcon } from '@/components/SvgIcons';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/Select';
import { AnimatePresence, type Variants, motion } from 'motion/react';

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
	selected: ProductFilterSelection;
	sort: string;
};

// The panel enters from the edge it is docked to. Reduced motion is passed as
// Motion's `custom` so the same variants cover both cases: the fade stays, the
// travel drops. Deliberately NOT lib/animate's cartPanel: this one has a side
// that changes with the viewport, and it eases differently -- parameterizing
// cartPanel to cover both would restyle the cart drawer. The backdrop half has
// no such excuse and uses the shared cartOverlay below.
const panelVariants: Variants = {
	hide: ({ reduce = false, bottom = false }) => ({
		opacity: 0,
		x: reduce || bottom ? 0 : '100%',
		y: reduce || !bottom ? 0 : '100%',
		transition: { duration: 0.2, ease: 'easeIn' },
	}),
	show: {
		opacity: 1,
		x: 0,
		y: 0,
		transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] },
	},
};

export default function ProductFilters({
	categories,
	brands,
	badges,
	prices,
	selected,
	sort,
}: Props) {
	const { commit, toggleValue, clearAll, isPending } = useProductFilterParams();
	const t = useTranslations('products');
	// In rem, so it agrees with Tailwind's own rem-based `sm:`. getServerSnapshot
	// is false, so a prerender bakes the phone branch — which is the right one to
	// bake, since the panel is a bottom sheet there and only mounts on open.
	const isWide = useMediaQuery('(min-width: 40rem)');
	const prefersReducedMotion = usePrefersReducedMotion();
	const [open, setOpen] = useState(false);
	// Phones get a bottom sheet (thumb-reachable); larger screens keep the side
	// drawer. The panel content only mounts on open, so width is resolved by then.
	const isBottom = !isWide;
	// Drawer checkboxes stage into a local draft; nothing is fetched until the
	// user taps "Show results". Sort and the active-filter chips stay live.
	const [draft, setDraft] = useState(selected);

	const filters = t.filters;
	// PRODUCT_SORT_KEYS, not a local copy: the same list is what parses the
	// `sort` param server-side, so a key added to one and not the other means the
	// menu offers a sort the parser silently rejects, or the reverse.
	const sortItems = useMemo(
		() =>
			PRODUCT_SORT_KEYS.map((key) => ({
				value: key as string,
				label: (filters.sortOptions as Record<string, string>)[key] ?? key,
			})),
		[filters.sortOptions]
	);
	const activeCount = countActiveFilters(selected);

	// The param name IS the dimension, and the hook reads the current list off
	// the URL rather than off `selected`, so removing two chips in the same
	// dimension in quick succession composes instead of the second reverting the
	// first.
	const toggle = (dimension: Dimension, value: string) =>
		toggleValue(dimension, value);

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

	// The app's single scroll-lock owner; the dialog below is `modal="trap-focus"`
	// precisely so Base UI's own lock stays off and this stays the only writer.
	useScrollLock(open, () => setOpen(false));

	const draftCount = countActiveFilters(draft);

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
		<div
			className="p-x-max top-header bg-background/95 sticky z-50 mb-5 pb-2 backdrop-blur-sm lg:pb-5"
			aria-busy={isPending}
		>
			<div className="flex items-center justify-between gap-3 py-3">
				<Dialog.Root
					open={open}
					onOpenChange={handleOpenChange}
					modal="trap-focus"
				>
					<Dialog.Trigger
						render={
							<Button
								variant="outline"
								className={cn(
									't-l-2 border-foreground/50 hover:bg-foreground/5 aria-expanded:bg-foreground/5 focus-visible:border-foreground gap-2 px-3.5 uppercase',
									CONTROL_FOCUS
								)}
							/>
						}
					>
						<SlidersHorizontal />
						{filters.title}
						{activeCount > 0 && (
							<span className="t-spec bg-foreground text-background ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5">
								{activeCount}
							</span>
						)}
					</Dialog.Trigger>

					{/* Base UI's Motion recipe: the controlled `open` gates the portal
					    inside AnimatePresence so the exit plays, and `keepMounted` stops
					    Base UI unmounting the panel from under it. */}
					<AnimatePresence>
						{open && (
							<Dialog.Portal keepMounted key="product-filters">
								<Dialog.Backdrop
									render={
										<motion.div
											className="z-popover fixed inset-0 bg-black/50"
											variants={cartOverlay}
											initial="hide"
											animate="show"
											exit="hide"
										/>
									}
								/>
								<Dialog.Popup
									render={
										<motion.div
											className={cn(
												'bg-background text-foreground z-popover fixed flex flex-col',
												isBottom
													? 'inset-x-0 bottom-0 max-h-[85svh] rounded-t-lg border-t'
													: 'inset-y-0 right-0 w-full max-w-112 border-l'
											)}
											variants={panelVariants}
											initial="hide"
											animate="show"
											exit="hide"
											custom={{
												reduce: prefersReducedMotion,
												bottom: isBottom,
											}}
										/>
									}
								>
									{isBottom && (
										<div
											aria-hidden
											className="bg-foreground/20 mx-auto mt-2 h-1 w-10 shrink-0 rounded-full"
										/>
									)}
									<div className="border-foreground/10 flex shrink-0 items-center justify-between gap-4 border-b px-4 py-4">
										<Dialog.Title className="t-h-3 uppercase">
											{filters.title}
										</Dialog.Title>
										<Dialog.Description className="sr-only">
											{filters.description}
										</Dialog.Description>
										<Dialog.Close
											render={
												<Button
													variant="ghost"
													size="sm"
													aria-label={filters.close}
													className={cn(
														'hover:bg-foreground/5 -mr-2 px-2',
														CONTROL_FOCUS
													)}
												/>
											}
										>
											<CloseIcon className="size-4" />
										</Dialog.Close>
									</div>

									<div className="flex-1 space-y-6 overflow-y-auto px-4 pt-6">
										{facets.map((facet) => (
											<fieldset
												key={facet.dimension}
												className="border-foreground/10 not-last:border-b"
											>
												<legend className="t-l-1 text-foreground/65 mb-3 uppercase">
													{facet.label}
												</legend>
												<ul className="pb-6">
													{facet.options.map((option) => {
														const checked = facet.selected.includes(
															option.value
														);
														// Disable options that yield nothing under the applied
														// filters, but never a checked one (it must stay
														// removable). Counts reflect the applied selection, not
														// the in-progress draft, so they refresh on "Show results".
														const disabled =
															Boolean(option.disabled) && !checked;
														return (
															<li key={option.value}>
																<label
																	// A row is a clickable box, so it takes the box hover (a 5% ink
																	// tint) rather than the default opacity dim, which would fade the
																	// count along with the label. The negative margin lets the tint
																	// span the full row without moving anything.
																	className={cn(
																		'-mx-2 flex items-center gap-3 rounded px-2 py-1.5',
																		disabled
																			? 'cursor-not-allowed'
																			: 'hover:bg-foreground/5 cursor-pointer transition-colors'
																	)}
																>
																	{/* `border-input` is oklch(0.922) on this route's oklch(0.9612)
																	    paper -- roughly 1.1:1, so the unchecked box was effectively
																	    invisible. The right depth for THAT is the `--input` token in
																	    globals.css, which is the light theme's own value and leaves
																	    every other `border-input` consumer on these routes equally
																	    invisible; this is the local patch. The transition is no longer
																	    restated here -- `ui/Checkbox` now names the properties it
																	    actually animates instead of a bare `transition-shadow`. */}
																	<Checkbox
																		className={cn(
																			'border-foreground/50 data-checked:bg-foreground data-checked:border-foreground data-checked:text-background focus-visible:border-foreground shadow-none',
																			CONTROL_FOCUS
																		)}
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
																				? 'text-foreground/30'
																				: 'text-foreground/65'
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

									<div className="border-foreground/10 flex shrink-0 flex-row gap-3 border-t p-4">
										{draftCount > 0 && (
											<Button
												variant="ghost"
												className={cn(
													't-l-2 border-foreground hover:bg-foreground/5 h-auto flex-1 border py-3 uppercase',
													CONTROL_FOCUS
												)}
												onClick={clearDraft}
											>
												{filters.clearAll}
											</Button>
										)}
										{/* The inversion pair: solid ink commits, outline resets.
										    `bg-foreground`/`text-background` rather than the variant's
										    `bg-primary` pair, so this is the same token couple
										    `tabsTriggerVariants` uses for an active control. The hover
										    and active states must be restated or the variant's own
										    `bg-primary/80` and `/70` survive in their own scopes. */}
										<Button
											className={cn(
												't-l-2 bg-foreground text-background hover:bg-foreground/85 active:bg-foreground/75 h-auto flex-1 py-3 uppercase',
												CONTROL_FOCUS
											)}
											onClick={applyDraft}
										>
											{filters.showResults}
										</Button>
									</div>
								</Dialog.Popup>
							</Dialog.Portal>
						)}
					</AnimatePresence>
				</Dialog.Root>

				<div className="flex items-center gap-2">
					<span className="t-l-2 text-foreground/65 hidden uppercase sm:inline">
						{filters.sortBy}
					</span>
					<Select
						// `items`, following CustomForm: without it Base UI can only echo
						// the raw value, so the trigger read "az" instead of "Name (A-Z)"
						// until the popup had mounted once. Memoized because Base UI keys
						// its store on `items` by identity.
						items={sortItems}
						value={sort}
						onValueChange={(value) =>
							commit({
								sort: value === DEFAULT_PRODUCT_SORT ? null : value,
							})
						}
					>
						{/* ui/Select is shadcn's and is shared with CustomForm, so the brand
						    treatment is passed in rather than baked into the primitive.
						    `t-l-2` deletes its `text-sm` through cn()'s one-way font-size
						    conflict. No height override: the primitive's default size is
						    `h-9`, matching Button's, so a select and a button in this row
						    are one height. (If you ever need to override it, the
						    `data-[size=default]:` prefix is mandatory -- the primitive's own
						    rule is specificity (0,2,0) and a bare `h-9` at (0,1,0) loses
						    silently.) The chevron needs an arbitrary variant; it is a
						    grandchild carrying its own `text-muted-foreground`. */}
						<SelectTrigger
							className={cn(
								't-l-2 border-foreground/50 bg-background hover:bg-foreground/5 focus-visible:border-foreground [&_svg]:text-foreground/60 min-w-40 rounded px-3.5 uppercase transition-[color,background-color,border-color,box-shadow]',
								CONTROL_FOCUS
							)}
							aria-label={filters.sort}
						>
							<SelectValue />
						</SelectTrigger>
						{/* `ring-0` as well as `shadow-none`: they are different
						    tailwind-merge groups, and without it the popup keeps the
						    primitive's `ring-1` and paints a doubled edge. The item
						    highlight is overridden in `data-highlighted:`, the scope the
						    primitive styles -- tailwind-merge only resolves within a
						    scope, so overriding in `focus:` would leave the default's
						    near-white row and BLUE text in place. The blue is
						    `--accent-foreground`, the one chromatic value in an otherwise
						    achromatic light palette; fixing it there would retire this
						    override. */}
						<SelectContent
							side="bottom"
							alignItemWithTrigger={false}
							className="border-foreground/20 bg-background text-foreground rounded border shadow-none ring-0"
						>
							<SelectGroup>
								{sortItems.map((item) => (
									<SelectItem
										key={item.value}
										value={item.value}
										className="t-l-2 data-highlighted:bg-foreground/5 data-highlighted:text-foreground cursor-pointer rounded-sm py-2 uppercase"
									>
										{item.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Filtering status — the active chips and a clear-all. The result count
			   is NOT here: every host renders its own in its page header, and a
			   second copy of the same number one row below it read as two
			   different figures. */}
			{activeChips.length > 0 && (
				<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
					<div className="flex flex-wrap items-center gap-2">
						{activeChips.map((chip) => (
							<Button
								key={`${chip.dimension}:${chip.value}`}
								onClick={() => toggle(chip.dimension, chip.value)}
								variant="ghost"
								size="sm"
								// `rounded` is required: size="sm" sets its own 6px radius,
								// which does not yield to the base's. The chip is a clickable
								// box, so it takes the box hover (a bg tint) rather than the
								// default opacity dim, which would fade the close glyph too.
								// h-7 from the size variant stays, so the row keeps one height.
								className={cn(
									't-l-2 border-foreground/50 hover:bg-foreground/5 focus-visible:border-foreground gap-1.5 rounded border px-3 uppercase',
									CONTROL_FOCUS
								)}
							>
								{chip.label}
								<X className="size-3.5" />
							</Button>
						))}
						<Button
							type="button"
							onClick={clearAll}
							// Underlined at rest with only the decoration colour moving:
							// text-decoration-line is not animatable, so `hover:underline`
							// snapped in beside the button's own eased transition.
							// `hover:bg-transparent` cancels the ghost variant's tint --
							// one hover treatment per element, not two.
							className={cn(
								't-l-2 text-foreground/65 decoration-foreground/30 hover:decoration-foreground hover:text-foreground rounded px-1 uppercase underline underline-offset-4 hover:bg-transparent',
								CONTROL_FOCUS
							)}
							variant="ghost"
							size="sm"
						>
							{filters.clearFilters}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
