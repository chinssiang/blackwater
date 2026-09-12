'use client';

import { useEffect, useId, useState } from 'react';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { interpolate } from '@/lib/dictionary';
import { htmlLangFor } from '@/lib/i18n';
import { cn, OVERLAY_LINK_FOCUS } from '@/lib/utils';
import { Plus } from '@/components/SvgIcons';
import {
	aqiBandKey,
	clampRefreshDelay,
	isSnapshotStale,
	MAX_SNAPSHOT_AGE_MS,
	msUntilStale,
	TAIPEI_TIMEZONE,
	weatherConditionKey,
	type WeatherSnapshot,
} from '@/lib/weather';

/**
 * Current Taipei conditions, pinned bottom-right. Two mount sites, which must
 * never both fire on one page — `shouldShowWeatherWidget` in routes.ts carries
 * that argument, and a third mount belongs there first.
 *
 * What matters HERE is only the positioning each site needs. The default is
 * `absolute`, for the <HeroBlock> mount: it anchors to the hero's own
 * `relative isolate` (HeroBlock.tsx, passed through to SectionShell — NOT to
 * SECTION_INSET, which is padding only), so trimming that className sends the
 * widget to whatever positioned ancestor it finds next. <Layout>'s copy has no
 * hero to sit inside and passes `fixed` through `className` instead.
 *
 * The bottom offset clears the mobile ToolBar the way the Footer's padding does.
 *
 * Always import this from `@/components/WeatherWidgetLazy` — see the note there.
 *
 * Fetched in the browser, not on the server: every [locale] route is
 * prerendered, so weather resolved at render time would be baked into the HTML
 * and served at whatever it was when the page was last generated.
 * `/api/weather` carries that end of the reasoning.
 *
 * Typographic, with no weather glyphs, for the same reason `eventsBlock`'s
 * ticket is: the palette is achromatic and the brand's surfaces are type and
 * rules. It also avoids authoring an icon per WMO condition group.
 *
 * Temperature lives in the always-visible pill rather than repeating as a
 * labelled row in the panel — it is the metric with the strongest claim on
 * being readable without a click, and a 208px panel has no room to say it
 * twice.
 */
type WeatherWidgetProps = {
	/**
	 * Overrides for the mount site's positioning — the chrome copy passes
	 * `fixed` to escape the flow. Merged through cn(), so tailwind-merge resolves
	 * it against the defaults below (`fixed` beats `absolute`, both being the
	 * position group) rather than leaving two competing classes to the cascade.
	 */
	className?: string;
};

/** First retry delay after a failed load; doubles per consecutive failure. */
const MIN_BACKOFF_MS = 30_000;

export function WeatherWidget({ className }: WeatherWidgetProps) {
	const t = useTranslations('weather');
	const locale = useLocale();
	const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const panelId = useId();

	useEffect(() => {
		// The widget promises an observation no older than MAX_SNAPSHOT_AGE_MS, so
		// it cannot be a single fetch on mount: a tab left open drifts past the
		// budget with a confidently-formatted time that stopped being true. It is
		// also not an interval — one `setTimeout` armed for the instant THIS
		// snapshot goes stale, re-armed from each answer, on the
		// `getNextEventClockTransition` model in event-date.ts. A blind poll would
		// mostly re-read one CDN-cached answer for a byte-identical render.
		//
		// Timers in a background tab are throttled and may fire long after their
		// instant, so visibility-regain is checked too — same event set and same
		// bound add/remove shape as useConsent, where `visibilitychange` covers a
		// tab switch and `pageshow` a bfcache restore. Both paths ask the same
		// cheap question first, so coming back to a two-minute-old tab costs
		// nothing.
		let controller: AbortController | null = null;
		let timer: ReturnType<typeof setTimeout> | undefined;
		// An explicit flag, because an AbortController has no settled state: a
		// fetch that COMPLETES leaves `signal.aborted` false, so reading the
		// controller to mean "a request is in flight" is true forever after the
		// first load and silently kills the visibility path below.
		let inFlight = false;
		// Consecutive failures, for the backoff in `finally`.
		let failures = 0;
		// Read by the listeners, which must judge the CURRENT snapshot rather than
		// close over the one that was on screen when the effect ran.
		let current: WeatherSnapshot | null = null;

		const load = async () => {
			// One load at a time, and it owns the schedule. Superseding a request
			// without also disarming its timer left the old timer to fire mid-flight
			// and abort the request that replaced it — which is reachable, because a
			// bfcache restore releases an overdue timer at the same instant it fires
			// `pageshow`. Unmount goes through here too, via the cleanup's abort.
			controller?.abort();
			clearTimeout(timer);
			const active = new AbortController();
			controller = active;
			inFlight = true;

			try {
				const res = await fetch('/api/weather', { signal: active.signal });
				if (!res.ok) throw new Error(`/api/weather responded ${res.status}`);
				const data: WeatherSnapshot = await res.json();
				if (active.signal.aborted) return;
				current = data;
				failures = 0;
				setSnapshot(data);
			} catch (error) {
				if (active.signal.aborted) return;
				// Stays silent on screen, and a FAILED REFRESH deliberately keeps the
				// snapshot already showing rather than clearing it. This is ambient
				// decoration: a slightly old corner beats an empty one, and beats one
				// occupied by an error message.
				failures += 1;
				console.error('[WeatherWidget] could not load weather', error);
			} finally {
				// Only the live invocation re-arms. `return` inside try/catch still
				// runs finally, so a superseded load would otherwise schedule from the
				// `current` its replacement is about to overwrite — and when the
				// refresh fired BECAUSE the snapshot went stale, that floors to
				// MIN_REFRESH_DELAY_MS, giving a 30s abort-and-retry loop in which no
				// request ever completes. Aborting covers unmount for free.
				if (controller === active && !active.signal.aborted) {
					inFlight = false;
					// Armed even after a failure, so a network blip is retried rather
					// than ending the refresh loop for the life of the tab — but with
					// a doubling backoff, because without one a sustained outage and a
					// blip get the same 30s floor forever: 120 requests and 120 console
					// errors an hour, per open tab, for ambient decoration. Capped at
					// the budget so recovery is still bounded, and reset on success.
					const backoff = failures ? MIN_BACKOFF_MS * 2 ** (failures - 1) : 0;
					timer = setTimeout(
						load,
						Math.max(
							msUntilStale(current?.observedAt ?? '', Date.now()),
							clampRefreshDelay(Math.min(backoff, MAX_SNAPSHOT_AGE_MS))
						)
					);
				}
			}
		};

		const refreshIfStale = () => {
			if (document.visibilityState !== 'visible') return;
			// `pageshow` fires on EVERY document load, not just a bfcache restore, and
			// lands after this effect's own first `load()`. Without this the opening
			// fetch is aborted and reissued on a plain page load, and the window is
			// widest exactly when that first request is slowest. Must read the flag,
			// not the controller — see the note where it is declared.
			if (inFlight) return;
			if (current && !isSnapshotStale(current.observedAt, Date.now())) return;
			void load();
		};

		const toggleListeners = (add: boolean) => {
			const fn = add ? 'addEventListener' : 'removeEventListener';
			document[fn]('visibilitychange', refreshIfStale);
			window[fn]('pageshow', refreshIfStale);
		};

		void load();
		toggleListeners(true);

		return () => {
			toggleListeners(false);
			clearTimeout(timer);
			// Also what stops an in-flight load re-arming: its `finally` checks the
			// signal, so no separate `cancelled` flag is needed.
			inFlight = false;
			controller?.abort();
		};
	}, []);

	if (!snapshot) return null;

	const { temperature, feelsLike, windSpeed, humidity, precipitation, aqi } =
		snapshot;
	const condition = t.conditions[weatherConditionKey(snapshot.weatherCode)];

	// Taipei time whatever timezone the visitor is in. Intl rather than date-fns
	// so this costs no bundle: <LocationCurrentTime> already pays for date-fns,
	// but only on /events, and this also renders on the homepage.
	//
	// Parsed before formatting because `Intl.DateTimeFormat.format` THROWS
	// `RangeError: Invalid time value` on an Invalid Date, and this runs in the
	// render body. Unguarded, one unparseable `observedAt` took the error
	// boundary, unmounted the widget and cancelled its own refresh timer — gone
	// for the session, which is the opposite of the "retry shortly" degradation
	// `msUntilStale` and `isSnapshotStale` implement for the same bad input.
	// Dropping just the line keeps the readings, and the timer still re-fetches.
	const observedMs = Date.parse(snapshot.observedAt);
	const observedAt = Number.isFinite(observedMs)
		? new Intl.DateTimeFormat(htmlLangFor(locale), {
				timeZone: TAIPEI_TIMEZONE,
				hour: 'numeric',
				minute: '2-digit',
			}).format(observedMs)
		: null;

	const rows: Array<{ label: string; value: string }> = [
		{
			label: t.metrics.feelsLike,
			value: `${Math.round(feelsLike)}${t.units.celsius}`,
		},
		{
			label: t.metrics.wind,
			value: `${windSpeed.toFixed(1)} ${t.units.kilometresPerHour}`,
		},
		{
			label: t.metrics.humidity,
			value: `${Math.round(humidity)}${t.units.percent}`,
		},
		{
			label: t.metrics.rain,
			value: `${precipitation.toFixed(1)} ${t.units.millimetres}`,
		},
		// Omitted rather than shown blank when the air-quality endpoint failed —
		// see the `aqi` note on WeatherSnapshot.
		...(aqi === null
			? []
			: [
					{
						label: t.metrics.aqi,
						value: `${aqi} • ${t.aqiBands[aqiBandKey(aqi)]}`,
					},
				]),
	];

	return (
		// Entrance is the popup idiom (Popover, Tooltip, Dialog, Select), not the
		// `reveal` utility: this mounts on its own fetch rather than at paint, so
		// reveal's "visible without JS" guarantee buys nothing, and there is no
		// paint-time stagger to join. Kept short because the drift moves the
		// element that owns the backdrop-filter, so the blur resamples for the
		// duration -- cf. the header holding `backdrop-filter: none` over a wave.
		<div
			className={cn(
				'text-foreground bg-background/85 backdrop-blur-xs border-foreground/36 right-contain animate-in fade-in slide-in-from-bottom-2 animation-duration-500 ease-out motion-reduce:animate-none absolute bottom-[calc(var(--height-g-toolbar)+1rem)] lg:bottom-2.5 z-g-toolbar w-(--width-max) sm:max-w-64 border max-sm:left-contain',
				className
			)}
		>
			<button
				type="button"
				onClick={() => setIsOpen((open) => !open)}
				aria-expanded={isOpen}
				aria-controls={panelId}
				className={cn(
					'flex w-full items-center gap-2 p-2.5 text-left transition-[opacity,box-shadow] hover:opacity-60 cursor-pointer',
					OVERLAY_LINK_FOCUS
				)}
			>
				<span className="t-b-2 uppercase">{t.label}</span>
				<span className="mr-auto flex items-center gap-1">
					<span className="t-b-2 tabular-nums">
						{Math.round(temperature)}
						{t.units.celsius}
					</span>
					<span className="t-b-2 text-foreground/80 uppercase">
						( {condition} )
					</span>
				</span>
				<Plus
					className={cn(
						'size-3 shrink-0 transition-transform motion-reduce:transition-none',
						{ 'rotate-45': isOpen }
					)}
				/>
			</button>

			<div
				id={panelId}
				inert={!isOpen}
				className={cn(
					'grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
					isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
				)}
			>
				<div className="min-h-0">
					<dl className="px-2.5 border-foreground/36 border-t pt-2.5 pb-1">
						{rows.map(({ label, value }) => (
							<div
								key={label}
								className="t-b-2 flex items-baseline justify-between gap-2 py-1"
							>
								<dt className="text-foreground/60">{label}</dt>
								<dd className="tabular-nums">{value}</dd>
							</div>
						))}
					</dl>
					{observedAt && (
						<p className="t-b-2 text-foreground/60 px-2.5 pt-5 pb-2.5 text-center">
							{interpolate(t.observedAt, { time: observedAt })}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
