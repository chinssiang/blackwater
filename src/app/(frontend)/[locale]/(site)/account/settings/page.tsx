import { interpolate } from '@/lib/dictionary';
import { getDictionary } from '@/lib/dictionary.server';
import { FALLBACK_TIMEZONE } from '@/lib/event-date';
import { htmlLangFor } from '@/lib/i18n';
import { canReceiveEmailMarketing } from '@/lib/klaviyo';
import { describeDevice } from '@/lib/member/device-name';
import { listMemberDevices } from '@/lib/member/devices';
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
import { DeleteAccount } from '../_components/DeleteAccount';
import { LanguagePreference } from '../_components/LanguagePreference';
import { NewsletterPreference } from '../_components/NewsletterPreference';
import { SignOutOthersButton } from '../_components/SignOutOthersButton';

export const generateMetadata = (props: AccountPageProps) =>
	accountMetadata(props, 'settings');

async function readDevices(memberId: string, sessionId: string) {
	try {
		return await listMemberDevices(memberId, sessionId);
	} catch (err) {
		console.error('[member] device list failed', err);
		return null;
	}
}

export default async function Page(props: AccountPageProps) {
	const locale = await resolveLocale(props);
	const { account: t } = await getDictionary(locale);
	const dateFormat = new Intl.DateTimeFormat(htmlLangFor(locale), {
		dateStyle: 'medium',
		timeZone: FALLBACK_TIMEZONE,
	});

	return (
		<AccountPage locale={locale} section="settings">
			{async (member) => {
				const [devices, newsletter] = await Promise.all([
					readDevices(member.id, member.sessionId),
					canReceiveEmailMarketing(member.email),
				]);
				return (
					<>
						<AccountHeading heading={t.settings.heading} />

						<AccountSectionBlock heading={t.settings.languageHeading}>
							<LanguagePreference initial={member.preferredLocale} />
						</AccountSectionBlock>

						<AccountSectionBlock heading={t.settings.newsletterHeading}>
							{newsletter === null ? (
								<p className="t-b-1 text-muted-foreground text-pretty">
									{t.settings.newsletterUnavailable}
								</p>
							) : (
								<NewsletterPreference
									initial={newsletter}
									email={member.email}
								/>
							)}
						</AccountSectionBlock>

						<AccountSectionBlock heading={t.settings.devicesHeading}>
							<p className="t-b-2 text-muted-foreground mb-2 text-pretty">
								{t.settings.devicesIntro}
							</p>
							{devices ? (
								<ul>
									{devices.map((device) => (
										<li
											key={device.id}
											className="border-border flex items-baseline justify-between gap-4 border-b py-3 last:border-b-0"
										>
											<span className="t-b-1 min-w-0 break-words">
												{describeDevice(device.userAgent) ||
													t.settings.unknownDevice}
											</span>
											<span className="t-spec text-muted-foreground shrink-0 uppercase">
												{device.current
													? t.settings.thisDevice
													: interpolate(t.settings.lastActive, {
															date: dateFormat.format(device.lastSeenAt),
														})}
											</span>
										</li>
									))}
								</ul>
							) : (
								<p className="t-b-1 text-pretty">{t.unavailable}</p>
							)}
							{/* Also offered when the list could not be read, since it
							    is how a member ends a session they did not start. */}
							{(!devices || devices.length > 1) && (
								<SignOutOthersButton className="mt-4" />
							)}
						</AccountSectionBlock>

						<AccountSectionBlock heading={t.settings.deleteHeading}>
							<p className="t-b-1 text-pretty">{t.settings.deleteIntro}</p>
							<DeleteAccount className="mt-4" />
						</AccountSectionBlock>
					</>
				);
			}}
		</AccountPage>
	);
}
