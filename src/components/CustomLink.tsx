'use client';

import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import useKey from '@/hooks/useKey';
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
		href?: string;
		isNewTab?: boolean;
		linkType?: 'internal' | 'external';
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
	const router = useRouter();
	const { hasPressedKeys } = useKey();

	if (!link) return children;

	const { href } = link;
	const isOpenNewTab = isNewTab ?? link.isNewTab;

	if (!href) return children;

	const isMailTo = href.match('^mailto:');

	const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
		onLinkClickAction?.(event);

		if (event.defaultPrevented) return;

		const prefersReducedMotion = window.matchMedia(
			'(prefers-reduced-motion: reduce)'
		).matches;
		if (
			document.startViewTransition &&
			!isOpenNewTab &&
			!hasPressedKeys &&
			!prefersReducedMotion
		) {
			event.preventDefault();
			document.startViewTransition(() => {
				router.push(href);
			});
		}
	};

	return (
		<NextLink
			href={href}
			target={isMailTo || isOpenNewTab ? '_blank' : undefined}
			rel={isOpenNewTab ? 'noopener noreferrer' : undefined}
			onClick={handleClick}
			className={cn(className)}
			{...props}
		>
			{children}
		</NextLink>
	);
}
