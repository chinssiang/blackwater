/** Log a page view against a GA measurement id. */
export const pageview = (url: string, gaID: string) => {
	if (typeof window?.gtag !== 'undefined') {
		window.gtag('config', gaID, {
			page_path: url,
		});
	}
};
