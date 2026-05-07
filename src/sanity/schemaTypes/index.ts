import { type SchemaTypeDefinition } from 'sanity';
// Documents
import { pBlog } from './documents/p-blog';
import { pCurated } from './documents/p-curated';
import { pCuratedCategory } from './documents/p-curated-category';
import { pCuratedCollection } from './documents/p-curated-collection';
import { pBlogCategory } from './documents/p-blog-category';
import { pBlogIndex } from './documents/p-blog-index';
import { gTeamMember } from './documents/g-team-member';
import { pEvent } from './documents/p-event';
import { pEventCategory } from './documents/p-event-category';
import { pEventRole } from './documents/p-event-role';
import { pEvents } from './documents/p-events';
import { pEventStatus } from './documents/p-event-status';
import { pGeneral } from './documents/p-general';
import { pBrand } from './documents/p-brand';
// Objects
import { formField } from './objects/form-builder/form-field';
import { link } from './objects/link';
import { linkInput } from './objects/link-input';
import { navDropdown } from './objects/nav-dropdown';
import { navItem } from './objects/nav-item';
import { portableText } from './objects/portable-text';
import { portableTextSimple } from './objects/portable-text-simple';
import { sectionAppearance } from './objects/section-appearance';
import { socialLink } from './objects/social-link';
import { gAnnouncement } from './singletons/g-announcement';
import { eventStation } from './objects/event-station';
import { freeform } from './objects/freeform';
import { gAuthor } from './singletons/g-author';
import { gFooter } from './singletons/g-footer';
import { gHeader } from './singletons/g-header';
import { p404 } from './singletons/p-404';
import { pContact } from './singletons/p-contact';
import { pCuratedIndex } from './singletons/p-curated-index';
import { pHome } from './singletons/p-home';
// Singletons
import { settingsBrandColors } from './singletons/settings-color';
import { settingsGeneral } from './singletons/settings-general';
import { settingsIntegration } from './singletons/settings-integrations';
import { settingsMenu } from './singletons/settings-menu';
import { settingsRedirect } from './singletons/settings-redirect';

export const schemaTypes: SchemaTypeDefinition[] = [
	settingsGeneral,
	settingsBrandColors,
	settingsMenu,
	settingsRedirect,
	settingsIntegration,

	gAnnouncement,
	gHeader,
	gFooter,
	pGeneral,
	p404,
	pHome,
	pBlogIndex,
	pBlog,
	pBlogCategory,
	pEvent,
	pEventRole,
	gAuthor,
	gTeamMember,
	pEventCategory,
	pEvents,
	pEventStatus,
	pContact,
	pCuratedIndex,
	pCurated,
	pCuratedCategory,
	pCuratedCollection,
	pBrand,
	eventStation,
	freeform,
	formField,
	link(),
	linkInput,
	navDropdown,
	navItem,
	portableText,
	portableTextSimple,
	sectionAppearance,
	socialLink,
];
