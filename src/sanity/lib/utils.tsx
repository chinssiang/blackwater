import type { PortableTextBlock } from '@portabletext/types';

export const getPortableTextPreview = (content: PortableTextBlock[]) => {
	if (!content) {
		return 'Empty';
	}

	const contentWithText = content.filter(
		(el) => el._type == 'block' && el?.children[0]?.text !== ''
	);
	const contentWithIframe = content.filter((el) => el._type == 'iframe');
	const contentWithImageAlt = content.filter(
		(el) => el._type == 'image' && (el as any).alt
	);

	const contentWithImage = content.filter((el) => el._type == 'image');
	const contentWithTable = content.filter((el) => el._type == 'portableTable');
	if (contentWithText && contentWithText[0]) {
		const textChildren = contentWithText[0]?.children;
		if (!Array.isArray(textChildren)) {
			return '';
		}

		if (textChildren.length === 1) {
			return textChildren[0]?.text || '';
		}
		return textChildren.map((item) => item?.text || '').join('');
	}

	if (contentWithIframe && contentWithIframe[0]) {
		const { embedSnippet } = (contentWithIframe[0] as any) || '';
		const regex = /<iframe.*?src=['"](.*?)['"]/;

		const getUrl = (embedSnippet: any) => {
			const match = regex.exec(embedSnippet);
			if (!match) return '';
			const url = match[1];
			if (url.includes('youtube.com') || url.includes('youtu.be')) {
				return 'youtube.com';
			}
			if (url.includes('vimeo.com')) {
				return 'vimeo.com';
			}
			return url;
		};

		return `Iframe Embed: ${getUrl(embedSnippet)}`;
	}

	if (contentWithImageAlt && contentWithImageAlt[0]) {
		return (contentWithImageAlt[0] as any).alt;
	}

	// with image but no alt, show "image"
	if (contentWithImage && contentWithImage[0]) {
		return `Image${contentWithImage.length > 1 ? 's' : ''}`;
	}

	if (contentWithTable) {
		return `Table${contentWithTable.length > 1 ? 's' : ''}`;
	}
	return 'Empty';
};

export const getSwatch = (color: string) => {
	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				backgroundColor: color,
			}}
		></div>
	);
};
