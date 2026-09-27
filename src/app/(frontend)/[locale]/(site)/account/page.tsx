import { type Locale, htmlLangFor } from '@/lib/i18n';
import { COUNTRY_CODES } from '@/lib/member/countries';
import {
	AccountPage,
	type AccountPageProps,
	accountMetadata,
	resolveLocale,
} from './_components/AccountPage';
import { ProfileForm } from './_components/ProfileForm';

export const generateMetadata = (props: AccountPageProps) =>
	accountMetadata(props, 'profile');

/** Every country named in the page's language, in its alphabetical order.
 *  Named here, on the server, and handed down: Node's and the browser's ICU
 *  data word a few regions differently, which would be a hydration mismatch
 *  in 249 places. */
function countryOptions(locale: Locale) {
	const lang = htmlLangFor(locale);
	const names = new Intl.DisplayNames([lang], { type: 'region' });
	const collator = new Intl.Collator(lang);
	return COUNTRY_CODES.map((code) => ({
		code,
		name: names.of(code) ?? code,
	})).sort((a, b) => collator.compare(a.name, b.name));
}

// The one dynamic page tree under [locale]: AccountPage reads the request's
// cookies. Only these routes opt out of static generation -- the same call in
// a layout would take every page beneath it out.
export default async function Page(props: AccountPageProps) {
	const locale = await resolveLocale(props);
	return (
		<AccountPage locale={locale} section="profile">
			{(member) => (
				<ProfileForm
					email={member.email}
					countries={countryOptions(locale)}
					initial={{
						firstName: member.firstName,
						lastName: member.lastName,
						birthday: member.birthday,
						phone: member.phone,
						country: member.country,
						emergencyContactName: member.emergencyContactName,
						emergencyContactPhone: member.emergencyContactPhone,
					}}
				/>
			)}
		</AccountPage>
	);
}
