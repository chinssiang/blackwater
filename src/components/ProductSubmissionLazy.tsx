'use client';

import dynamic from 'next/dynamic';

// The submission FAB sits in products/layout.tsx, so a static import puts its
// dependencies — react-hook-form, zod and @hookform/resolvers — into the
// initial JS of every /products/* route, including the product detail page.
// Measured on a production build: they land in one 84 KB chunk that the detail
// page's HTML referenced up front, for a dialog most visitors never open.
//
// `ssr: false` because nothing here is content: it's a secondary affordance
// with no SEO value and no server markup worth hydrating. products/layout.tsx
// is a Server Component, which cannot pass `ssr: false` itself — hence this
// thin client wrapper, the same shape CartDrawer uses for its panel.
const ProductSubmission = dynamic(
	() => import('./ProductSubmission').then((m) => m.ProductSubmission),
	{
		ssr: false,
		// Reserves the FAB's exact box so the sticky container doesn't grow from
		// zero to 48px when the chunk lands.
		loading: () => <div aria-hidden className="size-12" />,
	}
);

export default function ProductSubmissionLazy() {
	return <ProductSubmission />;
}
