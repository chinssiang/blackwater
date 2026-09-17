import { dataset, projectId } from '@/sanity/env';
import { createImageUrlBuilder } from '@sanity/image-url';

export const imageBuilder = createImageUrlBuilder({ projectId, dataset });
export const urlForImage = (
	source: Parameters<(typeof imageBuilder)['image']>[0]
) => imageBuilder.image(source);
