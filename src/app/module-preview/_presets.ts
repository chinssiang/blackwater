/**
 * Sample data for each page-module type, per locale, in the shape its GROQ
 * fragment in `pageModuleFields` (src/sanity/lib/queries.ts) projects — what
 * the Studio's picker cards render through `/module-preview/{locale}/{type}`,
 * which adds `_type`. Per locale because the page's own strings (event rows,
 * product labels) follow the document's language, and English sample copy
 * beside them would misrepresent a zh_tw page.
 *
 * Pure data, no Sanity asset refs: the hero has no background and the product
 * cards carry no image, so every preview renders on any dataset. The hero is
 * deliberately NOT the wave: HeroWave is a per-pixel CPU shader, the iframe's
 * viewport never scrolls it out of view to pause it, and a same-origin frame
 * shares the Studio's main thread — so it would run at 60fps behind the dialog
 * for a 280px thumbnail.
 *
 * Two modules still read live data by design, since the preset only supplies
 * the module's own fields:
 * - `eventsBlock` fetches its own upcoming events, so its card shows the
 *   dataset's real events and is blank when there are none.
 * - `productsBlock` asks Shopify for live prices; these cards carry no
 *   `shopifyHandle`, so none resolve, the manual `price` stands, and no
 *   quick-add control renders (it needs the site's CartProvider).
 *
 * page-module.test.ts fails when a `pageModules` member has no entry here.
 */
import { type Locale, localizePath } from '@/lib/i18n';
import type { SectionAppearance } from '@/lib/section-appearance';

const block = (key: string, text: string, style = 'normal') => ({
	_type: 'block',
	_key: key,
	style,
	markDefs: [],
	children: [{ _type: 'span', _key: `${key}-span`, text, marks: [] }],
});

// What the schema's `initialValue` gives a freshly added module.
const sectionAppearance = {
	maxWidth: 'none',
	textAlign: 'text-left',
	spacingTop: 9,
	spacingTopDesktop: 16,
	spacingBottom: 9,
	spacingBottomDesktop: 16,
} satisfies SectionAppearance;

const PRICES = ['NT$1,280', 'NT$880', 'NT$1,080'];

const COPY = {
	en: {
		heroEyebrow: 'Taipei running club',
		heroHeading: 'Run the city after dark',
		heroParagraph:
			'Weekly group runs, long runs on the weekend, and a crew to share the road with.',
		heroCta: 'See upcoming runs',
		freeformHeading: 'About the club',
		freeformParagraphs: [
			'Freeform is rich text: headings, paragraphs, lists, links and images, laid out in the order you write them.',
			'Use it for anything that does not need a dedicated module, such as an introduction, a route description or a club announcement.',
		],
		faqHeading: 'Frequently asked questions',
		faq: [
			['Do I need to be fast to join?', 'No. Every run has pace groups.'],
			['Where do runs start?', 'Each event lists its meeting point.'],
			['Is there a membership fee?', 'Group runs are free to attend.'],
		],
		eventsHeading: 'Upcoming events',
		productsHeading: 'Products',
		products: ['Club singlet', 'Night run cap', 'Crew tee'],
	},
	zh_tw: {
		heroEyebrow: '台北跑團',
		heroHeading: '在夜色中跑遍城市',
		heroParagraph: '每週團跑、週末長距離，還有一群一起上路的夥伴。',
		heroCta: '查看近期活動',
		freeformHeading: '關於跑團',
		freeformParagraphs: [
			'自由內容是富文本：標題、段落、清單、連結與圖片，依你撰寫的順序排列。',
			'適合不需要專屬模組的內容，例如介紹、路線說明或跑團公告。',
		],
		faqHeading: '常見問題',
		faq: [
			['需要跑很快才能加入嗎？', '不用，每次團跑都有不同配速組。'],
			['集合地點在哪裡？', '每場活動都會標示集合地點。'],
			['需要繳會費嗎？', '團跑免費參加。'],
		],
		eventsHeading: '近期活動',
		productsHeading: '商品',
		products: ['跑團背心', '夜跑帽', '團隊 T 恤'],
	},
} satisfies Record<Locale, unknown>;

const presetsFor = (locale: Locale) => {
	const c = COPY[locale];
	return {
		heroBlock: {
			sectionAppearance,
			eyebrow: c.heroEyebrow,
			heading: c.heroHeading,
			paragraph: [block('hero-p', c.heroParagraph)],
			callToAction: {
				label: c.heroCta,
				link: { href: localizePath('/events', locale), isNewTab: false },
			},
		},
		freeform: {
			sectionAppearance,
			content: [
				block('freeform-h', c.freeformHeading, 'h2'),
				...c.freeformParagraphs.map((text, i) => block(`freeform-p${i}`, text)),
			],
		},
		faqBlock: {
			sectionAppearance,
			heading: c.faqHeading,
			items: c.faq.map(([question, answer], i) => ({
				question,
				answer: [block(`faq-a${i}`, answer)],
			})),
		},
		eventsBlock: {
			sectionAppearance,
			heading: c.eventsHeading,
			limit: 4,
		},
		productsBlock: {
			sectionAppearance,
			heading: c.productsHeading,
			// Three, not the module's default four: the frame is 1280px wide, where
			// the grid runs three columns, so a fourth card wraps out of the card.
			limit: 3,
			products: c.products.map((title, i) => ({
				_id: `preview-product-${i}`,
				title,
				price: PRICES[i],
				brands: [{ _id: 'preview-brand', title: 'Blackwater' }],
			})),
		},
	};
};

export const MODULE_PREVIEWS = {
	en: presetsFor('en'),
	zh_tw: presetsFor('zh_tw'),
} satisfies Record<Locale, unknown>;

export type ModuleType = keyof (typeof MODULE_PREVIEWS)['en'];

export function isModuleType(type: string): type is ModuleType {
	return Object.hasOwn(MODULE_PREVIEWS.en, type);
}
