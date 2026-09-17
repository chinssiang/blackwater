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
 * No API key, so nothing to configure and nothing to leak, but Open-Meteo's free
 * tier is licensed for non-commercial use under ~10k calls/day and this handler
 * spends TWO of them per uncached run (forecast + air quality), so the caching
 * below is a licence constraint, not an optimisation.
 *
 * Two layers, and the second exists to bound the first. Next's Data Cache keeps
 * upstream volume flat no matter how many CDN regions forward a miss — without
 * it, calls scale with POP count rather than with time, which is thousands a day
 * rather than hundreds. But it serves a stale entry WITHOUT AN UPPER BOUND: on a
 * dynamic route it hands the expired body to the current request and refreshes in
 * the background for the NEXT one (the `entry.isStale` branch in
 * next/dist/server/lib/patch-fetch.js). The window length is irrelevant to that
 * — an entry last written six hours ago is still what the next visitor reads,
 * which on a low-traffic site is the common path, and is what showed people an
 * observation hours old on a fresh page load.
 *
 * So the cache is read first and then CHECKED: the payload carries its own
 * observation time, `isSnapshotStale` is the same predicate the widget uses, and
 * a body that comes back past the budget is re-read once with `cache: 'no-store'`.
 * That supplies exactly the upper bound the Data Cache lacks while leaving the
 * common path a cache hit. Never drop the check and keep the cache.
 *
 * Deliberately NOT rate-limited, unlike the sibling proxy routes in
 * api/shopify and api/newsletter — read that as a decision, not an oversight.
 * Those two either write to a third party or spend a per-token rate budget, and
 * both take caller-supplied parameters, so their cache is per-input. This
 * handler takes no parameters at all, which means every request in a window is
 * the same URL and collapses onto one CDN entry. There is no upstream cost to
 * throttle.
 */
import { NextResponse } from 'next/server';
import {
	CDN_CACHE_SECONDS,
	CDN_STALE_WHILE_REVALIDATE_SECONDS,
	MAX_ORIGIN_SNAPSHOT_AGE_MS,
	TAIPEI_COORDS,
	TAIPEI_TIMEZONE,
	WEATHER_CACHE_SECONDS,
	type WeatherSnapshot,
	isSnapshotStale,
} from '@/lib/weather';

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

async function fetchUpstream(url: string, uncached = false): Promise<unknown> {
	const res = await fetch(url, {
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		// `uncached` is the bound on the Data Cache, not a way around it — see the
		// two-layer note up top before changing either arm.
		...(uncached
			? { cache: 'no-store' as const }
			: { next: { revalidate: WEATHER_CACHE_SECONDS } }),
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

/**
 * Only the forecast half. Air quality carries no timestamp of its own, so it is
 * merged in by the caller and is never what the staleness re-read fetches — a
 * slightly old AQI band is not worth a second uncached round trip.
 */
function buildSnapshot(forecast: unknown): WeatherSnapshot {
	const current = (forecast as { current?: unknown }).current;
	return {
		temperature: readNumber(current, 'temperature_2m'),
		feelsLike: readNumber(current, 'apparent_temperature'),
		humidity: readNumber(current, 'relative_humidity_2m'),
		precipitation: readNumber(current, 'precipitation'),
		windSpeed: readNumber(current, 'wind_speed_10m'),
		weatherCode: readNumber(current, 'weather_code'),
		observedAt: new Date(readNumber(current, 'time') * 1000).toISOString(),
		// Filled in by the caller. Stays null when the air-quality call failed or
		// returned a cell with no index, which the widget renders as an omitted row.
		aqi: null,
	};
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
		snapshot = buildSnapshot(forecast.value);
	} catch (error) {
		console.error('[api/weather] unexpected forecast shape', error);
		return NextResponse.json(
			{ ok: false, message: 'Weather is unavailable right now.' },
			{ status: 502 }
		);
	}

	// The bound on the Data Cache. A hit past the ORIGIN budget is the
	// unbounded-stale path described up top, so pay for one uncached read rather
	// than serve it.
	//
	// Its own try, deliberately. A network failure here is not a reason to throw
	// away the snapshot already in hand: an old reading beats an empty corner
	// (the rule WeatherWidget states, and the same tolerance the air-quality call
	// gets below), and a 502 would take the widget off the page entirely while
	// every open tab retried at its 30s floor.
	let forecastWasReRead = false;
	if (
		isSnapshotStale(snapshot.observedAt, Date.now(), MAX_ORIGIN_SNAPSHOT_AGE_MS)
	) {
		try {
			snapshot = buildSnapshot(await fetchUpstream(FORECAST_URL, true));
			forecastWasReRead = true;
		} catch (error) {
			console.error(
				'[api/weather] stale-forecast re-read failed, serving the cached one',
				error
			);
		}
	}

	// Skipped when the forecast was re-read: the air-quality body came from the
	// SAME stale cache entry, and that branch is only reached when the entry is
	// past the origin budget with no upper bound on how far. Merging it would
	// stamp a minutes-old `observedAt` onto an AQI that could be hours old, which
	// is a worse lie than the omitted row the widget already knows how to render.
	if (!forecastWasReRead && airQuality.status === 'fulfilled') {
		try {
			const current = (airQuality.value as { current?: unknown }).current;
			snapshot.aqi = Math.round(readNumber(current, 'us_aqi'));
		} catch (error) {
			// Logged, not returned: the other five metrics are still good.
			console.error('[api/weather] air quality unavailable', error);
		}
	} else if (airQuality.status === 'rejected') {
		console.error('[api/weather] air quality fetch failed', airQuality.reason);
	}

	return NextResponse.json(snapshot, {
		headers: {
			// `s-maxage` lets the CDN absorb a traffic spike at no upstream cost, and
			// `stale-while-revalidate` keeps an expiry from making one unlucky
			// visitor wait out a cold start plus the upstream timeout.
			//
			// NO `must-revalidate`, and that is not an omission: RFC 9111 5.2.2.2
			// makes it a prohibition on serving stale that binds shared caches too
			// (`proxy-revalidate` is the shared-only variant), so pairing it with
			// `stale-while-revalidate` told the edge both to serve stale and never
			// to — leaving the swr window inert on any CDN that honours it.
			// `max-age=0` alone already forces the browser to revalidate, which is
			// all that arm was for, and `s-maxage` still overrides it at the edge.
			//
			// Both edge numbers are counted in `MAX_SNAPSHOT_AGE_MS`; changing
			// either here without changing it there breaks the freshness contract.
			'Cache-Control': `public, max-age=0, s-maxage=${CDN_CACHE_SECONDS}, stale-while-revalidate=${CDN_STALE_WHILE_REVALIDATE_SECONDS}`,
		},
	});
}
