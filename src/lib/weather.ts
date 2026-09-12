/**
 * Taipei weather, shared between the `/api/weather` route handler that fetches
 * it and the <WeatherWidget> that renders it.
 *
 * A leaf module on purpose: it imports nothing, so the route handler does not
 * drag React in and the client component does not drag the fetch layer in.
 *
 * Everything here is a pure mapping from an upstream number to a DICTIONARY
 * KEY, never to display text. The widget is rendered in both locales, so the
 * words have to come from `weather` in the dictionaries — returning English
 * here would make the zh_tw widget half-translated.
 */

/** Taipei City Hall. Open-Meteo resolves to the nearest grid cell. */
export const TAIPEI_COORDS = { latitude: 25.033, longitude: 121.5654 } as const;
export const TAIPEI_TIMEZONE = 'Asia/Taipei';

/**
 * The freshness budget, as arithmetic rather than as two numbers in two files
 * joined by a comment. Each term is a real constraint:
 */

/** Open-Meteo buckets `current` into 15-minute slots (its `interval: 900`). */
const UPSTREAM_BUCKET_MS = 15 * 60_000;

/**
 * The Next Data Cache window in the route handler. Every term below is spent
 * SERIALLY on one response, so each one has to be counted once — an earlier
 * version charged this number once while the chain spent it twice (Data Cache
 * AND CDN), which put a served body 36 minutes past an observation under a
 * 30-minute contract. A response that arrives already stale floors
 * `msUntilStale`, so the widget re-fetches every 30s against the same edge
 * entry and never converges. Raising any window without raising the budget
 * brings that straight back.
 */
export const WEATHER_CACHE_SECONDS = 300;

/** The CDN `s-maxage` in the same handler's `Cache-Control`. */
export const CDN_CACHE_SECONDS = 300;

/**
 * The CDN `stale-while-revalidate`. Counted too: it is time the edge may keep
 * serving a body it knows is expired, which ages the observation exactly as
 * `s-maxage` does.
 */
export const CDN_STALE_WHILE_REVALIDATE_SECONDS = 60;

/** Everything the edge may add after the handler has returned. */
const CDN_WINDOW_MS =
	(CDN_CACHE_SECONDS + CDN_STALE_WHILE_REVALIDATE_SECONDS) * 1_000;

/**
 * Headroom over the worst case. Must be positive: at zero a response that spent
 * every window arrives exactly at the threshold, so the widget re-fetches on
 * arrival instead of converging.
 */
const BUDGET_SLACK_MS = 4 * 60_000;

/**
 * The contract for the widget's "Updated HH:MM" line: a visitor must never read
 * an observation older than this. 30 minutes, as the sum of every window the
 * observation passes through. `weather.test.ts` pins the sum.
 */
export const MAX_SNAPSHOT_AGE_MS =
	UPSTREAM_BUCKET_MS +
	WEATHER_CACHE_SECONDS * 1_000 +
	CDN_WINDOW_MS +
	BUDGET_SLACK_MS;

/**
 * The threshold the ROUTE judges a cached body against, which is necessarily
 * tighter than the client's: whatever the handler returns, the edge may hold it
 * for `CDN_WINDOW_MS` longer before anyone reads it. Checking the client's
 * number at the origin is what let a 29-minute-old body out of the door and
 * then be served for 11 minutes more.
 */
export const MAX_ORIGIN_SNAPSHOT_AGE_MS = MAX_SNAPSHOT_AGE_MS - CDN_WINDOW_MS;

/**
 * A small positive floor, so a snapshot that is somehow ALREADY past the budget
 * schedules one delayed retry rather than a zero-delay timer that re-arms
 * itself as fast as the event loop allows.
 */
const MIN_REFRESH_DELAY_MS = 30_000;

/** `setTimeout`'s 32-bit ceiling. Past it the delay wraps and fires at once. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/**
 * How long until `observedAt` crosses `MAX_SNAPSHOT_AGE_MS` -- the delay the
 * widget arms its single refresh timer with, on the `getNextEventClockTransition`
 * model rather than a blind interval.
 *
 * Never returns zero or a negative, and never `NaN`: an unparseable timestamp
 * (a proxy rewriting the body, a future schema change) must degrade to "retry
 * shortly", never to a hot loop. That is also why the floor is applied to the
 * parse failure rather than throwing -- this feeds a timer in ambient
 * decoration, where the correct response to bad input is to try again later.
 */
export function msUntilStale(observedAt: string, now: number): number {
	const observed = Date.parse(observedAt);
	if (!Number.isFinite(observed)) return MIN_REFRESH_DELAY_MS;
	return clampRefreshDelay(observed + MAX_SNAPSHOT_AGE_MS - now);
}

/**
 * Bounded at BOTH ends, because `setTimeout` truncates its delay to a 32-bit
 * signed int and fires on the next tick past 2^31-1 ms. A device whose clock is
 * years in the past (a kiosk after an RTC reset, a VM off a cold snapshot)
 * yields a delay of decades, which without the ceiling overflows into a ~1ms
 * timer that re-arms itself — the hot loop the floor was added to prevent,
 * reached from the other direction.
 */
export function clampRefreshDelay(delayMs: number): number {
	if (!Number.isFinite(delayMs)) return MIN_REFRESH_DELAY_MS;
	return Math.min(Math.max(delayMs, MIN_REFRESH_DELAY_MS), MAX_TIMER_DELAY_MS);
}

/**
 * Whether a snapshot has aged past the contract and needs re-fetching.
 *
 * `maxAgeMs` is a parameter because the route judges against a tighter number
 * than the client does — see `MAX_ORIGIN_SNAPSHOT_AGE_MS`.
 */
export function isSnapshotStale(
	observedAt: string,
	now: number,
	maxAgeMs: number = MAX_SNAPSHOT_AGE_MS
): boolean {
	const observed = Date.parse(observedAt);
	if (!Number.isFinite(observed)) return true;
	return now - observed >= maxAgeMs;
}

export type WeatherSnapshot = {
	/** °C */
	temperature: number;
	/** °C, Open-Meteo's `apparent_temperature` */
	feelsLike: number;
	/** km/h at 10m */
	windSpeed: number;
	/** % relative humidity at 2m */
	humidity: number;
	/** mm of precipitation over the preceding hour */
	precipitation: number;
	/** WMO code — pass to `weatherConditionKey` */
	weatherCode: number;
	/**
	 * US-EPA-scale AQI (0-500), the scale Taiwan's own index is modelled on.
	 * Nullable on purpose: air quality is a SECOND upstream call, and one
	 * endpoint being down should cost the AQI row, not the whole widget.
	 */
	aqi: number | null;
	/** ISO timestamp of the observation, for the widget's "as of" line. */
	observedAt: string;
};

/**
 * WMO 4677 code -> a key under `weather.conditions` in the dictionaries.
 *
 * Grouped rather than one key per code: the scale's intensity words ("slight",
 * "moderate", "heavy") duplicate what the numbers beside them already say, and
 * fifteen keys is a translation surface someone has to maintain. The snow and
 * freezing codes are mapped even though Taipei does not see them at sea level —
 * mapping them costs one line each and the alternative is a blank label if it
 * ever happens.
 */
const CONDITION_KEYS: Record<number, WeatherConditionKey> = {
	0: 'clear',
	1: 'mainlyClear',
	2: 'partlyCloudy',
	3: 'overcast',
	45: 'fog',
	48: 'fog',
	51: 'drizzle',
	53: 'drizzle',
	55: 'drizzle',
	56: 'freezingDrizzle',
	57: 'freezingDrizzle',
	61: 'rain',
	63: 'rain',
	65: 'rain',
	66: 'freezingRain',
	67: 'freezingRain',
	71: 'snow',
	73: 'snow',
	75: 'snow',
	77: 'snowGrains',
	80: 'showers',
	81: 'showers',
	82: 'showers',
	85: 'snowShowers',
	86: 'snowShowers',
	95: 'thunderstorm',
	96: 'thunderstormHail',
	99: 'thunderstormHail',
};

export type WeatherConditionKey =
	| 'clear'
	| 'mainlyClear'
	| 'partlyCloudy'
	| 'overcast'
	| 'fog'
	| 'drizzle'
	| 'freezingDrizzle'
	| 'rain'
	| 'freezingRain'
	| 'snow'
	| 'snowGrains'
	| 'showers'
	| 'snowShowers'
	| 'thunderstorm'
	| 'thunderstormHail'
	| 'unknown';

export function weatherConditionKey(code: number): WeatherConditionKey {
	return CONDITION_KEYS[code] ?? 'unknown';
}

export type AqiBandKey =
	| 'good'
	| 'moderate'
	| 'unhealthySensitive'
	| 'unhealthy'
	| 'veryUnhealthy'
	| 'hazardous';

/**
 * US EPA breakpoints, which Taiwan's MOENV index shares — so the band a Taipei
 * resident reads on the government site is the band this shows.
 *
 * Ordered ascending and matched on the first `max` the value falls under, so
 * the boundaries are the published ones (50 is still Good, 51 is Moderate).
 */
const AQI_BANDS: ReadonlyArray<{ max: number; key: AqiBandKey }> = [
	{ max: 50, key: 'good' },
	{ max: 100, key: 'moderate' },
	{ max: 150, key: 'unhealthySensitive' },
	{ max: 200, key: 'unhealthy' },
	{ max: 300, key: 'veryUnhealthy' },
];

export function aqiBandKey(aqi: number): AqiBandKey {
	return AQI_BANDS.find(({ max }) => aqi <= max)?.key ?? 'hazardous';
}
