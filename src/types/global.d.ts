export {};

declare global {
	interface Window {
		/**
		 * Installed by the Google tag snippet in `HeadTrackingCode`, which is the
		 * only thing that injects it — and only after the visitor has consented.
		 * Optional because on a page with no consent (or no GA id configured) the
		 * snippet never runs, so callers must feature-detect rather than assume.
		 */
		gtag?: (...args: unknown[]) => void;
		dataLayer?: unknown[];
	}
}
