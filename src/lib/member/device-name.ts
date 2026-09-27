// First match wins, so the browsers that also claim to be Chrome or Safari
// come before them: Edge, Opera and Samsung all say "Chrome", and every iOS
// browser says "Safari". LINE and Instagram are here because a Taiwanese
// member opening a link from either lands in its in-app browser.
const BROWSERS: [RegExp, string][] = [
	[/\bLine\//, 'LINE'],
	[/Instagram/, 'Instagram'],
	[/\bEdg(e|A|iOS)?\//, 'Edge'],
	[/\bOPR\/|Opera/, 'Opera'],
	[/SamsungBrowser/, 'Samsung Internet'],
	[/\bCriOS\/|\bChrome\//, 'Chrome'],
	[/\bFxiOS\/|\bFirefox\//, 'Firefox'],
	[/\bSafari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
	[/iPhone/, 'iPhone'],
	[/iPad/, 'iPad'],
	[/Android/, 'Android'],
	[/Macintosh|Mac OS X/, 'Mac'],
	[/Windows/, 'Windows'],
	[/CrOS/, 'ChromeOS'],
	[/Linux/, 'Linux'],
];

const find = (list: [RegExp, string][], ua: string) =>
	list.find(([pattern]) => pattern.test(ua))?.[1];

/** A signed-in session's user agent as "Safari on iPhone", or '' when neither
 *  part is recognised. Names are the products' own, the same in every
 *  language, which is why this needs no dictionary. */
export function describeDevice(userAgent: string): string {
	const browser = find(BROWSERS, userAgent);
	const system = find(SYSTEMS, userAgent);
	if (browser && system) return `${browser} · ${system}`;
	return browser ?? system ?? '';
}
