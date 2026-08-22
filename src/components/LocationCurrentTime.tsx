'use client';
import { useState, useEffect } from 'react';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';

export function LocationCurrentTime() {
	const [time, setTime] = useState<Date>(() => new Date());
	const locale = useLocale();
	const t = useTranslations('locationCurrentTime');

	useEffect(() => {
		let intervalId: ReturnType<typeof setInterval>;

		const now = new Date();
		const msUntilNextMinute =
			(60 - now.getSeconds()) * 1000 - now.getMilliseconds();

		// Align to the next minute boundary, then tick every 60s
		const syncId = setTimeout(() => {
			setTime(new Date());
			intervalId = setInterval(() => setTime(new Date()), 60_000);
		}, msUntilNextMinute);

		return () => {
			clearTimeout(syncId);
			clearInterval(intervalId);
		};
	}, []);

	const tzDate = new TZDate(time, 'Asia/Singapore');
	const formattedTime = format(tzDate, t.dateFormat, { locale: DATE_FNS_LOCALES[locale] });
	const colonIndex = formattedTime.indexOf(':');

	return (
		// min-w must match the Lazy wrapper's placeholder so the placeholder →
		// clock swap is width-stable. 15ch covers the widest realistic string in
		// both locales ("週六, 下午 11:31" — 4 CJK glyphs at ~2ch each — and
		// "Wed, 11:28 AM"); `ch` is the digit advance, which `tabular-nums` makes
		// uniform, so the box also survives the 9:59 → 10:00 rollover.
		<time
			suppressHydrationWarning
			className="tabular-nums inline-block min-w-[15ch]"
		>
			{formattedTime.slice(0, colonIndex)}
			<span className="animate-blinker">:</span>
			{formattedTime.slice(colonIndex + 1)}
		</time>
	);
}
