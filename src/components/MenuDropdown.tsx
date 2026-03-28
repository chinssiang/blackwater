import React, { useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import { checkIfLinkIsActive } from '@/lib/routes';
import { cn } from '@/lib/utils';
import CustomLink from '@/components/CustomLink';
import { Button } from '@/components/ui/Button';

interface MenuItem {
	link: { href: string };
	title: string;
}

type MenuDropdownProps = {
	items: MenuItem[];
	title?: string;
};

export default function MenuDropdown({ title, items }: MenuDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const pathName = usePathname();
	const dropdownId = useId();

	return (
		<>
			<div className={cn('dropdown', { 'is-open': isOpen })}>
				<Button
					className="dropdown-toggle"
					aria-expanded={isOpen}
					aria-controls={dropdownId}
					onClick={() => setIsOpen(!isOpen)}
				>
					{title}
				</Button>
				<div id={dropdownId} className="dropdown-content">
					<ul className="dropdown-nav" role="menu">
						{items.map((item: MenuItem, index) => {
							const { link, title } = item || {};
							const isActive = checkIfLinkIsActive({
								pathName: pathName,
								url: link.href,
							});

							return (
								<li
									key={`li-${index}`}
									className={cn({ 'is-active': isActive })}
									role="none"
								>
									<CustomLink link={link} role="menuitem">{title}</CustomLink>
								</li>
							);
						})}
					</ul>
				</div>
			</div>
			<style jsx>{`
				.dropdown {
					&.is-open {
						.dropdown-content {
							opacity: 1;
							pointer-events: auto;
							visibility: visible;
						}
					}
				}
				.dropdown-content {
					opacity: 0;
					pointer-events: none;
					visibility: hidden;
				}
				.dropdown-nav {
					position: absolute;
				}
			`}</style>
		</>
	);
}
