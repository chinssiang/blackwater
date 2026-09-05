/**
 * Current Taipei weather for <WeatherWidget>, proxied from Open-Meteo.
 *
 * Why a route handler rather than fetching in a Server Component: every route
 * under [locale] is prerendered (`revalidate: false`, or 3600 on three of
 * them), so weather resolved during render would be baked into the HTML and
 * served at whatever it was when the page was last generated. This is the same
 * reason <LocationCurrentTime> is client-only — wall-clock data cannot live in
 * prerendered markup.
 *
 * Two upstream calls, because Open-Meteo serves air quality from a separate
 * host. They are settled independently so a failing air-quality endpoint costs
 * the AQI row rather than the whole widget.
 *
 * No API key, so nothing to configure and nothing to leak. Open-Meteo's free
 * tier is licensed for non-commercial use under ~10k calls/day; the Data Cache
 * revalidate below caps us at ~144 upstream calls a day per region regardless
 * of traffic.
 *
 * Deliberately NOT rate-limited, unlike the sibling proxy routes in
 * api/shopify and api/newsletter — read that as a decision, not an oversight.
 * Those two either write to a third party or spend a per-token rate budget, and
 * both take caller-supplied parameters, so their cache is per-input. This
 * handler takes no parameters at all, which means every request in a window is
 * the same URL and collapses onto one CDN entry and one Data Cache entry. There
 * is no upstream cost to throttle.
 */
import { NextResponse } from 'next/server';
import {
	TAIPEI_COORDS,
	TAIPEI_TIMEZONE,
	type WeatherSnapshot,
} from '@/lib/weather';

// 10 minutes. Open-Meteo updates its current conditions every 15, so a shorter
// window would spend calls re-fetching an unchanged observation.
const UPSTREAM_REVALIDATE_SECONDS = 600;

// A hanging upstream would otherwise hold a function invocation open for the
// platform's full 300s timeout for data nobody is waiting on any more.
const UPSTREAM_TIMEOUT_MS = 5_000;

const SHARED_PARAMS = {
	latitude: String(TAIPEI_COORDS.latitude),
	longitude: String(TAIPEI_COORDS.longitude),
	timezone: TAIPEI_TIMEZONE,
	// Unix seconds rather than Open-Meteo's default local-time string. With a
	// `timezone` set, that default is a bare "2026-09-04T13:30" with NO offset,
	// which `new Date()` in the browser reads as the VISITOR's local time — so a
	// visitor outside Taiwan would see an observation timestamp hours off. An
	// integer epoch has no such ambiguity.
	timeformat: 'unixtime',
};

const FORECAST_URL = `https://api.open-meteo.com/v1/forecast?${new URLSearchParams(
	{
		...SHARED_PARAMS,
		current: [
			'temperature_2m',
			'apparent_temperature',
			'relative_humidity_2m',
			'precipitation',
			'weather_code',
			'wind_speed_10m',
		].join(','),
	}
)}`;

const AIR_QUALITY_URL = `https://air-quality-api.open-meteo.com/v1/air-quality?${new URLSearchParams(
	{
		...SHARED_PARAMS,
		// The US-EPA-scale index, which Taiwan's own AQI is modelled on — so the
		// number here matches what a Taipei resident reads on the MOENV site.
		current: 'us_aqi',
	}
)}`;

async function fetchUpstream(url: string): Promise<unknown> {
	const res = await fetch(url, {
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		next: { revalidate: UPSTREAM_REVALIDATE_SECONDS },
	});
	if (!res.ok) throw new Error(`${url} responded ${res.status}`);
	return res.json();
}

/**
 * Open-Meteo omits a field rather than nulling it when a variable is
 * unavailable for a grid cell, so every read is checked. `null` for a metric
 * the widget expects is a broken row, hence the throw rather than a zero — 0°C
 * and 0% humidity are both plausible-looking lies.
 */
function readNumber(source: unknown, key: string): number {
	const value = (source as Record<string, unknown> | undefined)?.[key];
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(
			`missing or non-numeric \`${key}\` in the Open-Meteo response`
		);
	}
	return value;
}

export async function GET() {
	const [forecast, airQuality] = await Promise.allSettled([
		fetchUpstream(FORECAST_URL),
		fetchUpstream(AIR_QUALITY_URL),
	]);

	if (forecast.status === 'rejected') {
		console.error('[api/weather] forecast fetch failed', forecast.reason);
		return NextResponse.json(
			{ ok: false, message: 'Weather is unavailable right now.' },
			{ status: 502 }
		);
	}

	let snapshot: WeatherSnapshot;
	try {
		const current = (forecast.value as { current?: unknown }).current;
		snapshot = {
			temperature: readNumber(current, 'temperature_2m'),
			feelsLike: readNumber(current, 'apparent_temperature'),
			humidity: readNumber(current, 'relative_humidity_2m'),
			precipitation: readNumber(current, 'precipitation'),
			windSpeed: readNumber(current, 'wind_speed_10m'),
			weatherCode: readNumber(current, 'weather_code'),
			observedAt: new Date(readNumber(current, 'time') * 1000).toISOString(),
			// Filled in below. Stays null when the second call failed or returned a
			// cell with no index, which the widget renders as an omitted row.
			aqi: null,
		};
	} catch (error) {
		console.error('[api/weather] unexpected forecast shape', error);
		return NextResponse.json(
			{ ok: false, message: 'Weather is unavailable right now.' },
			{ status: 502 }
		);
	}

	if (airQuality.status === 'fulfilled') {
		try {
			const current = (airQuality.value as { current?: unknown }).current;
			snapshot.aqi = Math.round(readNumber(current, 'us_aqi'));
		} catch (error) {
			// Logged, not returned: the other five metrics are still good.
			console.error('[api/weather] air quality unavailable', error);
		}
	} else {
		console.error('[api/weather] air quality fetch failed', airQuality.reason);
	}

	return NextResponse.json(snapshot, {
		headers: {
			// Lets the CDN answer for the same window the Data Cache holds, so a
			// traffic spike costs neither upstream calls nor function invocations.
			'Cache-Control': `public, s-maxage=${UPSTREAM_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
		},
	});
}
