export function Main({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	// The space the fixed header no longer donates by sitting in flow is applied
	// to `main` in globals.css, not from here -- see the note on that rule, and
	// on `body:has([data-hero-underlay]) main`, which is how a full-bleed hero
	// opts out.
	return (
		<main id="main" className={className}>
			{children}
		</main>
	);
}
