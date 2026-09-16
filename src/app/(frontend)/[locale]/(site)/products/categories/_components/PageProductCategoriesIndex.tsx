'use client';

import Link from 'next/link';
import type { WithoutPageMetadata } from '@/lib/defineMetadata';
import { localizePath } from '@/lib/i18n';
import { resolveHref } from '@/lib/routes';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import ProductCategoriesGrid from '../../_components/ProductCategoriesGrid';
import ProductPageHeader from '../../_components/ProductPageHeader';
import type { PageProductCategoriesIndexQueryResult } from 'sanity.types';

type Props = {
	data: WithoutPageMetadata<NonNullable<PageProductCategoriesIndexQueryResult>>;
};

export function PageProductCategoriesIndex({ data }: Props) {
	const locale = useLocale();
	const breadcrumb = useTranslations('breadcrumb');
	const t = useTranslations('products');
	const { categories, productCount } = data || {};

	return (
		<>
			{/* Breadcrumb */}
			<nav
				aria-label="Breadcrumb"
				className="m-x-max reveal t-l-2 text-foreground/60 mb-10 flex flex-wrap items-center gap-x-2 gap-y-1 uppercase lg:mb-16"
			>
				<Link
					href={resolveHref({ documentType: 'pProductIndex', locale })!}
					className="hover:text-foreground inline-flex items-center transition-colors pointer-coarse:min-h-11"
				>
					{breadcrumb.products}
				</Link>
				<span aria-hidden className="text-foreground/30">
					/
				</span>
				<span aria-current="page" className="text-foreground/90">
					{t.categoriesTitle}
				</span>
			</nav>

			<ProductPageHeader
				title={t.categoriesTitle}
				counts={[
					{
						count: productCount,
						forms: t.productCount,
						href: localizePath('/products/all', locale),
					},
					{ count: categories?.length, forms: t.categoryCount },
				]}
			/>

			<ProductCategoriesGrid
				className="m-x-max"
				categories={categories ?? null}
				heading={null}
				priority
			/>
		</>
	);
}
