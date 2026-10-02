import { language } from '@/sanity/schemaTypes/objects/language';
import { UserIcon } from '@sanity/icons';
import { defineType } from 'sanity';

// Editable copy for the /account pages. The pages themselves have no document
// (they are per-member and never indexed); this holds only the words a visitor
// reads before signing in. An empty field renders nothing.
export const pAccount = defineType({
	title: 'Account Page',
	name: 'pAccount',
	type: 'document',
	icon: UserIcon,
	fields: [
		language(),
		{
			title: 'Sign-in intro',
			name: 'signInIntro',
			type: 'text',
			rows: 3,
			description: 'Shown under the sign-in heading. Hidden when empty.',
		},
		{
			title: 'Sign-in privacy notice',
			name: 'signInPrivacy',
			type: 'text',
			rows: 5,
			description:
				'Shown under the sign-in form. Hidden when empty. When you change it, ask a developer to bump PRIVACY_NOTICE_VERSION, which records which notice each new member saw.',
		},
	],
	preview: {
		prepare() {
			return { title: 'Account Page' };
		},
	},
});
