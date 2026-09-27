import { cn } from '@/lib/utils';

// Shared by the account pages' server and client components alike, so this
// file imports nothing that is either's alone.

/** A page's heading and its one-line introduction. */
export function AccountHeading({
	heading,
	intro,
}: {
	heading: string;
	intro?: string;
}) {
	return (
		<header className="mb-8">
			<h1 className="t-h-1 font-medium text-balance">{heading}</h1>
			{intro && (
				<p className="t-b-1 text-muted-foreground mt-3 text-pretty">{intro}</p>
			)}
		</header>
	);
}

/** One titled group within an account page, divided from the one before. */
export function AccountSectionBlock({
	heading,
	children,
	className,
}: {
	heading: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn('border-border border-t pt-6 not-first:mt-10', className)}
		>
			<h2 className="t-l-2 text-muted-foreground mb-4 uppercase">{heading}</h2>
			{children}
		</section>
	);
}
