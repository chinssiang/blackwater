import Link from 'next/link';
import { sanityFetch } from '@/sanity/lib/live';
import { memberHistoryEventsQuery } from '@/sanity/lib/queries';
import { buildClubHistory, splitClubHistory } from '@/lib/club-history';
import { interpolate } from '@/lib/dictionary';
import { getDictionary } from '@/lib/dictionary.server';
import { localizePath } from '@/lib/i18n';
import { getMemberAttendance } from '@/lib/member/attendance';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/Button';
import {
	AccountPage,
	type AccountPageProps,
	accountMetadata,
	resolveLocale,
} from '../_components/AccountPage';
import {
	AccountHeading,
	AccountSectionBlock,
} from '../_components/AccountSections';
import { HistoryList } from '../_components/HistoryList';

export const generateMetadata = (props: AccountPageProps) =>
	accountMetadata(props, 'history');

/** The member's rows, or null when the database read failed -- told apart
 *  from an empty history, which would say "nothing here yet" to someone who
 *  has been to twenty runs. */
async function readAttendance(email: string) {
	try {
		return await getMemberAttendance(email);
	} catch (err) {
		console.error('[member] attendance read failed', err);
		return null;
	}
}

export default async function Page(props: AccountPageProps) {
	const locale = await resolveLocale(props);
	const { account: t } = await getDictionary(locale);

	return (
		<AccountPage locale={locale} section="history">
			{async (member) => {
				const [rows, { data: events }] = await Promise.all([
					readAttendance(member.email),
					sanityFetch({
						query: memberHistoryEventsQuery,
						params: { locale },
						tags: ['pEvent'],
					}),
				]);
				const heading = <AccountHeading heading={t.history.heading} />;
				if (!rows) {
					return (
						<>
							{heading}
							<p className="t-b-1 text-pretty">{t.unavailable}</p>
						</>
					);
				}

				const history = buildClubHistory(rows, events);
				const { upcoming, past } = splitClubHistory(history);

				if (!history.length) {
					return (
						<>
							{heading}
							<p className="t-b-1 text-pretty">{t.history.empty}</p>
							<Link
								href={localizePath('/events', locale)}
								className={cn(
									buttonVariants({ variant: 'outline', size: 'lg' }),
									'mt-6'
								)}
							>
								{t.history.emptyCta}
							</Link>
						</>
					);
				}

				return (
					<>
						<AccountHeading
							heading={t.history.heading}
							// A sentence, not a counter tile -- see PRODUCT.md.
							intro={
								past.length
									? interpolate(
											past.length === 1
												? t.history.summaryOne
												: t.history.summaryOther,
											{ count: past.length }
										)
									: undefined
							}
						/>
						{upcoming.length > 0 && (
							<AccountSectionBlock heading={t.history.upcomingHeading}>
								<HistoryList entries={upcoming} locale={locale} t={t.history} />
							</AccountSectionBlock>
						)}
						{past.length > 0 && (
							<AccountSectionBlock heading={t.history.pastHeading}>
								<HistoryList entries={past} locale={locale} t={t.history} />
							</AccountSectionBlock>
						)}
					</>
				);
			}}
		</AccountPage>
	);
}
