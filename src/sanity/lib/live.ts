// The mechanism, for the call sites that point here: `defineLive` exists only in
// next-sanity's `react-server` export condition. Resolved from the client graph
// the same specifier yields a stub whose entire body is a throw, so a 'use client'
// import of this module used to fail at runtime with "defineLive can only be used
// in React Server Components". `server-only` turns that into a build error that
// names the boundary instead.
//
// So `<SanityLive />` is an async Server Component — it awaits `draftMode()`, and
// `cookies()` only when draft mode is on — and can never sit in a lazy client
// chunk. It is rendered by `layout/HtmlShell.tsx`.
import 'server-only';
import { defineLive } from 'next-sanity/live';
import { client } from '@/sanity/lib/client';
import { token } from '@/sanity/env';

if (!token) {
	throw new Error('Missing SANITY_API_READ_TOKEN');
}

export const { sanityFetch, SanityLive } = defineLive({
	client,
	// Required for showing draft content when the Sanity Presentation Tool is used, or to enable the Vercel Toolbar Edit Mode
	serverToken: token,
	// Required for stand-alone live previews, the token is only shared to the browser if it's a valid Next.js Draft Mode session
	// KNOWN GAP: this is the same drafts-capable token as `serverToken` above, so
	// every draft session hands the browser read access to the whole dataset's
	// drafts. next-sanity's contract wants a viewer-scoped, published-only token
	// here; closing it needs a second env var, not a code change.
	browserToken: token,
});
