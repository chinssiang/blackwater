import { describe, expect, it } from 'vitest';
import defineFaqJsonLd, { collectFaqItems } from './defineFaqJsonLd';

describe('collectFaqItems', () => {
	it('flattens items across all faqList modules', () => {
		const items = collectFaqItems([
			{ _type: 'faqList', items: [{ question: 'Q1', answerText: 'A1' }] },
			{ _type: 'freeform' } as any,
			{
				_type: 'faqList',
				items: [
					{ question: 'Q2', answerText: 'A2' },
					{ question: 'Q3', answerText: 'A3' },
				],
			},
		]);
		expect(items.map((i) => i.question)).toEqual(['Q1', 'Q2', 'Q3']);
	});

	it('returns an empty array for non-array or empty input', () => {
		expect(collectFaqItems(null)).toEqual([]);
		expect(collectFaqItems(undefined)).toEqual([]);
		expect(collectFaqItems([{ _type: 'faqList' }])).toEqual([]);
	});
});

describe('defineFaqJsonLd', () => {
	it('returns null when there are no usable items', () => {
		expect(defineFaqJsonLd(null)).toBeNull();
		expect(defineFaqJsonLd([])).toBeNull();
		// Items missing a question or answer are dropped.
		expect(defineFaqJsonLd([{ question: 'Q', answerText: '  ' }])).toBeNull();
	});

	it('builds a FAQPage with trimmed Question/Answer entries', () => {
		const ld = defineFaqJsonLd([
			{ question: '  What? ', answerText: '  Yes. ' },
			{ question: 'No answer', answerText: null },
			{ question: 'Second', answerText: 'Answer two' },
		]);
		expect(ld).toMatchObject({
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
		});
		const entities = (ld as { mainEntity: any[] }).mainEntity;
		expect(entities).toHaveLength(2);
		expect(entities[0]).toEqual({
			'@type': 'Question',
			name: 'What?',
			acceptedAnswer: { '@type': 'Answer', text: 'Yes.' },
		});
	});
});
