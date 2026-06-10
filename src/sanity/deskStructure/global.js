import {
	ComponentIcon,
	EnvelopeIcon,
	HelpCircleIcon,
	MenuIcon,
} from '@sanity/icons';
import { apiVersion } from '@/sanity/env';

export const globalMenu = (S) => {
	return S.listItem()
		.title('Global Modules')
		.child(
			S.list()
				.title('Global Modules')
				.items([
					S.listItem()
						.title('Announcement')
						.child(
							S.editor()
								.id('gAnnouncement')
								.schemaType('gAnnouncement')
								.documentId('gAnnouncement')
						)
						.icon(ComponentIcon),
					S.listItem()
						.title('Header')
						.child(
							S.editor()
								.id('gHeader')
								.schemaType('gHeader')
								.documentId('gHeader')
						)
						.icon(ComponentIcon),
					S.listItem()
						.title('Footer')
						.child(
							S.editor()
								.id('gFooter')
								.schemaType('gFooter')
								.documentId('gFooter')
						)
						.icon(ComponentIcon),
					S.listItem()
						.title('Mobile Menu')
						.child(
							S.editor()
								.id('gMobileMenu')
								.schemaType('gMobileMenu')
								.documentId('gMobileMenu')
						)
						.icon(MenuIcon),
					S.listItem()
						.title('Toolbar')
						.child(
							S.editor()
								.id('gToolbar')
								.schemaType('gToolbar')
								.documentId('gToolbar')
						)
						.icon(ComponentIcon),
					S.listItem()
						.title('FAQ')
						.child(
							S.documentTypeList('gFaq')
								.title('FAQ')
								.filter(`_type == "gFaq"`)
								.apiVersion(apiVersion)
								.child((documentId) =>
									S.document().documentId(documentId).schemaType('gFaq')
								)
								.canHandleIntent(
									(intent, { type }) =>
										['create', 'edit'].includes(intent) && type === 'gFaq'
								)
						)
						.icon(HelpCircleIcon),
				])
		)
		.icon(ComponentIcon);
};
