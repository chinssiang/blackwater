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
