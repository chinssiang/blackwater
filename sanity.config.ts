'use client';

import { defaultDocumentNode } from '@/sanity/defaultDocumentNode';
import { apiVersion, dataset, projectId } from '@/sanity/env';
import * as presentationResolver from '@/sanity/lib/presentation-resolver';
import { schemaTypes } from '@/sanity/schemaTypes';
import { TRANSLATABLE_TYPES } from '@/sanity/i18n-types';
import { gAnnouncement } from '@/sanity/schemaTypes/singletons/g-announcement';
import { gNewsletter } from '@/sanity/schemaTypes/singletons/g-newsletter';
import { gFooter } from '@/sanity/schemaTypes/singletons/g-footer';
import { gHeader } from '@/sanity/schemaTypes/singletons/g-header';
import { p404 } from '@/sanity/schemaTypes/singletons/p-404';
import { pContact } from '@/sanity/schemaTypes/singletons/p-contact';
import { pFaq } from '@/sanity/schemaTypes/singletons/p-faq';
import { pProductIndex } from '@/sanity/schemaTypes/singletons/p-product-index';
import { pHome } from '@/sanity/schemaTypes/singletons/p-home';
import { settingsGeneral } from '@/sanity/schemaTypes/singletons/settings-general';
import { settingsIntegration } from '@/sanity/schemaTypes/singletons/settings-integrations';
import { structure } from '@/sanity/structure';
import { colorInput } from '@sanity/color-input';
import { documentInternationalization } from '@sanity/document-internationalization';
import { visionTool } from '@sanity/vision';
import { LogoSvg } from '@/components/LogoSvg';
import { SANITY_LANGUAGES } from '@/lib/i18n';
import { defineConfig, isDev } from 'sanity';
import { media } from 'sanity-plugin-media';
import { noteField } from 'sanity-plugin-note-field';
import { internationalizedArray } from 'sanity-plugin-internationalized-array';
import { presentationTool } from 'sanity/presentation';
import { structureTool } from 'sanity/structure';

const commonPlugins = [
	structureTool({
		structure,
		defaultDocumentNode,
	}),
	media(),
	colorInput(),
	noteField(),
	internationalizedArray({
		languages: SANITY_LANGUAGES,
		defaultLanguages: ['en'],
		fieldTypes: ['string', 'text'],
	}),
	documentInternationalization({
		supportedLanguages: SANITY_LANGUAGES,
		schemaTypes: [...TRANSLATABLE_TYPES],
		languageField: 'language',
	}),
	presentationTool({
		resolve: presentationResolver,
		previewUrl: {
			origin: process.env.SITE_URL,
			previewMode: {
				enable: '/api/draft-mode/enable',
			},
		},
	}),
	visionTool({ defaultApiVersion: apiVersion }),
];
const singletonDocuments = [
	gFooter.name,
	gHeader.name,
	pHome.name,
	settingsIntegration.name,
	settingsGeneral.name,
	p404.name,
	pContact.name,
	pFaq.name,
	pProductIndex.name,
	gAnnouncement.name,
	gNewsletter.name,
];

export default defineConfig({
	basePath: '/sanity',
	title: 'Blackwater RC',
	icon: LogoSvg,
	projectId,
	dataset,
	plugins: commonPlugins,
	schema: {
		types: schemaTypes,
	},
	tools: (prev, { currentUser }) => {
		const isAdmin = currentUser?.roles.some(
			(role) => role.name === 'administrator'
		);

		const isDeveloper = currentUser?.roles.some(
			(role) => role.name === 'developer'
		);

		if (isDeveloper || isAdmin) {
			return prev;
		}

		return prev.filter((tool) => tool.name !== 'vision');
	},
	document: {
		// Hide 'Singletons (such as Home)' from new document options
		newDocumentOptions: (prev, { creationContext }) => {
			if (creationContext.type === 'global') {
				return prev.filter(
					(templateItem) =>
						!singletonDocuments.includes(templateItem.templateId as any)
				);
			}

			return prev;
		},
		// Removes the "duplicate" action on the Singletons (such as Home).
		// schemaType is the doc type (e.g. "pHome"), not the translation id,
		// so this correctly blocks duplicating both the original and its i18n siblings.
		actions: (prev, { schemaType }) => {
			if (singletonDocuments.includes(schemaType as any)) {
				return prev.filter(({ action }) => action !== 'duplicate');
			}

			return prev;
		},
	},
});
