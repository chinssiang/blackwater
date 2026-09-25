'use client';

import { memo, useEffect, useId, useReducer, useRef, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { interpolate } from '@/lib/dictionary';
import { dialZone } from '@/lib/run-lab/dials';
import { gaitPhaseAt } from '@/lib/run-lab/gait';
import { paceZone } from '@/lib/run-lab/pace';
import { type GaitInfo, createPlayhead } from '@/lib/run-lab/playhead';
import { FIXED_LINE, isRunnerFixed } from '@/lib/run-lab/presets';
import { INITIAL_STATE, reducer } from '@/lib/run-lab/state';
import {
	BREATH_IDS,
	CAMERA_VIEW_IDS,
	DIAL_IDS,
	TERRAIN_IDS,
} from '@/lib/run-lab/types';
import { CONTROL_FOCUS, cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { type PanelHandlers, RunLabPanel } from './RunLabPanel';
import { RunLabScene } from './RunLabSceneLazy';
import { ScrubBar } from './ScrubBar';
import {
	DEFAULT_GAIT,
	type Note,
	type PanelTab,
	dominantClip,
} from './playground-shared';

type SceneStatus = 'loading' | 'ready' | 'failed';

const SLOW_LOAD_MS = 8000;
const HINT_MS = 8000;
const LIVE_DEBOUNCE_MS = 800;

/**
 * Run Lab. Owns the one state object both the panel and the scene read, and
 * decides when the scene may draw: continuously only while it is on screen in
 * a visible tab, on demand while the stride is held (scrubbing, or reduced
 * motion -- the HeroWave rule of one still frame, no loop).
 *
 * Imports nothing from three.js: the scene arrives through RunLabSceneLazy.
 */
export function PagePlayground() {
	const t = useTranslations('playground');
	const reduce = usePrefersReducedMotion();
	// Phrased as min-width so the server's `false` bakes the phone dock, which
	// is the layout that also works with no JS.
	const isDesktop = useMediaQuery('(min-width: 64rem)');
	const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
	const [note, setNote] = useState<Note>({ kind: 'intro' });
	const [tab, setTab] = useState<PanelTab>('runner');
	const [expanded, setExpanded] = useState(false);
	const [sceneStatus, setSceneStatus] = useState<SceneStatus>('loading');
	const [slowLoad, setSlowLoad] = useState(false);
	const [gait, setGait] = useState<GaitInfo>(DEFAULT_GAIT);
	// The orbit hint goes when the visitor first orbits, or after a while.
	const [hintDismissed, setHintDismissed] = useState(false);
	const [inView, setInView] = useState(true);
	const [pageHidden, setPageHidden] = useState(false);
	const [liveText, setLiveText] = useState('');
	const [playhead] = useState(() => createPlayhead());
	const stageRef = useRef<HTMLElement>(null);
	const liveId = useId();

	const hold = reduce || state.scrub.on;
	const frameloop = hold
		? 'demand'
		: inView && !pageHidden
			? 'always'
			: 'never';
	const fixed = isRunnerFixed(state.dials, state.terrain);
	const zone = paceZone(state.pace);
	const stances = gait.stances[dominantClip(state.pace)];
	const failed = sceneStatus === 'failed';

	// Pause the loop off screen and in a hidden tab. The LAST entry of a batch
	// is the current state (HeroWave's rule).
	useEffect(() => {
		const el = stageRef.current;
		if (!el) return;
		const observer = new IntersectionObserver((entries) => {
			setInView(entries[entries.length - 1].isIntersecting);
		});
		observer.observe(el);
		const onVisibility = () =>
			setPageHidden(document.visibilityState === 'hidden');
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			observer.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, []);

	useEffect(() => {
		if (sceneStatus !== 'loading') return;
		const id = setTimeout(() => setSlowLoad(true), SLOW_LOAD_MS);
		return () => clearTimeout(id);
	}, [sceneStatus]);

	useEffect(() => {
		if (sceneStatus !== 'ready') return;
		const id = setTimeout(() => setHintDismissed(true), HINT_MS);
		return () => clearTimeout(id);
	}, [sceneStatus]);

	// ------------------------------------------------------------- copy --

	const terrainCopy = t.terrain.options[state.terrain];
	const dialWord = (id: (typeof DIAL_IDS)[number]) =>
		t.dials[id].zones[dialZone(state.dials, state.terrain, id)];

	const statusParts = [terrainCopy.label, t.pace.zones[zone]];
	if (state.preset) {
		statusParts.push(
			fixed
				? t.status.clubForm
				: interpolate(t.status.fixing, {
						preset: t.presets.items[state.preset].name,
					})
		);
	}
	const status = statusParts.join(' · ');

	const fixedLine =
		state.preset && fixed
			? t.presets.fixed.lines[FIXED_LINE[state.preset]]
			: null;

	const sentence = [
		interpolate(t.a11y.live, {
			pace: t.pace.zones[zone],
			terrain: terrainCopy.label,
			breath: t.breath.patterns[state.breath].sub,
			dials: DIAL_IDS.map((id) =>
				interpolate(t.a11y.dialItem, {
					label: t.dials[id].label,
					zone: dialWord(id),
				})
			).join(t.a11y.dialJoin),
		}),
		state.preset
			? interpolate(t.a11y.livePreset, {
					preset: t.presets.items[state.preset].name,
				})
			: '',
		note.kind === 'fixed' && fixedLine ? fixedLine : '',
	]
		.filter(Boolean)
		.join(' ');

	// Debounced, so dragging a slider announces where it came to rest rather
	// than every step on the way.
	useEffect(() => {
		const id = setTimeout(() => setLiveText(sentence), LIVE_DEBOUNCE_MS);
		return () => clearTimeout(id);
	}, [sentence]);

	function renderNote() {
		switch (note.kind) {
			case 'pace':
				return t.pace.notes[zone];
			case 'dial':
				return t.dials[note.id].notes[
					dialZone(state.dials, state.terrain, note.id)
				];
			case 'terrain':
				return terrainCopy.note;
			case 'breath':
				return t.breath.patterns[state.breath].note;
			case 'kit':
				return t.kit.notes[state.top];
			case 'pacer':
				return t.pacer.tooltip;
			case 'phase':
				return t.scrub.phases[gaitPhaseAt(state.scrub.phase, stances).phase]
					.note;
			case 'fixed':
				return fixedLine ?? t.intro;
			case 'preset':
				return (
					<>
						<span className="block">{t.presets.items[note.id].intro}</span>
						{note.id !== 'club' && (
							<Button
								variant="link"
								className="t-b-2 mt-1 h-auto p-0 font-normal"
								onClick={() => {
									setTab('runner');
									setExpanded(true);
								}}
							>
								{t.presets.goToDials}
							</Button>
						)}
					</>
				);
			case 'intro':
				if (failed) return t.fallback.noWebgl;
				return reduce ? t.fallback.reducedMotion : t.intro;
		}
	}

	// --------------------------------------------------------- handlers --

	const armed = state.cameraView !== null;
	const handlers: PanelHandlers = {
		changePace(value) {
			dispatch({ type: 'setPace', value });
			setNote({ kind: 'pace' });
		},
		focusPace() {
			if (armed) dispatch({ type: 'setCameraView', view: 'side' });
			setNote({ kind: 'pace' });
		},
		changeDial(id, value) {
			dispatch({ type: 'setDial', id, value });
			const nowFixed =
				state.preset !== null &&
				isRunnerFixed({ ...state.dials, [id]: value }, state.terrain);
			setNote(nowFixed ? { kind: 'fixed' } : { kind: 'dial', id });
		},
		focusDial(id) {
			dispatch({ type: 'focusDial', id });
			if (note.kind !== 'fixed') setNote({ kind: 'dial', id });
		},
		setTerrain(terrain) {
			dispatch({ type: 'setTerrain', terrain });
			setNote({ kind: 'terrain' });
		},
		setBreath(breath) {
			dispatch({ type: 'setBreath', breath });
			setNote({ kind: 'breath' });
		},
		setTop(top) {
			dispatch({ type: 'setTop', top });
			setNote({ kind: 'kit' });
		},
		loadPreset(id) {
			dispatch({ type: 'loadPreset', id });
			setNote({ kind: 'preset', id });
		},
		setGhost(on) {
			dispatch({ type: 'setGhost', on });
			setNote({ kind: 'pacer' });
		},
	};

	// ----------------------------------------------------------- render --

	return (
		<>
			<section
				ref={stageRef}
				aria-label={t.a11y.stageLabel}
				aria-describedby={liveId}
				className="relative isolate flex h-[calc(var(--s-vp-height)-var(--height-header)-var(--height-g-toolbar))] min-h-[36rem] flex-col overflow-hidden lg:block lg:h-[calc(var(--s-vp-height)-var(--height-header))]"
			>
				<div
					className="relative min-h-0 flex-1 lg:absolute lg:inset-0"
					aria-hidden
				>
					{sceneStatus !== 'ready' && (
						<div className="bg-foreground/15 absolute inset-x-0 top-[62%] h-px" />
					)}
					<div
						data-ready={sceneStatus === 'ready' || undefined}
						className="absolute inset-0 opacity-0 transition-opacity duration-700 data-ready:opacity-100"
					>
						{!failed && (
							<RunLabScene
								state={state}
								hold={hold}
								reduce={reduce}
								frameloop={frameloop}
								fixed={fixed}
								isDesktop={isDesktop}
								playhead={playhead}
								onReady={(info) => {
									setGait(info);
									setSceneStatus('ready');
								}}
								onFailed={() => setSceneStatus('failed')}
								onOrbit={() => {
									dispatch({ type: 'setCameraView', view: null });
									setHintDismissed(true);
								}}
							/>
						)}
					</div>
					{sceneStatus === 'loading' && (
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
							<Spinner className="text-foreground/60" />
							<p className="t-spec text-foreground/60 uppercase">
								{slowLoad ? t.loading.still : t.loading.lacingUp}
							</p>
						</div>
					)}
					<p
						className={cn(
							't-spec text-foreground/60 pointer-events-none absolute inset-x-0 top-16 text-center uppercase transition-opacity duration-500 lg:top-7',
							sceneStatus === 'ready' && !hintDismissed
								? 'opacity-100'
								: 'opacity-0'
						)}
					>
						{t.camera.hint}
					</p>
				</div>

				<div className="left-contain pointer-events-none absolute top-4 z-10 lg:top-6">
					<h1 className="t-h-2 uppercase">{t.title}</h1>
					<p className="t-spec text-foreground/60 mt-1 uppercase">
						{terrainCopy.caption}
					</p>
				</div>

				{sceneStatus === 'loading' && (
					<span className="sr-only">{t.loading.sr}</span>
				)}

				{!failed && (
					<div
						role="group"
						aria-label={t.camera.label}
						className="right-contain absolute top-4 z-10 flex flex-col items-end gap-1.5 lg:top-6 lg:flex-row lg:items-center lg:gap-2"
					>
						{CAMERA_VIEW_IDS.map((view, i) => (
							<span key={view} className="flex items-center gap-2">
								{i > 0 && (
									<span
										aria-hidden
										className="t-l-2 text-foreground/30 hidden lg:inline"
									>
										/
									</span>
								)}
								<button
									type="button"
									aria-pressed={state.cameraView === view}
									onClick={() => dispatch({ type: 'setCameraView', view })}
									className={cn(
										`t-l-2 rounded-sm uppercase transition-[opacity,box-shadow] outline-none hover:opacity-60 ${CONTROL_FOCUS}`,
										state.cameraView === view
											? 'text-foreground'
											: 'text-foreground/50'
									)}
								>
									{t.camera.views[view]}
								</button>
							</span>
						))}
					</div>
				)}

				<ScrubBar
					t={t}
					hold={hold}
					reduce={reduce}
					heldPhase={state.scrub.phase}
					stances={stances}
					playhead={playhead}
					onScrub={(phase) => {
						dispatch({ type: 'setScrub', on: true, phase });
						setNote((n) => (n.kind === 'phase' ? n : { kind: 'phase' }));
					}}
					onPlay={() => dispatch({ type: 'setScrub', on: false })}
					onPause={() =>
						dispatch({
							type: 'setScrub',
							on: true,
							phase: playhead.get().phase,
						})
					}
				/>

				<RunLabPanel
					t={t}
					state={state}
					status={status}
					note={renderNote()}
					tab={tab}
					onTabChange={setTab}
					expanded={expanded}
					onExpandedChange={setExpanded}
					isDesktop={isDesktop}
					showPacer={!failed}
					playhead={playhead}
					hold={hold}
					handlers={handlers}
				/>

				<p id={liveId} className="sr-only" aria-live="polite" aria-atomic>
					{liveText}
				</p>
			</section>

			<Glossary t={t} />
		</>
	);
}

/**
 * Every note on the page in one static list: what a visitor with no WebGL, a
 * search engine, or someone who just wants to read gets without touching a
 * control. Folded away by default so the stage is the page; still rendered
 * (behind `hidden`) so the copy is in the prerendered HTML.
 */
const Glossary = memo(function Glossary({
	t,
}: {
	t: ReturnType<typeof useTranslations<'playground'>>;
}) {
	const [open, setOpen] = useState(false);
	const id = useId();
	return (
		<section className="p-x-max py-6 lg:py-8">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={id}
				onClick={() => setOpen((o) => !o)}
				className={cn(
					't-l-2 inline-flex items-center gap-1.5 rounded-sm uppercase transition-[opacity,box-shadow] outline-none hover:opacity-60',
					CONTROL_FOCUS
				)}
			>
				{open ? t.glossary.hide : t.glossary.show}
				<ChevronDownIcon
					aria-hidden
					className={cn(
						'size-3.5 transition-transform duration-300 motion-reduce:transition-none',
						open && 'rotate-180'
					)}
				/>
			</button>
			<div id={id} hidden={!open} className="pt-10 pb-10 lg:pb-16">
				<h2 className="t-h-2 uppercase">{t.glossary.title}</h2>
				<div className="mt-8 grid gap-10 lg:grid-cols-3">
					<GlossaryList
						title={t.glossary.dials}
						items={DIAL_IDS.map((id) => ({
							term: t.dials[id].label,
							spec: interpolate(t.glossary.ideal, {
								zone: t.dials[id].zones.ideal,
							}),
							body: t.dials[id].notes.ideal,
						}))}
					/>
					<GlossaryList
						title={t.glossary.terrain}
						items={TERRAIN_IDS.map((id) => ({
							term: t.terrain.options[id].label,
							spec: t.terrain.options[id].caption,
							body: t.terrain.options[id].note,
						}))}
					/>
					<GlossaryList
						title={t.glossary.breath}
						items={BREATH_IDS.map((id) => ({
							term: t.breath.patterns[id].label,
							spec: t.breath.patterns[id].sub,
							body: t.breath.patterns[id].note,
						}))}
					/>
				</div>
			</div>
		</section>
	);
});

function GlossaryList({
	title,
	items,
}: {
	title: string;
	items: { term: string; spec: string; body: string }[];
}) {
	return (
		<div>
			<h3 className="t-l-1 border-foreground/15 border-b pb-2 uppercase">
				{title}
			</h3>
			<dl className="mt-4 flex flex-col gap-5">
				{items.map((item) => (
					<div key={item.term}>
						<dt className="flex items-baseline justify-between gap-3">
							<span className="t-l-1 uppercase">{item.term}</span>
							<span className="t-spec text-foreground/60 uppercase">
								{item.spec}
							</span>
						</dt>
						<dd className="t-b-1 text-foreground/80 mt-1">{item.body}</dd>
					</div>
				))}
			</dl>
		</div>
	);
}
