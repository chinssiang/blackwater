'use client';
import { useState, useEffect } from 'react';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export function LocationCurrentTime() {
	const [time, setTime] = useState<Date | null>(null);

	useEffect(() => {
		let intervalId: ReturnType<typeof setInterval>;

		const now = new Date();
		const msUntilNextMinute =
			(60 - now.getSeconds()) * 1000 - now.getMilliseconds();

		// Show current time immediately (in callback to satisfy lint)
		const initId = setTimeout(() => setTime(new Date()), 0);

		// Align to the next minute boundary, then tick every 60s
		const syncId = setTimeout(() => {
			setTime(new Date());
			intervalId = setInterval(() => setTime(new Date()), 60_000);
		}, msUntilNextMinute);

		return () => {
			clearTimeout(initId);
			clearTimeout(syncId);
			clearInterval(intervalId);
		};
	}, []);

	if (!time) {
		return (
			<time aria-hidden="true" className="invisible">
				Wednesday, 12:00 AM
			</time>
		);
	}

	const tzDate = new TZDate(time, 'Asia/Singapore');
	const formattedTime = format(tzDate, 'iiii, p');
	const colonIndex = formattedTime.indexOf(':');

	return (
		<time>
			{formattedTime.slice(0, colonIndex)}
			<span className="animate-blinker">:</span>
			{formattedTime.slice(colonIndex + 1)}
		</time>
	);
}
