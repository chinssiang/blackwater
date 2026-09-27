// Script_Extensions, not Script: marks written inside these names, like the
// katakana long-vowel mark ー and the middle dot ・, are Script=Common.
const CJK_ONLY =
	/^[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Hangul}]+$/u;

/**
 * A member's name as one string, in the order its own script writes it: family
 * name first and no space for Chinese, Japanese or Korean (陳小明), given name
 * first otherwise (Hsiang Chin). Decided by the name rather than the page's
 * locale, since either kind of name turns up on either page. Empty when neither
 * part is set. Expects the trimmed values auth.ts saves.
 */
export function formatMemberName(first: string, last: string): string {
	if (!first || !last) return first || last;
	return CJK_ONLY.test(first + last) ? last + first : `${first} ${last}`;
}
