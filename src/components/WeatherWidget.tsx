'use client';

import { useEffect, useId, useState } from 'react';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { interpolate } from '@/lib/dictionary';
import { htmlLangFor } from '@/lib/i18n';
import { cn, OVERLAY_LINK_FOCUS } from '@/lib/utils';
import { Plus } from '@/components/SvgIcons';
import {
	aqiBandKey,
	TAIPEI_TIMEZONE,
	weatherConditionKey,
	type WeatherSnapshot,
} from '@/lib/weather';

/**
 * Current Taipei conditions, pinned bottom-right on the homepage and the
 * /events subtree. Mounted once by <Layout> in the always-mounted chrome and
 * gated there on `shouldShowWeatherWidget` (routes.ts) -- never rendered from a
 * page module, so it cannot appear twice on a page or drift from the predicate
 * its tests cover. `fixed`, so the corner it claims is the viewport's; the
 * bottom offset clears the mobile ToolBar the way the Footer's padding does.
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
export function WeatherWidget() {
	const t = useTranslations('weather');
	const locale = useLocale();
	const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const panelId = useId();

	useEffect(() => {
		// Fetched once per mount, deliberately not polled. The route caches for
		// ten minutes, so a poll would mostly re-read one cached answer; the
		// "updated at" line is what keeps a long-open tab honest instead.
		const controller = new AbortController();

		fetch('/api/weather', { signal: controller.signal })
			.then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
			.then((data: WeatherSnapshot) => setSnapshot(data))
			.catch((error) => {
				if (controller.signal.aborted) return;
				// Stays silent on screen. This is ambient decoration, so a corner
				// occupied by an error message is worse than an empty corner.
				console.error('[WeatherWidget] could not load weather', error);
			});

		return () => controller.abort();
	}, []);

	if (!snapshot) return null;

	const { temperature, feelsLike, windSpeed, humidity, precipitation, aqi } =
		snapshot;
	const condition = t.conditions[weatherConditionKey(snapshot.weatherCode)];

	// Taipei time whatever timezone the visitor is in. Intl rather than date-fns
	// so this costs no bundle: <LocationCurrentTime> already pays for date-fns,
	// but only on /events, and this also renders on the homepage.
	const observedAt = new Intl.DateTimeFormat(htmlLangFor(locale), {
		timeZone: TAIPEI_TIMEZONE,
		hour: 'numeric',
		minute: '2-digit',
	}).format(new Date(snapshot.observedAt));

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
		<div className="text-foreground bg-background/85 backdrop-blur-xs border-foreground/36 right-contain fixed bottom-[calc(var(--height-g-toolbar)+1rem)] lg:bottom-6 z-g-toolbar w-(--width-max) sm:max-w-64 border max-sm:left-contain">
			<button
				type="button"
				onClick={() => setIsOpen((open) => !open)}
				aria-expanded={isOpen}
				aria-controls={panelId}
				className={cn(
					'flex w-full items-center justify-between gap-2 p-2.5 text-left transition-[opacity,box-shadow] hover:opacity-60 cursor-pointer',
					OVERLAY_LINK_FOCUS
				)}
			>
				<span className="t-b-2 uppercase">{t.label}</span>
				<span className="mx-auto flex items-center">
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
					<p className="t-b-2 text-foreground/60 px-2.5 pt-2 pb-2.5 text-center">
						{interpolate(t.observedAt, { time: observedAt })}
					</p>
				</div>
			</div>
		</div>
	);
}
