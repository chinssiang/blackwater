import en from '@/dictionaries/en.json';

export type Dictionary = typeof en;

export function pickPlural(
	forms: { one: string; other: string },
	count: number
): string {
	return count === 1 ? forms.one : forms.other;
}

export function interpolate(
	template: string,
	vars: Record<string, string | number>
): string {
	return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/**
 * The "today" / "in N days" pill wording, shared by the /events rows and the
 * home-page events strip.
 *
 * Lives here rather than beside `getDaysUntilEvent` in event-date.ts so that
 * module stays free of a dictionary import: it is also pulled in by
 * PageEventSingle, PageEventsCrew and a Studio schema, none of which want
 * en.json in their graph.
 *
 * The zero case is a separate dictionary key, not a plural form, so it cannot
 * be folded into `pickPlural`.
 */
export function formatDaysUntilLabel(
	daysUntil: number,
	t: Dictionary['events']
): string {
	return daysUntil === 0
		? t.status.today
		: interpolate(pickPlural(t.daysUntil, daysUntil), { count: daysUntil });
}
