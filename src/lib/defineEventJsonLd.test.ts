import { describe, expect, it } from 'vitest';
import defineEventJsonLd from './defineEventJsonLd';

const siteUrl = 'https://blackwaterrc.com';

describe('defineEventJsonLd', () => {
	it('builds a SportsEvent with sensible defaults', () => {
		const ld = defineEventJsonLd({
			data: {
				slug: 'race-1',
				title: 'BW-1',
				eventDatetime: { local: '2025-06-23T09:00:00', utc: '2025-06-23T01:00:00.000Z' },
			},
		});
		expect(ld).toMatchObject({
			'@context': 'https://schema.org',
			'@type': 'SportsEvent',
			sport: 'Running',
			eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
			startDate: '2025-06-23T09:00:00',
			organizer: { '@id': `${siteUrl}#organization` },
		});
		// Falls back to EventScheduled when no dateStatus is given.
		expect(ld.eventStatus).toBe('https://schema.org/EventScheduled');
		expect(ld.url).toBe(`${siteUrl}/events/race-1`);
	});

	it('maps dateStatus to the matching schema.org event status', () => {
		const cancelled = defineEventJsonLd({
			data: { slug: 's', title: 'T', dateStatus: 'cancelled' },
		});
		expect(cancelled.eventStatus).toBe('https://schema.org/EventCancelled');
	});

	it('builds a single-location Place with address and geo', () => {
		const ld = defineEventJsonLd({
			data: {
				slug: 's',
				title: 'T',
				locationRef: {
					name: 'Taipei Velodrome',
					address: { addressLocality: 'Taipei' },
					geo: { lat: 25.04, lng: 121.56 },
				},
			},
		});
		expect(ld.location).toMatchObject({
			'@type': 'Place',
			name: 'Taipei Velodrome',
			address: { '@type': 'PostalAddress', addressLocality: 'Taipei' },
			geo: {
				'@type': 'GeoCoordinates',
				latitude: 25.04,
				longitude: 121.56,
			},
		});
	});

	it('emits subEvents for multi-location events', () => {
		const ld = defineEventJsonLd({
			data: {
				slug: 's',
				title: 'T',
				format: 'multi-location',
				startEndLocation: { name: 'Start Line' },
				eventDatetime: { local: '2025-06-23T09:00:00' },
				stations: [
					{ name: 'Checkpoint A', locationName: 'Park' },
					{ locationName: null }, // no place → dropped
				],
			},
		});
		const subEvents = ld.subEvent as any[];
		expect(subEvents).toHaveLength(1);
		expect(subEvents[0]).toMatchObject({
			'@type': 'Event',
			name: 'Station 1: Checkpoint A',
			location: { '@type': 'Place', name: 'Park' },
			startDate: '2025-06-23T09:00:00',
		});
	});

	it('collects category titles plus eventType into keywords', () => {
		const ld = defineEventJsonLd({
			data: {
				slug: 's',
				title: 'T',
				categories: [{ title: 'Road' }, { title: null }, {}],
				eventType: 'race',
			},
		});
		expect(ld.keywords).toEqual(['Road', 'race']);
	});

	it('reflects a boolean isFree as isAccessibleForFree', () => {
		expect(
			defineEventJsonLd({ data: { slug: 's', title: 'T', isFree: true } })
				.isAccessibleForFree
		).toBe(true);
		// Absent isFree omits the field entirely.
		expect(
			'isAccessibleForFree' in
				defineEventJsonLd({ data: { slug: 's', title: 'T' } })
		).toBe(false);
	});
});
