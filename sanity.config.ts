'use client';

import { richDate } from '@sanity/rich-date-input';
import { defaultDocumentNode } from '@/sanity/defaultDocumentNode';
import { apiVersion, dataset, projectId } from '@/sanity/env';
import * as presentationResolver from '@/sanity/lib/presentation-resolver';
import { schemaTypes } from '@/sanity/schemaTypes';
import {
	TRANSLATABLE_TYPES,
	FIELD_LEVEL_I18N_TYPES,
} from '@/sanity/i18n-types';
import { gAnnouncement } from '@/sanity/schemaTypes/singletons/g-announcement';
import { gNewsletter } from '@/sanity/schemaTypes/singletons/g-newsletter';
import { gFooter } from '@/sanity/schemaTypes/singletons/g-footer';
import { gHeader } from '@/sanity/schemaTypes/singletons/g-header';
import { gMobileMenu } from '@/sanity/schemaTypes/singletons/g-mobile-menu';
import { gToolbar } from '@/sanity/schemaTypes/singletons/g-toolbar';
import { p404 } from '@/sanity/schemaTypes/singletons/p-404';
import { pContact } from '@/sanity/schemaTypes/singletons/p-contact';
import { pFaq } from '@/sanity/schemaTypes/singletons/p-faq';
import { pSizeGuide } from '@/sanity/schemaTypes/singletons/p-size-guide';
import { pNewsletter } from '@/sanity/schemaTypes/singletons/p-newsletter';
import { pProductIndex } from '@/sanity/schemaTypes/singletons/p-product-index';
import { pHome } from '@/sanity/schemaTypes/singletons/p-home';
import { settingsCart } from '@/sanity/schemaTypes/singletons/settings-cart';
import { settingsConsent } from '@/sanity/schemaTypes/singletons/settings-consent';
import { settingsGeneral } from '@/sanity/schemaTypes/singletons/settings-general';
import { settingsIntegration } from '@/sanity/schemaTypes/singletons/settings-integrations';
import { structure } from '@/sanity/structure';
import { colorInput } from '@sanity/color-input';
import { documentInternationalization } from '@sanity/document-internationalization';
import { visionTool } from '@sanity/vision';
import { WordmarkSvg } from '@/components/WordmarkSvg';
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
		// 'portableTextSimple' and 'portableText' are registered alias types
		// (objects/portable-text-simple.ts, objects/portable-text.tsx), which is
		// what the plugin requires for non-primitive members. They generate
		// internationalizedArrayPortableTextSimple — the product family's
		// rich-text fields — and internationalizedArrayPortableText, used by
		// pEvent.content. The plugin builds both wrapper types generically from
		// whatever named type it is handed, so the full portableText (headings,
		// lists, images, iframes, CTA annotations) survives the wrapping intact;
		// events keep the richer editor rather than being downgraded to simple.
		fieldTypes: ['string', 'text', 'portableTextSimple', 'portableText'],
		// Hide the plugin's "Add missing languages" button: combined with the
		// language filter below it is a trap. The plugin decides whether to show
		// it with checkAllLanguagesArePresent(filteredLanguages, value), which
		// compares the *unfiltered* item count against the *filtered* language
		// count — so on a field that already has en + zh_tw, with only en shown,
		// 2 !== 1 reads as "a language is missing" and the button appears. Its
		// click handler only ever adds languages that are currently *visible*,
		// so it adds nothing and the editor sees a dead button. (Upstream bug,
		// still present in 5.1.27.) The per-language "en"/"zh_tw" chips beside it
		// are unaffected — they add a language in one click, same as this button
		// did whenever it actually worked.
		buttonAddAll: false,
		// Field-level localized types (one document, all languages) would
		// otherwise show an editor every field twice. The built-in
		// @sanity/language-filter integration restores the one-language-at-a-time
		// view the document-level types get from their language dropdown.
		// Derived, not hand-listed, so a new field-level type can't be forgotten.
		languageFilter: {
			documentTypes: [...FIELD_LEVEL_I18N_TYPES],
		},
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
	richDate(),
];
const singletonDocuments = [
	gFooter.name,
	gHeader.name,
	gMobileMenu.name,
	gToolbar.name,
	pHome.name,
	settingsIntegration.name,
	settingsConsent.name,
	settingsGeneral.name,
	settingsCart.name,
	p404.name,
	pContact.name,
	pFaq.name,
	pSizeGuide.name,
	pNewsletter.name,
	pProductIndex.name,
	gAnnouncement.name,
	gNewsletter.name,
];

export default defineConfig({
	basePath: '/sanity',
	title: 'Blackwater RC',
	icon: WordmarkSvg,
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
