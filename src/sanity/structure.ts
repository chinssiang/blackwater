import { TagIcon, UsersIcon } from '@sanity/icons';
import type { StructureResolver } from 'sanity/structure';
import { colorsMenu } from './deskStructure/colors';
import { globalMenu } from './deskStructure/global';
import { menusMenu } from './deskStructure/menus';
import { pageBlog } from './deskStructure/p-blog';
import { pageCurated } from './deskStructure/p-curated';
import { pageEventItems } from './deskStructure/p-event';
import { otherPagesMenu, pagesMenu } from './deskStructure/pages';
import { settingsMenu } from './deskStructure/settings';

export const structure: StructureResolver = (S) =>
	S.list()
		.title('Website')
		.items([
			globalMenu(S),
			pagesMenu(S),
			otherPagesMenu(S),
			S.divider(),
			...pageEventItems(S),
			S.divider(),
			pageCurated(S),
			S.listItem()
				.title('Team Members')
				.child(S.documentTypeList('gTeamMember').title('Team Members'))
				.icon(UsersIcon),
			S.listItem()
				.title('Roles')
				.child(S.documentTypeList('pEventRole').title('Roles'))
				.icon(TagIcon),
			S.divider(),
			S.divider(),
			menusMenu(S),
			colorsMenu(S),
			S.divider(),
			settingsMenu(S),
		]);
