import { SettingsMenu } from 'sanity.types';
import { usePathname } from 'next/navigation';
import { checkIfLinkIsActive } from '@/lib/routes';
import CustomLink from '@/components/CustomLink';
import Dropdown from '@/components/MenuDropdown';
import { hasArrayValue, cn } from '@/lib/utils';

type MenuProps = {
	data: SettingsMenu;
	className?: string;
};

export default function Menu({ data, className }: MenuProps) {
	const pathName = usePathname();
	const { items } = data || {};
	if (!hasArrayValue(items)) {
		return false;
	}

	return (
		<ul className={cn(className)}>
			{items.map((item: any, index: number) => {
				const { link, dropdownItems } = item || {};
				const isDropdown = !!dropdownItems;

				if (isDropdown) {
					const isActive =
						dropdownItems.filter((item: any) => {
							const { link } = item || {};
							return checkIfLinkIsActive({
								pathName: pathName,
								url: link.href,
							});
						}).length > 0;

					return (
						<li key={`li-${index}`} className={cn({ 'is-active': isActive })}>
							<Dropdown title={item.title} items={item.dropdownItems || []} />
						</li>
					);
				}

				const isActive = checkIfLinkIsActive({
					pathName: pathName,
					url: link.href,
				});

				return (
					<li
						key={`li-${index}`}
						className={cn(
							't-b-2 text-foreground hover:text-muted transition-colors',
							{
								'text-foreground hover:text-foreground/60': isActive,
							}
						)}
					>
						<CustomLink link={link} className="inline-block">
							{item.title}
						</CustomLink>
					</li>
				);
			})}
		</ul>
	);
}
