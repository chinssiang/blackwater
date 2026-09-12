// Structured data, rendered straight into the server-rendered tree.
//
// Previously this went through `useServerInsertedHTML` from a client component.
// That was wrong twice over. Next invokes EVERY registered callback on EVERY
// flush of the streaming response — the API is built for CSS-in-JS libraries
// that track what they have already emitted — so an unguarded callback shipped
// its script once per flush: one event page carried 69 tags for 3 payloads, 34%
// of its bytes. And merely REGISTERING a callback disables Next's
// `serverInsertedHTML.length === 0` fast path, so every flush then ran a full
// Fizz render and stream decode to produce an empty string.
//
// The reason it was chosen no longer holds: react-dom gates the "Encountered a
// script tag while rendering React component" warning on `!isScriptDataBlock`,
// and that predicate exempts everything but the executable JS mime types plus
// module/importmap/speculationrules — `application/ld+json` never trips it.
//
// Two deliberate consequences of rendering the element in the tree, both
// checked rather than assumed:
//   • The blocks now sit in <body> rather than <head>. Google accepts JSON-LD in
//     either, but a consumer that scans only <head> will no longer find it.
//   • React DOES now create the node on client-side navigation, which the old
//     implementation avoided on purpose. That is an improvement here — the
//     markup follows the route instead of staying whatever the first HTML
//     shipped, so a locale switch no longer leaves stale structured data.
//
// Still outstanding, and NOT caused by this: the root-layout payload is
// re-serialized once per route segment, so it appears ~3x per page in the RSC
// flight data. That is separate from the script-tag duplication fixed above.
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
	return (
		<script
			type="application/ld+json"
			// `<` is escaped so a string inside the payload cannot close this tag.
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replace(/</g, '\\u003c'),
			}}
		/>
	);
}
