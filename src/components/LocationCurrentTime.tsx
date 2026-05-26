'use client';
import { useState, useEffect } from 'react';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { enUS, zhTW } from 'date-fns/locale';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import type { Locale } from '@/lib/i18n';

const DATE_FNS_LOCALES: Record<Locale, Locale extends 'zh_tw' ? typeof zhTW : typeof enUS> = {
	en: enUS,
	zh_tw: zhTW,
} as Record<Locale, typeof enUS | typeof zhTW>;

export function LocationCurrentTime() {
	const [time, setTime] = useState<Date | null>(null);
	const locale = useLocale();
	const t = useTranslations('locationCurrentTime');

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
				{t.placeholder}
			</time>
		);
	}

	const tzDate = new TZDate(time, 'Asia/Singapore');
	const formattedTime = format(tzDate, t.dateFormat, { locale: DATE_FNS_LOCALES[locale] });
	const colonIndex = formattedTime.indexOf(':');

	return (
		<time>
			{formattedTime.slice(0, colonIndex)}
			<span className="animate-blinker">:</span>
			{formattedTime.slice(colonIndex + 1)}
		</time>
	);
}
