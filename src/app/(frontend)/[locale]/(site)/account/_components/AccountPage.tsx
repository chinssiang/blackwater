import type { Metadata } from 'next';
import { getDictionary } from '@/lib/dictionary.server';
import { DEFAULT_LOCALE, type Locale, isLocale } from '@/lib/i18n';
import { type CurrentMember, getCurrentMember } from '@/lib/member/session';
import { AccountFrame, type AccountSection } from './AccountFrame';
import { SessionRefresh } from './SessionRefresh';
import { SignInForm } from './SignInForm';

export type AccountPageProps = { params: Promise<{ locale: string }> };

export async function resolveLocale(props: AccountPageProps): Promise<Locale> {
	const { locale } = await props.params;
	return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

// Personal, so never indexed. These pages have no document behind them, which
// is why they are absent from the sitemaps and from DOCUMENT_ROUTES.
export async function accountMetadata(
	props: AccountPageProps,
	section: AccountSection
): Promise<Metadata> {
	const { account: t } = await getDictionary(await resolveLocale(props));
	return {
		title: section === 'profile' ? t.metaTitle : t.nav[section],
		robots: { index: false, follow: false },
	};
}

/**
 * Every /account page: the sign-in form for a visitor, the "unavailable" note
 * when membership cannot be served, and otherwise the sidebar beside
 * `children(member)`.
 *
 * Each page calls this rather than a shared layout.tsx, because this is where
 * the session is read, and a layout that reads it is what CLAUDE.md warns
 * against: a layout does not re-render between its pages, so a session that
 * ended would keep its sidebar, and the read would cover every page beneath.
 */
export async function AccountPage({
	locale,
	section,
	children,
}: {
	locale: Locale;
	section: AccountSection;
	children: (
		member: CurrentMember
	) => React.ReactNode | Promise<React.ReactNode>;
}) {
	const [member, { account: t }] = await Promise.all([
		getCurrentMember(),
		getDictionary(locale),
	]);

	if (member === 'unavailable' || !member) {
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
					) : (
						<>
							{/* After signing in, the refresh re-renders THIS page, so a
							    visitor sent to /account/orders ends up there. */}
							<SignInForm />
							<SessionRefresh key="visitor" />
						</>
					)}
				</div>
			</div>
		);
	}

	return (
		<AccountFrame
			locale={locale}
			section={section}
			member={member}
			t={{ nav: t.nav, details: t.details }}
		>
			{await children(member)}
		</AccountFrame>
	);
}
