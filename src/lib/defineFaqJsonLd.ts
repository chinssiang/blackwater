// FAQPage JSON-LD from a normalized list of resolved FAQ entries.
// schema.org Answer.text is plain text, so we use `answerText` (the gFaq rich
// answer flattened via pt::text in GROQ). Returns null when empty.
type FaqItem = { question?: string | null; answerText?: string | null };

type ModuleLike = { _type?: string; items?: FaqItem[] | null };

// Flatten the FAQ entries selected across all `faqList` page modules on a page.
export function collectFaqItems(
	modules: ModuleLike[] | null | undefined
): FaqItem[] {
	if (!Array.isArray(modules)) return [];
	return modules
		.filter((m) => m?._type === 'faqList' && Array.isArray(m.items))
		.flatMap((m) => m.items ?? []);
}

export default function defineFaqJsonLd(
	items: FaqItem[] | null | undefined
): Record<string, unknown> | null {
	if (!Array.isArray(items)) return null;

	const mainEntity = items
		.map((item) => {
			const name = item?.question?.trim();
			const text = item?.answerText?.trim();
			if (!name || !text) return null;
			return {
				'@type': 'Question',
				name,
				acceptedAnswer: { '@type': 'Answer', text },
			};
		})
		.filter(Boolean);

	if (mainEntity.length === 0) return null;

	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity,
	};
}
