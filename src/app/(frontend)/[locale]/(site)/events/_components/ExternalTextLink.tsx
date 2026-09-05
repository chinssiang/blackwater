import Link from 'next/link';
import { ArrowUpRight } from '@/components/SvgIcons';
import { cn } from '@/lib/utils';

// A venue/location name that links out to a map when there is a URL, and is
// plain text when there is not. Three copies of this existed across the event
// detail page (the spec band's venue, the trail's start/finish, each station's
// location), differing only in the type token -- so the target/rel contract and
// the ArrowUpRight-means-external convention are stated once here.
//
// Deliberately NOT used by EventTicket's own map link: that one is a different
// idiom (underline on hover, `relative z-10` to sit above the ticket's
// stretched overlay link, no icon) and folding it in would flatten a real
// distinction.
export default function ExternalTextLink({
	label,
	href,
	className,
	ariaLabel,
}: {
	label: string;
	href?: string | null;
	className?: string;
	ariaLabel?: string;
}) {
	if (!href) {
		return <span className={cn('uppercase', className)}>{label}</span>;
	}
	return (
		<Link
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={ariaLabel}
			className={cn(
				'inline-flex items-center gap-1 uppercase transition-opacity hover:opacity-70',
				className
			)}
		>
			{label}
			<ArrowUpRight className="size-2" aria-hidden />
		</Link>
	);
}
