import { apiVersion } from '@/sanity/env';
import { BookIcon, CalendarIcon, TagsIcon, UserIcon } from '@sanity/icons';
import { client } from '@/sanity/lib/client';

export const pageEventCategory = (S) => {
	return S.listItem()
		.title('Events Categories')
		.child(S.documentTypeList('pEventCategory').title('Categories'))
		.icon(TagsIcon);
};

export const pageEventStatus = (S) => {
	return S.listItem()
		.title('Events Status')
		.child(S.documentTypeList('pEventStatus').title('Status'))
		.icon(UserIcon);
};

export const pageEventGroupByDate = (S) => {
	return S.listItem()
		.title('Events by Month/Year')
		.child(async () => {
			const events = await client.fetch(`
				*[_type == "pEvent" && defined(eventDatetime)] {
					eventDatetime
				} | order(eventDatetime desc)
			`);

			// Create unique month/year combinations
			const monthYearMap = new Map();

			events.forEach((event) => {
				const date = new Date(event.eventDatetime);
				const year = date.getFullYear();
				const month = date.getMonth();
				const key = `${year}-${String(month + 1).padStart(2, '0')}`;
				const monthName = date.toLocaleString('en-US', {
					month: 'long',
					year: 'numeric',
				});

				if (!monthYearMap.has(key)) {
					monthYearMap.set(key, {
						key,
						label: monthName,
						year,
						month: month + 1,
					});
				}
			});

			const monthYearItems = Array.from(monthYearMap.values()).sort((a, b) =>
				b.key.localeCompare(a.key)
			); // Sort by year/month descending

			return S.list()
				.title('Events by Month/Year')
				.items(
					monthYearItems.map(({ label, year, month }) => {
						// Calculate start and end dates for the month
						const startDate = new Date(year, month - 1, 1); // month is 1-based, Date constructor is 0-based
						const endDate = new Date(year, month, 1); // First day of next month

						return S.listItem()
							.title(label)
							.child(
								S.documentList()
									.title(`${label} Events`)
									.apiVersion(apiVersion)
									.filter(
										'_type == "pEvent" && eventDatetime >= $startDate && eventDatetime < $endDate'
									)
									.params({
										startDate: startDate.toISOString(),
										endDate: endDate.toISOString(),
									})
									.defaultOrdering([
										{
											field: 'eventDatetime',
											direction: 'asc',
										},
									])
							);
					})
				);
		})
		.icon(CalendarIcon);
};

export const pageEventItems = (S) => {
	return [
		// S.listItem()
		// 	.title('Event Index Page')
		// 	.child(
		// 		S.editor()
		// 			.id('pEvents')
		// 			.title('Event Index Page')
		// 			.schemaType('pEvents')
		// 			.documentId('pEvents')
		// 	)
		// 	.icon(BookIcon),
		S.listItem()
			.title('Events')
			.child(S.documentTypeList('pEvent').title('Events'))
			.icon(BookIcon),
		pageEventGroupByDate(S),
		S.listItem()
			.title('Events by Category')
			.child(
				S.documentTypeList('pEventCategory')
					.title('Events by Category')
					.child((categoryId) => {
						return S.documentList()
							.title('Events')
							.apiVersion(apiVersion)
							.filter('_type == "pEvent" && $categoryId in category[]._ref')
							.params({ categoryId });
					})
			),
		S.listItem()
			.title('Events by Status')
			.child(
				S.documentTypeList('pEventStatus')
					.title('Events by Status')
					.child((statusId) =>
						S.documentList()
							.title('Events')
							.apiVersion(apiVersion)
							.filter('_type == "pEvent" && $statusId in status[]._ref')
							.params({ statusId })
					)
			),
		pageEventStatus(S),
		pageEventCategory(S),
	];
};

export const pageEvent = (S) => {
	return S.listItem()
		.title('Event')
		.child(S.list().title('Event').items(pageEventItems(S)))
		.icon(BookIcon);
};
