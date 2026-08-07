// Column templates for the /events table. Shared by the real table and its
// loading skeleton so the two cannot drift -- the skeleton only avoids layout
// shift if it lays out on exactly the same grid.
export const EVENTS_GRID_COLS = {
	withStatus:
		'grid-cols-[60%_1fr] lg:grid-cols-[3fr_1fr_minmax(0,1fr)_230px]',
	withoutStatus: 'grid-cols-[60%_1fr] lg:grid-cols-[3fr_1fr_minmax(0,1fr)]',
} as const;
