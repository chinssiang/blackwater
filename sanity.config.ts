'use client';

import { defaultDocumentNode } from '@/sanity/defaultDocumentNode';
import { apiVersion, dataset, projectId } from '@/sanity/env';
import * as presentationResolver from '@/sanity/lib/presentation-resolver';
import { schemaTypes } from '@/sanity/schemaTypes';
import { gAnnouncement } from '@/sanity/schemaTypes/singletons/g-announcement';
import { gFooter } from '@/sanity/schemaTypes/singletons/g-footer';
import { gHeader } from '@/sanity/schemaTypes/singletons/g-header';
import { p404 } from '@/sanity/schemaTypes/singletons/p-404';
import { pContact } from '@/sanity/schemaTypes/singletons/p-contact';
import { pCuratedIndex } from '@/sanity/schemaTypes/singletons/p-curated-index';
import { pHome } from '@/sanity/schemaTypes/singletons/p-home';
import { settingsGeneral } from '@/sanity/schemaTypes/singletons/settings-general';
import { settingsIntegration } from '@/sanity/schemaTypes/singletons/settings-integrations';
import { structure } from '@/sanity/structure';
import { colorInput } from '@sanity/color-input';
import { visionTool } from '@sanity/vision';
import { LogoSvg } from '@/components/LogoSvg';
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
		languages: [
			{ id: 'en', title: 'English' },
			{ id: 'zh_tw', title: '中文 (繁體)' },
		],
		defaultLanguages: ['en'],
		fieldTypes: ['string', 'text'],
	}),
	presentationTool({
		resolve: presentationResolver,
		previewUrl: {
			origin: process.env.SANITY_STUDIO_PREVIEW_ORIGIN,
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
	pCuratedIndex.name,
	gAnnouncement.name,
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
		// Removes the "duplicate" action on the Singletons (such as Home)
		actions: (prev, { schemaType }) => {
			if (singletonDocuments.includes(schemaType as any)) {
				return prev.filter(({ action }) => action !== 'duplicate');
			}

			return prev;
		},
	},
});
