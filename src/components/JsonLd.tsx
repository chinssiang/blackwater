'use client';

import { useServerInsertedHTML } from 'next/navigation';

export default function JsonLd({ data }: { data: Record<string, unknown> }) {
	// Inject the JSON-LD into the server-rendered HTML stream only, then render
	// nothing on the client. Crawlers still get the structured data in the
	// initial HTML, but React never creates a <script> node during client-side
	// navigation (e.g. switching locale), which is what triggers React 19's
	// "Encountered a script tag while rendering React component" warning.
	useServerInsertedHTML(() => (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replace(/</g, '\\u003c'),
			}}
		/>
	));

	return null;
}
