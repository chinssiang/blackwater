'use client';

import NextLink from 'next/link';
import { cn } from '@/lib/utils';

/**
 * CustomLink component for handling both internal and external links
 *
 * @param {Object} props
 * @param {Object} props.link - Link object from Sanity
 * @param {string} props.link.linkType - 'internal' or 'external'
 * @param {string} props.link.href - Pre-resolved href from GROQ (preferred)
 * @param {boolean} props.isNewTab - Force open in new tab
 * @param {Function} props.onLinkClickAction - Click handler
 * @param {React.ReactNode} props.children - Link content
 * @param {string} props.className - CSS classes
 */
interface CustomLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	link?: {
		// `unknown`, not `string`: typegen cannot infer the type of
		// resolvedHrefGroq's select() with `+` concatenation, so every projected
		// link arrives carrying `href: unknown`. Narrowed in the body below --
		// the same `typeof === 'string'` check EventStatusPill, EventsBlock and
		// HeroBlock each already do at their own call sites.
		href?: unknown;
		// Nullable, not just optional: a GROQ projection yields `null` for an
		// absent field, never `undefined`, so every link projected from Sanity
		// carries nulls here.
		isNewTab?: boolean | null;
		linkType?: 'internal' | 'external' | null;
	};
	children?: React.ReactNode;
	className?: string;
	isNewTab?: boolean;
	onLinkClickAction?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

export default function CustomLink({
	link,
	children,
	className,
	isNewTab,
	onLinkClickAction,
	...props
}: CustomLinkProps) {
	if (!link) return children;

	const { href } = link;
	const isOpenNewTab = isNewTab ?? link.isNewTab;

	if (typeof href !== 'string' || !href) return children;

	const isMailTo = href.match('^mailto:');

	return (
		<NextLink
			href={href}
			target={isMailTo || isOpenNewTab ? '_blank' : undefined}
			rel={isOpenNewTab ? 'noopener noreferrer' : undefined}
			onClick={onLinkClickAction}
			className={cn(className)}
			{...props}
		>
			{children}
		</NextLink>
	);
}
