import { HelpCircleIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';
import { pickValueForLocale, requireSomeValue } from '@/lib/i18n';

// A single, globally reusable FAQ entry. Deliberately NOT localized at the
// document level: a question is one piece of editorial content whose identity —
// which question this is, and where it sits in the list — is locale-invariant.
// Only the wording varies, so the two prose fields are inline internationalized
// arrays and everything else exists once, the same model as gSizeChart.
//
// Order is NOT a property of the entry either. Which questions belong together
// and in what order lives in gFaqList — a named set — and pages point at a set
// rather than curating their own list, so an entry can sit in different places
// on different pages without a number to keep in sync.
export const gFaq = defineType({
	title: 'FAQ',
	name: 'gFaq',
	type: 'document',
	icon: HelpCircleIcon,
	fields: [
		defineField({
			name: 'question',
			title: 'Question',
			type: 'internationalizedArrayString',
			// Not Rule.required(): the plugin mounts an empty `{_key, language}`
			// item for the default language, which satisfies `required` while
			// carrying no text at all.
			validation: (Rule) => Rule.custom(requireSomeValue),
		}),
		defineField({
			name: 'answer',
			title: 'Answer',
			type: 'internationalizedArrayPortableTextSimple',
			validation: (Rule) => Rule.custom(requireSomeValue),
		}),
	],
	preview: {
		select: { question: 'question' },
		prepare({ question }) {
			// Title is explicitly English so the subtitle stays meaningful: when a
			// document has no English wording the Chinese becomes the title, and
			// repeating it underneath would read as a rendering fault rather than
			// "this entry is not translated yet".
			const en = pickValueForLocale(question, 'en');
			const zh = pickValueForLocale(question, 'zh_tw');
			return {
				title: en || zh || 'Untitled question',
				subtitle: en ? zh : undefined,
				media: HelpCircleIcon,
			};
		},
	},
});
