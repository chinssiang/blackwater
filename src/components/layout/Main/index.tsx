export function Main({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<main id="main" className={className}>
			{children}
		</main>
	);
}
