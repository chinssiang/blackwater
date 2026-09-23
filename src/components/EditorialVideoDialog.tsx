'use client';

import { useState } from 'react';
import { PlayIcon } from 'lucide-react';
import type { EditorialVideo } from '@/lib/editorial-block';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useTranslations } from '@/components/LocaleProvider';
import { CloseIcon } from '@/components/SvgIcons';
import { Button } from '@/components/ui/Button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/Dialog';

// The editorial module's video CTA: a button that opens the video in a modal.
//
// The player exists only while the dialog is open -- the popup's portal
// unmounts on close -- so a closed dialog costs no third-party request, and
// closing it is what stops playback. That is also why autoplay is safe: the
// player only ever mounts in answer to the click on this button.
//
// Kept apart from EditorialBlock, which stays a Server Component, so only this
// button and its dialog ship to the client. `@base-ui/react/dialog` already
// rides in the header chrome, so there is no bundle reason to split it further.

export default function EditorialVideoDialog({
	label,
	video,
}: {
	label: string;
	video: EditorialVideo;
}) {
	const t = useTranslations('video');
	const [open, setOpen] = useState(false);
	// The site's one scroll lock, as every overlay takes it (CLAUDE.md, Hooks);
	// `modal="trap-focus"` keeps Base UI's own lock off so this stays the only
	// writer, and the callback closes the dialog on a bfcache restore.
	useScrollLock(open, () => setOpen(false));

	return (
		<Dialog open={open} onOpenChange={setOpen} modal="trap-focus">
			<DialogTrigger render={<Button size="lg" />}>
				<PlayIcon aria-hidden data-icon="inline-start" />
				{label}
			</DialogTrigger>
			{/* The popup is only a transparent frame: the overlay supplies the dark
			    surround and the video box below supplies the black. Width follows
			    SizeChartDialog's min() for the reason its note gives. */}
			<DialogContent
				showCloseButton={false}
				overlayClassName="bg-black/80"
				className="gap-0 rounded-none bg-transparent p-0 shadow-none sm:max-w-[min(var(--container-5xl),calc(100%-2rem))]"
			>
				<DialogTitle className="sr-only">{label}</DialogTitle>
				{/* Capped by height too, so a 16:9 box never runs off a short
				    landscape screen; the close button rides this box, not the popup,
				    so it stays on the video's corner when the cap narrows it. */}
				<div className="relative mx-auto w-full max-w-[calc((100svh-8rem)*16/9)]">
					<DialogClose
						render={
							<Button
								variant="ghost"
								size="icon-lg"
								aria-label={t.close}
								className="absolute right-0 bottom-full mb-2 text-white"
							/>
						}
					>
						<CloseIcon className="size-4" />
					</DialogClose>
					<div className="aspect-video w-full bg-black">
						{'vimeoEmbedUrl' in video ? (
							// Once the viewer clicks into the player, keyboard focus is in a
							// cross-origin frame whose key events never reach this document,
							// so Escape cannot close the dialog from there. Nothing on this
							// side can intercept them; Tab still leaves the frame onto the
							// close button through the focus trap, and a click on the
							// backdrop closes it.
							<iframe
								src={video.vimeoEmbedUrl}
								title={label}
								// Vimeo's own embed list; `encrypted-media` is what its player
								// asks for on load.
								allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
								className="size-full border-0"
							/>
						) : (
							// No <track>: the schema has no captions field yet, so an
							// uploaded file carries only what is burned into it (the field
							// description says so). Vimeo's player brings its own tracks.
							// eslint-disable-next-line jsx-a11y/media-has-caption
							<video controls autoPlay playsInline className="size-full">
								<source
									src={video.fileUrl}
									type={video.mimeType ?? undefined}
								/>
							</video>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
