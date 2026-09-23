import { gFaq } from './documents/g-faq';
import { gFaqList } from './documents/g-faq-list';
import { gLocation } from './documents/g-location';
import { gSizeChart } from './documents/g-size-chart';
import { gTag } from './documents/g-tag';
import { gTeamMember } from './documents/g-team-member';
// Documents
import { pBlog } from './documents/p-blog';
import { pBlogCategory } from './documents/p-blog-category';
import { pBlogIndex } from './documents/p-blog-index';
import { pBrand } from './documents/p-brand';
import { pEvent } from './documents/p-event';
import { pEventCategory } from './documents/p-event-category';
import { pEventRole } from './documents/p-event-role';
import { pEventStatus } from './documents/p-event-status';
import { pEvents } from './documents/p-events';
import { pGeneral } from './documents/p-general';
import { pProduct } from './documents/p-product';
import { pProductCategory } from './documents/p-product-category';
import { pProductCollection } from './documents/p-product-collection';
import { editorialBlock } from './objects/editorial-block';
import { eventStation } from './objects/event-station';
import { eventsBlock } from './objects/events-block';
import { faqBlock } from './objects/faq-block';
import { formField } from './objects/form-builder/form-field';
import { freeform } from './objects/freeform';
import { heroBlock } from './objects/hero-block';
import { link } from './objects/link';
import { navDropdown } from './objects/nav-dropdown';
import { navItem } from './objects/nav-item';
import { portableText } from './objects/portable-text';
import { portableTextSimple } from './objects/portable-text-simple';
import { productsBlock } from './objects/products-block';
import { sectionAppearance } from './objects/section-appearance';
import { socialLink } from './objects/social-link';
import { gAnnouncement } from './singletons/g-announcement';
import { gAuthor } from './singletons/g-author';
import { gFooter } from './singletons/g-footer';
import { gHeader } from './singletons/g-header';
import { gMobileMenu } from './singletons/g-mobile-menu';
// Objects
import { gNewsletter } from './singletons/g-newsletter';
import { gToolbar } from './singletons/g-toolbar';
import { p404 } from './singletons/p-404';
import { pContact } from './singletons/p-contact';
import { pFaq } from './singletons/p-faq';
import { pHome } from './singletons/p-home';
import { pNewsletter } from './singletons/p-newsletter';
import { pProductIndex } from './singletons/p-product-index';
import { pSizeGuide } from './singletons/p-size-guide';
// Singletons
import { settingsCart } from './singletons/settings-cart';
import { settingsBrandColors } from './singletons/settings-color';
import { settingsConsent } from './singletons/settings-consent';
import { settingsGeneral } from './singletons/settings-general';
import { settingsIntegration } from './singletons/settings-integrations';
import { settingsMenu } from './singletons/settings-menu';
import { settingsRedirect } from './singletons/settings-redirect';
import { type SchemaTypeDefinition } from 'sanity';

export const schemaTypes: SchemaTypeDefinition[] = [
	settingsGeneral,
	settingsBrandColors,
	settingsMenu,
	settingsRedirect,
	settingsIntegration,
	settingsConsent,
	settingsCart,
	gNewsletter,
	gAnnouncement,
	gHeader,
	gFooter,
	gMobileMenu,
	gToolbar,
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
	gLocation,
	gFaq,
	gFaqList,
	gSizeChart,
	pEventCategory,
	pEvents,
	pEventStatus,
	pContact,
	pFaq,
	pSizeGuide,
	pNewsletter,
	pProductIndex,
	pProduct,
	pProductCategory,
	pProductCollection,
	pBrand,
	gTag,
	eventStation,
	freeform,
	faqBlock,
	eventsBlock,
	heroBlock,
	editorialBlock,
	productsBlock,
	formField,
	link(),
	navDropdown,
	navItem,
	portableText,
	portableTextSimple,
	sectionAppearance,
	socialLink,
];
