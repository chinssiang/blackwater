import { enUS, zhTW } from 'date-fns/locale';
import type { Locale } from '@/lib/i18n';

/**
 * App locale → date-fns locale.
 *
 * A leaf module on purpose, and deliberately NOT part of `@/lib/i18n`: that
 * module is imported almost everywhere (including `proxy.ts` and Sanity schema
 * files), so putting these imports there would pull both date-fns locale
 * bundles into every consumer's graph — the opposite of what
 * `LocationCurrentTimeLazy` is for. Only modules that already use date-fns
 * import this.
 *
 * `satisfies` rather than `as const`: it keeps the precise value types while
 * still failing the build if a locale is added to `LOCALES` without a mapping.
 */
export const DATE_FNS_LOCALES = {
	en: enUS,
	zh_tw: zhTW,
} satisfies Record<Locale, unknown>;
