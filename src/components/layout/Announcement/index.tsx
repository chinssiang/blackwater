'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
	announcementIntervalMs,
	clampMessageIndex,
	resolveAnnouncementColors,
} from '@/lib/announcement';
import { interpolate } from '@/lib/dictionary';
import { isHomePath } from '@/lib/routes';
import { cn } from '@/lib/utils';
import CustomPortableText from '@/components/CustomPortableText';
import { useTranslations } from '@/components/LocaleProvider';
import type { SiteDataQueryResult } from 'sanity.types';

export type AnnouncementData = NonNullable<SiteDataQueryResult['announcement']>;

/**
 * The site-wide announcement bar, `fixed` above the header. It publishes its
 * height as `--h-announcement` (DESIGN.md, Known dead or broken, has the
 * consumers). All messages share one grid cell, so the bar is as tall as the
 * tallest one and rotating never moves the page. Autoplay pauses on hover or
 * focus and stops once a visitor picks a message (WCAG 2.2.2).
 */
export default function Announcement({ data }: { data: AnnouncementData }) {
	const t = useTranslations('announcement');
	const pathname = usePathname();
	const ref = useRef<HTMLElement>(null);
	const [active, setActive] = useState(0);
	// Derived, not seeded, so a live edit to `autoplay` reaches a mounted bar.
	const [hasPicked, setHasPicked] = useState(false);
	const isAutoplay = Boolean(data.autoplay) && !hasPicked;
	// Keyed to the route it was paused on: a link in the bar navigates without
	// a blur, so a plain boolean would stay paused on every later page.
	const [pausedOn, setPausedOn] = useState<string | null>(null);
	const isPaused = pausedOn === pathname;

	const messages = data.messages ?? [];
	const current = clampMessageIndex(active, messages.length);
	const isShown = !data.homepageOnly || isHomePath(pathname);
	const interval = announcementIntervalMs(data.autoplayInterval);

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const root = document.documentElement;
		// Width changes fire this too; write only when the height moves, since
		// each write on <html> restyles the whole document.
		let height = -1;
		const observer = new ResizeObserver(() => {
			// Unrounded, unlike offsetHeight, so offsets match the bar exactly.
			const next = el.getBoundingClientRect().height;
			if (next === height) return;
			height = next;
			root.style.setProperty('--h-announcement', `${height}px`);
		});
		observer.observe(el);
		return () => {
			observer.disconnect();
			root.style.removeProperty('--h-announcement');
		};
	}, [isShown]);

	useEffect(() => {
		if (!isShown || !isAutoplay || isPaused || messages.length < 2) return;
		const id = setInterval(
			() => setActive((i) => (i + 1) % messages.length),
			interval
		);
		return () => clearInterval(id);
	}, [isShown, isAutoplay, isPaused, messages.length, interval]);

	if (!isShown) return null;

	// Its own surface, distinct from the header's: the authored colour, else
	// the theme inverted so the bar never blends into the header.
	const { paper, ink, emphasis } = resolveAnnouncementColors(data);

	return (
		<aside
			ref={ref}
			data-announcement
			aria-label={t.label}
			className={cn(
				'p-x-max bg-foreground text-background z-header fixed inset-x-0 top-0 flex min-h-8 items-center gap-3',
				emphasis && '[&_:is(b,strong)]:text-(--announcement-emphasis)'
			)}
			style={
				{
					backgroundColor: paper || undefined,
					color: ink || undefined,
					'--announcement-emphasis': emphasis || undefined,
				} as React.CSSProperties
			}
			onPointerEnter={() => setPausedOn(pathname)}
			onPointerLeave={() => setPausedOn(null)}
			onFocus={() => setPausedOn(pathname)}
			onBlur={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget)) setPausedOn(null);
			}}
		>
			<div className="t-l-1 grid flex-1 py-2 text-center [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition-colors [&_a:hover]:text-[color-mix(in_oklab,currentColor_60%,transparent)]">
				{messages.map((message, index) => (
					<div
						key={message._key}
						className={cn(
							'col-start-1 row-start-1 transition-[opacity,visibility] duration-300',
							index === current ? 'visible opacity-100' : 'invisible opacity-0'
						)}
					>
						<CustomPortableText blocks={message.content} />
					</div>
				))}
			</div>
			{messages.length > 1 && (
				<div className="-mr-2 flex shrink-0">
					{messages.map((message, index) => (
						<button
							key={message._key}
							type="button"
							aria-label={interpolate(t.showMessage, {
								count: index + 1,
								total: messages.length,
							})}
							aria-current={index === current ? 'true' : undefined}
							onClick={() => {
								setActive(index);
								setHasPicked(true);
							}}
							// Ring in the bar's own ink, which follows an authored text
							// colour; CONTROL_FOCUS's fixed accent may vanish against it.
							className="group/dot flex size-6 cursor-pointer items-center justify-center rounded-full transition-[box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-current"
						>
							<span
								className={cn(
									'size-1.5 rounded-full border border-current transition-colors',
									index === current
										? 'bg-current'
										: 'group-hover/dot:bg-current/60'
								)}
							/>
						</button>
					))}
				</div>
			)}
		</aside>
	);
}
