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
