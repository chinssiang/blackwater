import { cn } from '@/lib/utils';

type SvgIconsProps = {
	className?: string;
};

export function ArrowUpRight({ className }: SvgIconsProps) {
	return (
		<svg
			className={cn(className)}
			viewBox="0 0 8 8"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M0.868476 8L0 7.16493L5.91232 1.25261L0.768267 1.33612L2.08768 0H8V5.91232L6.64718 7.23173L6.76409 2.10438L0.868476 8Z"
				fill="currentColor"
			/>
		</svg>
	);
}

// Mobile-menu trigger icon — 3×3 grid of squares (Figma node 1108:2016).
export function MenuIcon({ className }: SvgIconsProps) {
	return (
		<svg
			className={cn(className)}
			viewBox="0 0 15 15"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<path
				d="M2.75 12.25V14.75H0.25V12.25H2.75ZM8.75 12.25V14.75H6.25V12.25H8.75ZM14.75 12.25V14.75H12.25V12.25H14.75ZM2.75 6.25V8.75H0.25V6.25H2.75ZM8.75 6.25V8.75H6.25V6.25H8.75ZM14.75 6.25V8.75H12.25V6.25H14.75ZM2.75 0.25V2.75H0.25V0.25H2.75ZM8.75 0.25V2.75H6.25V0.25H8.75ZM14.75 0.25V2.75H12.25V0.25H14.75Z"
				fill="currentColor"
				stroke="currentColor"
				strokeWidth="0.5"
			/>
		</svg>
	);
}

// Close ("X") icon — the grid's diagonal squares (4 corners + centre).
export function CloseIcon({ className }: SvgIconsProps) {
	return (
		<svg
			className={cn(className)}
			viewBox="0 0 15 15"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<rect
				x="0.25"
				y="0.25"
				width="2.5"
				height="2.5"
				fill="currentColor"
				stroke="currentColor"
				strokeWidth="0.5"
			/>
			<rect
				x="12.25"
				y="0.25"
				width="2.5"
				height="2.5"
				fill="currentColor"
				stroke="currentColor"
				strokeWidth="0.5"
			/>
			<rect
				x="6.25"
				y="6.25"
				width="2.5"
				height="2.5"
				fill="currentColor"
				stroke="currentColor"
				strokeWidth="0.5"
			/>
			<rect
				x="0.25"
				y="12.25"
				width="2.5"
				height="2.5"
				fill="currentColor"
				stroke="currentColor"
				strokeWidth="0.5"
			/>
			<rect
				x="12.25"
				y="12.25"
				width="2.5"
				height="2.5"
				fill="currentColor"
				stroke="currentColor"
				strokeWidth="0.5"
			/>
		</svg>
	);
}

export function Plus({ className }: SvgIconsProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={cn(className)}
		>
			<path d="M5 12h14"></path>
			<path d="M12 5v14"></path>
		</svg>
	);
}
