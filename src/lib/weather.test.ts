import { describe, expect, it } from 'vitest';
import en from '@/dictionaries/en.json';
import {
	aqiBandKey,
	weatherConditionKey,
	type WeatherConditionKey,
} from '@/lib/weather';

// Every WMO code Open-Meteo documents for its `weather_code` field. Listed
// literally rather than derived from the module's own table, so a code dropped
// from the table fails here instead of silently becoming 'unknown'.
const DOCUMENTED_WMO_CODES = [
	0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77,
	80, 81, 82, 85, 86, 95, 96, 99,
];

describe('weatherConditionKey', () => {
	it('maps every documented WMO code to a real condition', () => {
		for (const code of DOCUMENTED_WMO_CODES) {
			expect(weatherConditionKey(code), `code ${code}`).not.toBe('unknown');
		}
	});

	it('groups the intensity variants of one condition onto one key', () => {
		// 61/63/65 are slight/moderate/heavy rain — the number beside the label
		// already carries the intensity, so all three read "Rain".
		expect(weatherConditionKey(61)).toBe('rain');
		expect(weatherConditionKey(63)).toBe('rain');
		expect(weatherConditionKey(65)).toBe('rain');
	});

	it('falls back to `unknown` for a code outside the scale', () => {
		// Open-Meteo could add a code, and a widget showing a blank condition is
		// worse than one showing "Unknown".
		expect(weatherConditionKey(4)).toBe('unknown');
		expect(weatherConditionKey(-1)).toBe('unknown');
		expect(weatherConditionKey(200)).toBe('unknown');
	});
});

describe('aqiBandKey', () => {
	// The published US EPA / Taiwan MOENV boundaries. Each pair is (last value
	// of a band, first value of the next), which is the only place an
	// off-by-one can hide.
	it.each([
		[0, 'good'],
		[50, 'good'],
		[51, 'moderate'],
		[100, 'moderate'],
		[101, 'unhealthySensitive'],
		[150, 'unhealthySensitive'],
		[151, 'unhealthy'],
		[200, 'unhealthy'],
		[201, 'veryUnhealthy'],
		[300, 'veryUnhealthy'],
		[301, 'hazardous'],
		[500, 'hazardous'],
	])('reads %i as %s', (aqi, expected) => {
		expect(aqiBandKey(aqi as number)).toBe(expected);
	});
});

// The mappings return dictionary keys, so a key with no entry renders blank.
// TypeScript cannot catch it: the dictionary is JSON, so its condition/band
// records are typed as plain objects rather than by these unions.
describe('dictionary coverage', () => {
	it('has a `weather.conditions` entry for every condition key', () => {
		const keys: WeatherConditionKey[] = [
			...DOCUMENTED_WMO_CODES.map(weatherConditionKey),
			'unknown',
		];
		for (const key of new Set(keys)) {
			expect(en.weather.conditions, key).toHaveProperty(key);
		}
	});

	it('has a `weather.aqiBands` entry for every band key', () => {
		for (const aqi of [0, 51, 101, 151, 201, 301]) {
			expect(en.weather.aqiBands, String(aqi)).toHaveProperty(aqiBandKey(aqi));
		}
	});
});
