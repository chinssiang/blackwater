'use client';

import { type ReactNode, useId } from 'react';
import Link from 'next/link';
import { ChevronDownIcon } from 'lucide-react';
import { interpolate } from '@/lib/dictionary';
import { resolveHref } from '@/lib/routes';
import { dialZone } from '@/lib/run-lab/dials';
import { KIT_PRODUCT_SLUGS } from '@/lib/run-lab/kit';
import { ZONE_CADENCE, paceZone, suggestedBreath } from '@/lib/run-lab/pace';
import type { Playhead } from '@/lib/run-lab/playhead';
import type { RunLabState } from '@/lib/run-lab/state';
import {
	TERRAIN_IDEALS,
	movedDials,
	toleranceFor,
} from '@/lib/run-lab/terrain';
import {
	BREATH_IDS,
	type BreathId,
	DIAL_IDS,
	type DialId,
	PRESET_IDS,
	type PresetId,
	TERRAIN_IDS,
	TOP_IDS,
	type Terrain,
	type TopId,
} from '@/lib/run-lab/types';
import { INLINE_LINK_FOCUS, cn } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Separator } from '@/components/ui/Separator';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { BreathTrace } from './BreathTrace';
import {
	PANEL_TABS,
	type PanelTab,
	type PlaygroundCopy,
} from './playground-shared';

export type PanelHandlers = {
	changePace: (value: number) => void;
	focusPace: () => void;
	changeDial: (id: DialId, value: number) => void;
	focusDial: (id: DialId) => void;
	setTerrain: (terrain: Terrain) => void;
	setBreath: (breath: BreathId) => void;
	setTop: (top: TopId) => void;
	loadPreset: (id: PresetId) => void;
	setGhost: (on: boolean) => void;
};

/**
 * The control panel. One DOM for both layouts: a card in the stage's
 * bottom-right corner from `lg`, an in-flow dock below the canvas on phones,
 * where the tab row sits at the bottom and the body expands above it. The
 * body is `inert` while collapsed so its controls leave the tab order too.
 */
export function RunLabPanel({
	t,
	state,
	status,
	note,
	tab,
	onTabChange,
	expanded,
	onExpandedChange,
	isDesktop,
	showPacer,
	playhead,
	hold,
	handlers,
}: {
	t: PlaygroundCopy;
	state: RunLabState;
	status: string;
	note: ReactNode;
	tab: PanelTab;
	onTabChange: (tab: PanelTab) => void;
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
	isDesktop: boolean;
	showPacer: boolean;
	playhead: Playhead;
	hold: boolean;
	handlers: PanelHandlers;
}) {
	const uid = useId();
	const ideal = TERRAIN_IDEALS[state.terrain];
	const zone = paceZone(state.pace);
	const suggested = suggestedBreath(state.pace, state.terrain);
	const moved = movedDials(state.terrain);
	const collapsed = !isDesktop && !expanded;

	return (
		<Tabs
			value={tab}
			onValueChange={(value) => {
				onTabChange(value as PanelTab);
				onExpandedChange(true);
			}}
			className="bg-background border-foreground/15 lg:right-contain lg:bg-background/95 relative z-10 flex shrink-0 flex-col border-t lg:absolute lg:bottom-6 lg:max-h-[calc(var(--height-main)-6.5rem)] lg:w-sm lg:rounded-lg lg:border lg:p-4"
		>
			{/* Status and the Pacer switch: above the tabs on desktop, at the top of
			    the opened dock on a phone (hidden while it is folded). The switch
			    lives here rather than in the tab row so five tabs fit a phone. */}
			<div
				data-shown={expanded || undefined}
				className="px-contain hidden items-center justify-between gap-3 pt-4 data-shown:flex lg:flex lg:px-0 lg:pt-0 lg:pb-3"
			>
				<p className="t-spec text-foreground/60 uppercase">{status}</p>
				<div className="flex items-center gap-2">
					{showPacer && (
						<label className="flex shrink-0 cursor-pointer items-center gap-2">
							<Switch
								checked={state.ghost}
								onCheckedChange={handlers.setGhost}
							/>
							<span className="t-l-2 uppercase">{t.pacer.label}</span>
						</label>
					)}
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t.dock.collapse}
						onClick={() => onExpandedChange(false)}
						className="-mr-1.5 lg:hidden"
					>
						<ChevronDownIcon />
					</Button>
				</div>
			</div>

			<div
				data-expanded={expanded || undefined}
				inert={collapsed || undefined}
				className="order-1 grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out data-expanded:grid-rows-[1fr] motion-reduce:transition-none lg:order-2 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
			>
				<div className="flex min-h-0 flex-col overflow-hidden lg:flex-1">
					<div className="px-contain flex max-h-[45svh] min-h-0 flex-col overflow-y-auto pt-3 lg:max-h-none lg:flex-1 lg:px-0 lg:pt-3">
						<TabsContent value="runner" className="flex flex-col gap-3">
							<div>
								<div className="flex items-baseline justify-between gap-3">
									<span className="t-l-1 uppercase">{t.pace.label}</span>
									<span className="t-spec uppercase">{t.pace.zones[zone]}</span>
								</div>
								<Slider
									value={state.pace}
									step={5}
									largeStep={25}
									onValueChange={handlers.changePace}
									thumbProps={{
										getAriaLabel: () => t.pace.label,
										getAriaValueText: () => t.pace.zones[zone],
										onFocus: handlers.focusPace,
									}}
								/>
								<p className="t-spec text-foreground/60 uppercase">
									{interpolate(t.pace.aside, { spm: ZONE_CADENCE[zone] })}
								</p>
							</div>
							<Separator className="bg-foreground/15" />
							{DIAL_IDS.map((id) => {
								const copy = t.dials[id];
								const tolerance = toleranceFor(state.terrain, id);
								const zoneId = dialZone(state.dials, state.terrain, id);
								const word = copy.zones[zoneId];
								return (
									<div key={id}>
										<div className="flex items-baseline justify-between gap-3">
											<span className="t-l-1 uppercase">{copy.label}</span>
											<span
												className={cn(
													't-spec uppercase',
													zoneId === 'ideal'
														? 'text-foreground'
														: 'text-foreground/60'
												)}
											>
												{word}
											</span>
										</div>
										<Slider
											value={state.dials[id]}
											step={5}
											largeStep={20}
											ideal={{ value: ideal[id], tolerance }}
											onValueChange={(v) => handlers.changeDial(id, v)}
											thumbProps={{
												getAriaLabel: () => copy.label,
												getAriaValueText: () => word,
												onFocus: () => handlers.focusDial(id),
											}}
										/>
										<div className="t-l-2 text-foreground/50 flex justify-between gap-3 uppercase">
											<span>{copy.zones.low}</span>
											<span className="text-right">{copy.zones.high}</span>
										</div>
									</div>
								);
							})}
						</TabsContent>

						<TabsContent value="ground">
							<RadioGroup
								aria-label={t.terrain.label}
								value={state.terrain}
								onValueChange={(v) => handlers.setTerrain(v as Terrain)}
								className="gap-2.5"
							>
								{TERRAIN_IDS.map((id) => (
									<div key={id} className="flex items-center gap-2.5">
										<RadioGroupItem value={id} id={`${uid}-terrain-${id}`} />
										<Label
											htmlFor={`${uid}-terrain-${id}`}
											className="t-l-2 uppercase"
										>
											{t.terrain.options[id].label}
										</Label>
									</div>
								))}
							</RadioGroup>
							{moved.length > 0 && (
								<p className="t-spec text-foreground/60 mt-4 uppercase">
									{interpolate(t.terrain.pacerMoved, {
										dials: moved
											.map((id) => t.dials[id].label)
											.join(t.a11y.dialJoin),
									})}
								</p>
							)}
						</TabsContent>

						<TabsContent value="breath">
							<RadioGroup
								aria-label={t.breath.label}
								value={state.breath}
								onValueChange={(v) => handlers.setBreath(v as BreathId)}
								className="gap-3"
							>
								{BREATH_IDS.map((id) => (
									<div key={id} className="flex items-start gap-2.5">
										<RadioGroupItem
											value={id}
											id={`${uid}-breath-${id}`}
											className="mt-0.5"
										/>
										<Label
											htmlFor={`${uid}-breath-${id}`}
											className="flex flex-col items-start gap-0.5"
										>
											<span className="t-l-1">
												{t.breath.patterns[id].label}
											</span>
											<span className="t-l-2 text-foreground/60">
												{t.breath.patterns[id].sub}
											</span>
											{id === suggested && (
												<span className="t-spec uppercase">
													{interpolate(t.breath.suggested, {
														pace: t.pace.zones[zone],
													})}
												</span>
											)}
										</Label>
									</div>
								))}
							</RadioGroup>
							<BreathTrace
								t={t}
								breath={state.breath}
								playhead={playhead}
								hold={hold}
								heldPhase={state.scrub.phase}
							/>
						</TabsContent>

						<TabsContent value="kit">
							<RadioGroup
								aria-label={t.kit.label}
								value={state.top}
								onValueChange={(v) => handlers.setTop(v as TopId)}
								className="gap-2.5"
							>
								{TOP_IDS.map((id) => (
									<div key={id} className="flex items-center gap-2.5">
										<RadioGroupItem value={id} id={`${uid}-top-${id}`} />
										<Label
											htmlFor={`${uid}-top-${id}`}
											className="t-l-2 min-w-0 flex-1 uppercase"
										>
											{t.kit.products[id]}
										</Label>
										<KitLink id={id} t={t} />
									</div>
								))}
							</RadioGroup>
							<p className="t-spec text-foreground/60 mt-5 mb-2 uppercase">
								{t.kit.wearing}
							</p>
							<ul className="flex flex-col gap-2">
								{(['tight', 'shoes'] as const).map((id) => (
									<li key={id} className="flex items-center gap-2.5">
										<span className="t-l-2 min-w-0 flex-1 uppercase">
											{t.kit.products[id]}
										</span>
										<KitLink id={id} t={t} />
									</li>
								))}
							</ul>
						</TabsContent>

						<TabsContent value="fix" className="flex flex-col gap-2">
							{PRESET_IDS.map((id) => {
								const pressed =
									id === 'club' ? state.preset === null : state.preset === id;
								return (
									<div key={id} className="contents">
										<Button
											variant="outline"
											aria-pressed={pressed}
											onClick={() => handlers.loadPreset(id)}
											className={cn(
												't-l-1 w-full justify-start font-normal uppercase',
												// Spelled with `dark:` so tailwind-merge replaces the outline
												// variant's own dark-mode fill instead of losing to it.
												pressed &&
													'bg-foreground text-background hover:bg-foreground/90 hover:text-background dark:bg-foreground dark:hover:bg-foreground/90'
											)}
										>
											{t.presets.items[id].name}
										</Button>
										{id === 'club' && (
											<Separator className="bg-foreground/15 my-1" />
										)}
									</div>
								);
							})}
						</TabsContent>
					</div>

					<div
						aria-live="polite"
						className="border-foreground/15 t-b-2 px-contain min-h-18 border-t py-3 lg:mt-3 lg:px-0 lg:pb-0"
					>
						{note}
					</div>
				</div>
			</div>

			<div className="px-contain order-2 flex items-center justify-between gap-3 py-2.5 lg:order-1 lg:px-0 lg:py-0">
				<TabsList
					aria-label={t.tabsAria}
					className="min-w-0 scrollbar-none gap-1.5 overflow-x-auto"
				>
					{PANEL_TABS.map((id) => (
						<TabsTrigger
							key={id}
							value={id}
							variant="pill"
							size="sm"
							// A tap on the ALREADY-open tab changes no value, so it cannot
							// rely on onValueChange to open a folded dock. Folding is the
							// Collapse button's job, not a second tap's: with activateOnFocus
							// the value changes on pointerdown, before this click, so a
							// "tap the active tab to fold" rule would fold every new tab.
							onClick={() => onExpandedChange(true)}
						>
							{t.tabs[id]}
						</TabsTrigger>
					))}
				</TabsList>
			</div>
		</Tabs>
	);
}

/**
 * A product page link, underlined at rest (DESIGN.md: only the decoration
 * colour moves on hover).
 */
function KitLink({
	id,
	t,
}: {
	id: keyof typeof KIT_PRODUCT_SLUGS;
	t: PlaygroundCopy;
}) {
	const locale = useLocale();
	const href =
		resolveHref({
			documentType: 'pProduct',
			slug: KIT_PRODUCT_SLUGS[id],
			locale,
		}) ?? '#';
	return (
		<Link
			href={href}
			aria-label={interpolate(t.kit.viewAria, { product: t.kit.products[id] })}
			className={cn(
				't-l-2 decoration-foreground/30 hover:decoration-foreground shrink-0 rounded-sm uppercase underline underline-offset-4 transition-[text-decoration-color,box-shadow]',
				INLINE_LINK_FOCUS
			)}
		>
			{t.kit.view}
		</Link>
	);
}
