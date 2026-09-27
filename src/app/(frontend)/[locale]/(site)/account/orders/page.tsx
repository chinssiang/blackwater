import Link from 'next/link';
import { getDictionary } from '@/lib/dictionary.server';
import { localizePath } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/Button';
import {
	AccountPage,
	type AccountPageProps,
	accountMetadata,
	resolveLocale,
} from '../_components/AccountPage';
import { AccountHeading } from '../_components/AccountSections';

export const generateMetadata = (props: AccountPageProps) =>
	accountMetadata(props, 'orders');

// A shell for now. Orders need a Shopify integration that can read a
// customer's orders, which the Storefront token cannot; the choice between
// the Customer Account API and a Dev Dashboard app is in docs/MEMBERSHIP.md.
export default async function Page(props: AccountPageProps) {
	const locale = await resolveLocale(props);
	const { account: t } = await getDictionary(locale);
	return (
		<AccountPage locale={locale} section="orders">
			{() => (
				<>
					<AccountHeading heading={t.orders.heading} />
					<p className="t-b-1 text-pretty">{t.orders.empty}</p>
					<Link
						href={localizePath('/products', locale)}
						className={cn(
							buttonVariants({ variant: 'outline', size: 'lg' }),
							'mt-6'
						)}
					>
						{t.orders.cta}
					</Link>
				</>
			)}
		</AccountPage>
	);
}
