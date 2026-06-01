import {
	CogIcon,
	EarthGlobeIcon,
	EnvelopeIcon,
	PackageIcon,
	EnterRightIcon,
} from '@sanity/icons';
import type { StructureBuilder } from 'sanity/structure';
import { colorsMenu } from './colors';

export const settingsMenu = (S: StructureBuilder) => {
	return S.listItem()
		.title('Settings')
		.child(
			S.list()
				.title('Settings')
				.items([
					S.listItem()
						.title('General')
						.child(
							S.editor()
								.id('settingsGeneral')
								.schemaType('settingsGeneral')
								.documentId('settingsGeneral')
						)
						.icon(EarthGlobeIcon),
					colorsMenu(S),
					S.listItem()
						.title('Integrations')
						.child(
							S.editor()
								.id('settingsIntegration')
								.schemaType('settingsIntegration')
								.documentId('settingsIntegration')
						)
						.icon(PackageIcon),
					S.listItem()
						.title('Redirects')
						.child(S.documentTypeList('settingsRedirect').title('Redirects'))
						.icon(EnterRightIcon),
					S.listItem()
						.title('Newsletter')
						.child(
							S.editor()
								.id('gNewsletter')
								.schemaType('gNewsletter')
								.documentId('gNewsletter')
						)
						.icon(EnvelopeIcon),
				])
		)
		.icon(CogIcon);
};
