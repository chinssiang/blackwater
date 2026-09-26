import { describe, expect, it } from 'vitest';
import { createDynamicResolver } from '@/components/CustomForm';

type Field = Parameters<typeof createDynamicResolver>[0][number];

// Runs the resolver the way react-hook-form does and returns each field's
// message, so a test reads as "what the visitor would see".
async function validate(fields: Field[], values: Record<string, string>) {
	const resolver = createDynamicResolver(fields);
	const { errors } = await resolver(values, undefined, {
		fields: {},
		shouldUseNativeValidation: false,
	});
	return Object.fromEntries(
		Object.entries(errors).map(([name, error]) => [name, error?.message])
	);
}

const field = (overrides: Partial<Field>): Field => ({
	_key: 'k',
	fieldName: 'f',
	fieldLabel: 'F',
	...overrides,
});

describe('createDynamicResolver', () => {
	it('reports a required email left empty as required, not as a bad format', async () => {
		const errors = await validate(
			[field({ inputType: 'email', required: true })],
			{ f: '' }
		);
		expect(errors.f).toBe('This field is required');
	});

	it('accepts an optional email left empty', async () => {
		const errors = await validate([field({ inputType: 'email' })], { f: '' });
		expect(errors).toEqual({});
	});

	it('still rejects an optional email that is filled in wrongly', async () => {
		const errors = await validate([field({ inputType: 'email' })], {
			f: 'nope',
		});
		expect(errors.f).toBe('Invalid email format');
	});

	it('accepts an optional phone left empty', async () => {
		const errors = await validate([field({ inputType: 'tel' })], { f: '' });
		expect(errors).toEqual({});
	});

	it('keeps the required message on a field that also has a minLength', async () => {
		const errors = await validate([field({ required: true, minLength: 5 })], {
			f: '',
		});
		expect(errors.f).toBe('This field is required');
	});

	it('applies minLength to a filled-in value', async () => {
		const errors = await validate([field({ required: true, minLength: 5 })], {
			f: 'abc',
		});
		expect(errors.f).toBe('Must be at least 5 characters');
	});
});
