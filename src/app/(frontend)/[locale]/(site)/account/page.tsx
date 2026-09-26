import type { Metadata } from 'next';
import { interpolate } from '@/lib/dictionary';
import { getDictionary } from '@/lib/dictionary.server';
import { FALLBACK_TIMEZONE } from '@/lib/event-date';
import { DEFAULT_LOCALE, htmlLangFor, isLocale } from '@/lib/i18n';
import { getCurrentMember } from '@/lib/member/session';
import { SessionRefresh } from './_components/SessionRefresh';
import { SignInForm } from './_components/SignInForm';
import { SignOutButton } from './_components/SignOutButton';

type Props = { params: Promise<{ locale: string }> };

// Personal, so never indexed. It also has no document behind it, which is why
// it is absent from the sitemaps and from DOCUMENT_ROUTES.
export async function generateMetadata(props: Props): Promise<Metadata> {
	const { locale } = await props.params;
	const t = await getDictionary(isLocale(locale) ? locale : DEFAULT_LOCALE);
	return {
		title: t.account.metaTitle,
		robots: { index: false, follow: false },
	};
}

// The one dynamic page under [locale]: getCurrentMember() reads the request's
// cookies. Only this route opts out of static generation -- the same call in a
// layout would take every page beneath it out.
export default async function Page(props: Props) {
	const { locale: param } = await props.params;
	const locale = isLocale(param) ? param : DEFAULT_LOCALE;
	const [member, { account: t }] = await Promise.all([
		getCurrentMember(),
		getDictionary(locale),
	]);

	return (
		<div className="p-x-max min-h-main flex items-center justify-center py-10 lg:py-17.5">
			<div className="w-full max-w-sm">
				{member === 'unavailable' ? (
					<>
						<h1 className="t-h-1 mb-3 font-medium text-balance">
							{t.details.heading}
						</h1>
						<p className="t-b-1 text-pretty">{t.unavailable}</p>
					</>
				) : member ? (
					<>
						<h1 className="t-h-1 mb-3 font-medium text-balance">
							{t.details.heading}
						</h1>
						<p className="t-b-1 break-words">
							{interpolate(t.details.signedInAs, { email: member.email })}
						</p>
						<p className="t-b-1 text-foreground/60 mt-1">
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
						<SignOutButton className="mt-6" />
					</>
				) : (
					<SignInForm />
				)}
				{member !== 'unavailable' && (
					<SessionRefresh key={member ? 'member' : 'visitor'} />
				)}
			</div>
		</div>
	);
}
