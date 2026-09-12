/**
 * Shared by scripts/merge-faq-i18n.mjs and scripts/create-faq-sets.mjs, which are
 * a declared pair — the second refuses to run before the first.
 *
 * Both print a per-locale list of questions for the operator to read before
 * --execute, and both have to cope with either shape a `question` can be in: a
 * pre-merge plain string, or a merged i18n array ([{language, value}]).
 *
 * `language` is preferred over array order because the printout is per-locale: an
 * entry translated only into zh_tw would otherwise print its Chinese wording in
 * the English list, showing the operator text that will not appear on the page
 * they are checking. Falls back to any value so a half-translated entry still
 * prints something identifiable.
 */
export function faqPreview(question, language, maxLength = 60) {
	const raw = Array.isArray(question)
		? (
				question.find((entry) => entry?.language === language && entry?.value) ??
				question.find((entry) => entry?.value)
			)?.value
		: question;
	return (
		String(raw ?? '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, maxLength) || '(no question)'
	);
}
