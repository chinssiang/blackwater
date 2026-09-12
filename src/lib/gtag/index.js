// log page views
export const pageview = (url, gaID) => {
	if (typeof window?.gtag !== 'undefined') {
		window.gtag('config', gaID, {
			page_path: url,
		});
	}
};
