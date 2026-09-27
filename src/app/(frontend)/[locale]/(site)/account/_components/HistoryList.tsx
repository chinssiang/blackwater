import Link from 'next/link';
import type { ClubHistoryEntry } from '@/lib/club-history';
import { type Locale, htmlLangFor, localizePath } from '@/lib/i18n';
import { INLINE_LINK_FOCUS, cn } from '@/lib/utils';

/** Club history as a plain list: date, event, and a mark when the crew
 *  checked the member in. Typographic on purpose -- see PRODUCT.md. */
export function HistoryList({
	entries,
	locale,
	t,
}: {
	entries: ClubHistoryEntry[];
	locale: Locale;
	t: { checkedIn: string; untitled: string };
}) {
	return (
		<ol>
			{entries.map((entry) => {
				const title = entry.title || t.untitled;
				return (
					<li
						key={entry.key}
						className="border-border flex items-baseline gap-4 border-b py-3 last:border-b-0"
					>
						<span className="t-spec text-muted-foreground w-24 shrink-0">
							{entry.startsAt &&
								new Intl.DateTimeFormat(htmlLangFor(locale), {
									year: 'numeric',
									month: 'short',
									day: 'numeric',
									timeZone: entry.timeZone,
								}).format(entry.startsAt)}
						</span>
						<span className="t-b-1 min-w-0 flex-1 break-words">
							{entry.slug ? (
								<Link
									href={localizePath(`/events/${entry.slug}`, locale)}
									className={cn(
										'hover:text-foreground/60 transition-[color,box-shadow]',
										INLINE_LINK_FOCUS
									)}
								>
									{title}
								</Link>
							) : (
								title
							)}
						</span>
						{entry.checkedIn && (
							<span className="t-spec text-muted-foreground shrink-0 uppercase">
								{t.checkedIn}
							</span>
						)}
					</li>
				);
			})}
		</ol>
	);
}
