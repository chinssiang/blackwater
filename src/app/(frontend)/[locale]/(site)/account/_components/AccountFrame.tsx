import Link from 'next/link';
import { type Dictionary, interpolate } from '@/lib/dictionary';
import { FALLBACK_TIMEZONE } from '@/lib/event-date';
import { type Locale, htmlLangFor, localizePath } from '@/lib/i18n';
import { formatMemberName } from '@/lib/member/name';
import type { CurrentMember } from '@/lib/member/session';
import { INLINE_LINK_FOCUS, cn } from '@/lib/utils';
import { SessionRefresh } from './SessionRefresh';
import { SignOutButton } from './SignOutButton';

/** The sidebar, in order. `/account` itself is the profile, so the header's
 *  account link lands somewhere useful rather than on an overview page. */
const SECTIONS = [
	{ key: 'profile', path: '/account' },
	{ key: 'history', path: '/account/history' },
	{ key: 'orders', path: '/account/orders' },
	{ key: 'settings', path: '/account/settings' },
] as const;

export type AccountSection = (typeof SECTIONS)[number]['key'];

/**
 * The signed-in account pages' frame: who is signed in, the section nav, and
 * the page beside it. Markup only -- AccountPage reads the session and hands
 * the member in.
 */
export function AccountFrame({
	locale,
	section,
	member,
	t,
	children,
}: {
	locale: Locale;
	section: AccountSection;
	member: Pick<
		CurrentMember,
		'email' | 'firstName' | 'lastName' | 'memberSince'
	>;
	t: Pick<Dictionary['account'], 'nav' | 'details'>;
	children: React.ReactNode;
}) {
	const name = formatMemberName(member.firstName, member.lastName);

	return (
		<div className="p-x-max min-h-main py-10 lg:grid lg:grid-cols-[13rem_minmax(0,36rem)] lg:gap-x-16 lg:py-17.5">
			<aside className="lg:top-header-space-17.5 lg:sticky lg:self-start">
				<div className="mb-6 lg:mb-8">
					<p className="t-l-0 break-words">{name || member.email}</p>
					{name && (
						<p className="t-b-2 text-muted-foreground mt-1 break-words">
							{member.email}
						</p>
					)}
					<p className="t-b-2 text-muted-foreground mt-1">
						{interpolate(t.details.memberSince, {
							// In the club's timezone: the server runs in UTC, and a
							// member who joined late on the last of a month in Taipei
							// would otherwise see the following month.
							date: new Intl.DateTimeFormat(htmlLangFor(locale), {
								year: 'numeric',
								month: 'long',
								timeZone: FALLBACK_TIMEZONE,
							}).format(member.memberSince),
						})}
					</p>
				</div>
				<nav aria-label={t.nav.label}>
					{/* A row that scrolls sideways on a phone, a column beside the
					    content from lg. The rule under the row is the list's own
					    border; the active item's 2px marker overlaps it (-mb-px). */}
					<ul className="border-border flex gap-6 overflow-x-auto border-b lg:flex-col lg:gap-1 lg:overflow-visible lg:border-b-0">
						{SECTIONS.map(({ key, path }) => (
							<li key={key} className="shrink-0">
								<Link
									href={localizePath(path, locale)}
									aria-current={key === section ? 'page' : undefined}
									className={cn(
										't-l-1 text-foreground/60 hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground -mb-px block border-b-2 border-transparent py-3 whitespace-nowrap uppercase transition-[color,border-color,box-shadow] lg:mb-0 lg:border-b-0 lg:border-l-2 lg:py-2 lg:pl-3',
										INLINE_LINK_FOCUS
									)}
								>
									{t.nav[key]}
								</Link>
							</li>
						))}
					</ul>
				</nav>
				<SignOutButton className="mt-8 hidden lg:inline-flex" />
			</aside>
			<div className="mt-8 lg:mt-0">
				{children}
				{/* The sidebar's copy is hidden below lg; this is the phone's. */}
				<SignOutButton className="mt-12 lg:hidden" />
			</div>
			<SessionRefresh key="member" />
		</div>
	);
}
