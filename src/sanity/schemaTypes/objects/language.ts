import { defineField } from 'sanity';

export function language() {
	return defineField({
		name: 'language',
		type: 'string',
		readOnly: true,
		hidden: true,
		initialValue: 'en',
	});
}
