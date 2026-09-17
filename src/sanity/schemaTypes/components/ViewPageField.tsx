import { Flex, Stack, Text } from '@sanity/ui';
import { type FieldProps, useFormValue } from 'sanity';

// useFormValue is typed `unknown` by design — the form's shape is only known at
// runtime — so narrow once here rather than casting at each use.
const asString = (value: unknown) =>
	typeof value === 'string' ? value : undefined;

function buildDefaultUrl({
	docType,
	docId,
	slug,
	lang,
}: {
	docType?: string;
	docId?: string;
	slug?: string;
	lang?: string;
}) {
	const host = window.location.host;
	const baseUrl = host.includes('localhost:')
		? `http://${host}`
		: `https://${host}`;
	const params = new URLSearchParams({
		documentType: docType ?? '',
		docId: docId ?? '',
	});
	if (slug) params.set('slug', slug);
	if (lang) params.set('lang', lang);
	return `${baseUrl}/api/view-page?${params.toString()}`;
}

export const ViewPageField = (props: FieldProps) => {
	const { children, title, description, schemaType } = props;
	const customUrl = schemaType?.options?.viewPageUrl;

	const docType = asString(useFormValue(['_type']));
	const docId = asString(useFormValue(['_id']));
	const slugCurrent = asString(useFormValue(['slug', 'current']));
	const language = asString(useFormValue(['language']));

	const pageUrl =
		customUrl ||
		buildDefaultUrl({ docType, docId, slug: slugCurrent, lang: language });

	return (
		<Stack space={3}>
			<Stack space={2}>
				<Flex align="center" gap={3}>
					<Text size={1} weight="semibold" style={{ flex: 1 }}>
						{title}
					</Text>
					<Text size={1} weight="semibold">
						<a href={pageUrl} target="_blank" rel="noreferrer">
							View page
						</a>
					</Text>
				</Flex>
				{description && (
					<Text size={1} muted>
						{description}
					</Text>
				)}
			</Stack>
			{children}
		</Stack>
	);
};
