import en from '@/dictionaries/en.json';
import { describe, expect, it } from 'vitest';
import {
	CDN_CACHE_SECONDS,
	CDN_STALE_WHILE_REVALIDATE_SECONDS,
	MAX_ORIGIN_SNAPSHOT_AGE_MS,
	MAX_SNAPSHOT_AGE_MS,
	WEATHER_CACHE_SECONDS,
	type WeatherConditionKey,
	aqiBandKey,
	clampRefreshDelay,
	isSnapshotStale,
	msUntilStale,
	weatherConditionKey,
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

// The widget arms a single refresh timer from `msUntilStale` and gates its
// visibility-regain refresh on `isSnapshotStale`. Both feed a timer in ambient
// decoration, so the interesting cases are the degenerate ones: a delay that
// came back zero, negative or NaN would re-arm as fast as the event loop
// allows, turning a corner widget into a request loop.
const NOW = Date.parse('2026-09-12T08:00:00.000Z');
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe('msUntilStale', () => {
	it('gives a just-observed snapshot the full budget', () => {
		expect(msUntilStale(at(0), NOW)).toBe(MAX_SNAPSHOT_AGE_MS);
	});

	it('counts down as the snapshot ages', () => {
		expect(msUntilStale(at(10 * 60_000), NOW)).toBe(
			MAX_SNAPSHOT_AGE_MS - 10 * 60_000
		);
	});

	it('floors a snapshot already past the budget to a positive delay', () => {
		// Rather than 0 or a negative, either of which re-arms immediately.
		expect(msUntilStale(at(MAX_SNAPSHOT_AGE_MS + 60_000), NOW)).toBeGreaterThan(
			0
		);
	});

	it('floors the snapshot at exactly the budget', () => {
		expect(msUntilStale(at(MAX_SNAPSHOT_AGE_MS), NOW)).toBeGreaterThan(0);
	});

	it('floors an unparseable timestamp rather than returning NaN', () => {
		const delay = msUntilStale('not a date', NOW);
		expect(Number.isFinite(delay)).toBe(true);
		expect(delay).toBeGreaterThan(0);
	});

	it('floors an empty timestamp, the no-snapshot-yet case', () => {
		expect(msUntilStale('', NOW)).toBeGreaterThan(0);
	});
});

describe('isSnapshotStale', () => {
	it('leaves a fresh snapshot alone', () => {
		expect(isSnapshotStale(at(0), NOW)).toBe(false);
		expect(isSnapshotStale(at(MAX_SNAPSHOT_AGE_MS - 1), NOW)).toBe(false);
	});

	it('is stale at exactly the budget', () => {
		expect(isSnapshotStale(at(MAX_SNAPSHOT_AGE_MS), NOW)).toBe(true);
	});

	it('is stale well past the budget', () => {
		expect(isSnapshotStale(at(6 * 60 * 60_000), NOW)).toBe(true);
	});

	it('treats an unparseable timestamp as stale', () => {
		// Fetching again is the recoverable answer — trusting a timestamp we
		// could not read is not.
		expect(isSnapshotStale('not a date', NOW)).toBe(true);
	});
});

// Every window an observation passes through, counted independently of
// `MAX_SNAPSHOT_AGE_MS`'s own definition. The earlier version of this block
// modelled the server worst case as `bucket + WEATHER_CACHE_SECONDS` and so
// restated that definition -- it could not fail, and it did not, while the real
// chain (which spends a cache window at the Data Cache AND again at the CDN)
// had already put a served body 36 minutes past a 30-minute contract. A body
// that arrives stale floors `msUntilStale`, which is the 30-second poll the
// module header warns about.
const UPSTREAM_BUCKET_MS = 15 * 60_000;
const CDN_WINDOW_MS =
	(CDN_CACHE_SECONDS + CDN_STALE_WHILE_REVALIDATE_SECONDS) * 1_000;
/** Age at the visitor's eye when every window is spent in full. */
const WORST_DELIVERED_AGE_MS =
	UPSTREAM_BUCKET_MS + WEATHER_CACHE_SECONDS * 1_000 + CDN_WINDOW_MS;

describe('the freshness budget', () => {
	it('holds the contract at 30 minutes', () => {
		expect(MAX_SNAPSHOT_AGE_MS).toBe(30 * 60_000);
	});

	it('counts every window the chain spends', () => {
		expect(WORST_DELIVERED_AGE_MS).toBeLessThan(MAX_SNAPSHOT_AGE_MS);
	});

	it('never delivers a body that is already stale on arrival', () => {
		const justDelivered = new Date(NOW - WORST_DELIVERED_AGE_MS).toISOString();
		expect(isSnapshotStale(justDelivered, NOW)).toBe(false);
		// And it converges: the refresh is a real wait, not the floor.
		expect(msUntilStale(justDelivered, NOW)).toBeGreaterThan(60_000);
	});

	it('keeps the origin threshold tight enough for the edge to hold a body', () => {
		// Whatever the handler lets out, the CDN may age by CDN_WINDOW_MS more.
		expect(MAX_ORIGIN_SNAPSHOT_AGE_MS + CDN_WINDOW_MS).toBeLessThanOrEqual(
			MAX_SNAPSHOT_AGE_MS
		);
	});

	it('does not trip the origin re-read on a healthy cache hit', () => {
		// bucket + a full Data Cache window is the worst HEALTHY origin age; if the
		// threshold sat below it, every cache hit would pay an uncached re-read.
		const healthyOriginAge = UPSTREAM_BUCKET_MS + WEATHER_CACHE_SECONDS * 1_000;
		expect(healthyOriginAge).toBeLessThan(MAX_ORIGIN_SNAPSHOT_AGE_MS);
	});
});

describe('clampRefreshDelay', () => {
	it('floors a delay that is already past due', () => {
		expect(clampRefreshDelay(-1)).toBeGreaterThan(0);
	});

	it('caps a delay that would overflow setTimeout', () => {
		// A clock years in the past yields decades of ms; past 2^31-1 setTimeout
		// wraps and fires on the next tick, re-arming into a hot loop.
		expect(clampRefreshDelay(30 * 365 * 24 * 3_600_000)).toBeLessThanOrEqual(
			2_147_483_647
		);
	});

	it('caps msUntilStale for a clock far in the past', () => {
		const skewed = msUntilStale(new Date(NOW).toISOString(), 0);
		expect(skewed).toBeLessThanOrEqual(2_147_483_647);
	});
});
