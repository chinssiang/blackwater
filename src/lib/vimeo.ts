import { stegaClean } from '@sanity/client/stega';

// Turns whatever Vimeo URL an editor pastes into the player URL the editorial
// module's video dialog embeds, or null when it is not one we can embed.
//
// One function for both sides: editorial-block.ts validates `vimeoUrl` through
// it and EditorialBlock renders through it, so a URL the Studio accepts is
// exactly a URL the page can play.
//
// `autoplay=1` because the dialog only mounts the player after a click on the
// CTA, so playback starting is the whole point of that click. `dnt=1` stops
// Vimeo setting its session and analytics cookies, which is what lets the
// player load without going through the consent gate.

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com']);
const PLAYER_HOST = 'player.vimeo.com';
const VIDEO_ID = /^\d+$/;
// The privacy hash of an unlisted video, which is hex. Hex rather than any
// alphanumeric because a word can follow the id too (/manage/videos/{id}/settings).
const PRIVACY_HASH = /^[0-9a-f]+$/i;
// Pages that hold many videos: with no `video/{id}` in the path, their number is
// the collection's, not a video's.
const COLLECTIONS = new Set(['showcase', 'album']);

export function toVimeoEmbedUrl(
	value: string | null | undefined
): string | null {
	// Cleaned before parsing: draft mode can append invisible stega characters
	// to a string field, and they would land in the last path segment.
	const raw = stegaClean(value)?.trim();
	if (!raw) return null;

	let url: URL;
	try {
		// A pasted link often has no scheme (`vimeo.com/123`). One that names a
		// different scheme is left for the protocol check below to reject.
		url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:') return null;

	const segments = url.pathname.split('/').filter(Boolean);
	let id: string | undefined;
	let hash: string | undefined;

	if (VIMEO_HOSTS.has(url.hostname)) {
		// The id follows `video`/`videos` on a manage, group or showcase page
		// (vimeo.com/manage/videos/{id}); otherwise it is the first number in the
		// path (vimeo.com/{id}, vimeo.com/channels/{name}/{id}). An unlisted
		// video's hash is the segment after it (vimeo.com/{id}/{hash}).
		const afterVideo = segments.findIndex(
			(segment, i) =>
				VIDEO_ID.test(segment) && /^videos?$/.test(segments[i - 1] ?? '')
		);
		const index =
			afterVideo !== -1
				? afterVideo
				: COLLECTIONS.has(segments[0])
					? -1
					: segments.findIndex((segment) => VIDEO_ID.test(segment));
		id = segments[index];
		hash = segments[index + 1];
	} else if (url.hostname === PLAYER_HOST && segments[0] === 'video') {
		// player.vimeo.com/video/{id}?h={hash}
		id = segments[1];
		hash = url.searchParams.get('h') ?? undefined;
	}

	if (!id || !VIDEO_ID.test(id)) return null;

	const params = new URLSearchParams();
	if (hash && PRIVACY_HASH.test(hash)) params.set('h', hash);
	params.set('autoplay', '1');
	params.set('dnt', '1');

	return `https://${PLAYER_HOST}/video/${id}?${params}`;
}
