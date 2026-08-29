import { HelpCircleIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

// A named, reusable, ordered set of FAQ entries.
//
// The list of questions is a document of its own for the same reason gFaq is not
// document-localized: which questions belong together, and in what order, is the
// same fact in every language. Holding that list inline on pFaq and on each
// faqBlock module meant one copy per page PER LOCALE, so the identical set was
// retyped and drifted — the two prod FAQ pages ended up with the same fifteen
// questions in different orders.
//
// Referenced by pFaq (the /faq page) and by the faqBlock page module, so one set
// can appear in several places and a page that needs a different selection points
// at a different set instead of curating its own.
//
// This is the second instance of an existing house pattern, not a new one:
// settingsMenu is the same shape — a named, non-localized document holding an
// ordered array, pointed at by a per-locale reference from gHeader, gFooter and
// gToolbar, with the localized text living inline on the members.
export const gFaqList = defineType({
	title: 'FAQ Set',
	name: 'gFaqList',
	type: 'document',
	icon: HelpCircleIcon,
	fields: [
		// A plain string, deliberately: this names the set for editors picking it
		// in the Studio and is never rendered on the site, so it has no locale.
		// Section headings ARE rendered and stay on the faqBlock module, per page.
		defineField({
			name: 'title',
			title: 'Name',
			type: 'string',
			description:
				'Internal label for picking this set, e.g. "All questions" or "Homepage highlights". Not shown on the site.',
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'questions',
			title: 'Questions',
			description:
				'The questions in this set, in this order. Entries are managed in Global → FAQ; an entry not listed in any set appears nowhere.',
			type: 'array',
			of: [defineArrayMember({ type: 'reference', to: [{ type: 'gFaq' }] })],
			// unique() is load-bearing, not tidiness: FaqBlock keys each accordion
			// item by the entry's _id, so the same entry listed twice yields two
			// items sharing one value and both panels open together.
			validation: (Rule) => [Rule.required().min(1), Rule.unique()],
		}),
	],
	preview: {
		select: { title: 'title', questions: 'questions' },
		prepare({ title, questions }) {
			const count = Array.isArray(questions) ? questions.length : 0;
			return {
				title: title || 'Untitled set',
				subtitle: `${count} question${count === 1 ? '' : 's'}`,
				media: HelpCircleIcon,
			};
		},
	},
});
