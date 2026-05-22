import { Flex, Stack, Text } from '@sanity/ui';
import { useFormValue } from 'sanity';

function buildDefaultUrl({ docType, docId, slug }) {
	const host = window.location.host;
	const baseUrl = host.includes('localhost:') ? `http://${host}` : `https://${host}`;
	const params = new URLSearchParams({ documentType: docType ?? '', docId: docId ?? '' });
	if (slug) params.set('slug', slug);
	return `${baseUrl}/api/view-page?${params.toString()}`;
}

export const ViewPageField = (props) => {
	const { children, title, description, schemaType } = props;
	const customUrl = schemaType?.options?.viewPageUrl;

	const docType = useFormValue(['_type']);
	const docId = useFormValue(['_id']);
	const slugCurrent = useFormValue(['slug', 'current']);

	const pageUrl = customUrl || buildDefaultUrl({ docType, docId, slug: slugCurrent });

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
