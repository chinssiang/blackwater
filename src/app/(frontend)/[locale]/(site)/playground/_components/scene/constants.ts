// three's Color cannot parse oklch(), so the scene's greys are hex. They are
// the site's achromatic palette read off the dark theme: BACKGROUND is
// `--background` (oklch 0.145), which is also what the fog dissolves into, so
// the world fades into the page rather than ending at an edge.
export const BACKGROUND = '#0a0a0a';
export const GROUND = '#151515';
export const WATER = '#0c0c0c';
export const LINE = '#3d3d3d';
export const LINE_FAINT = '#262626';
export const RUNNER = '#a6a6a4';
export const GHOST = '#e0e0e0';

export const GHOST_OPACITY = 0.3;
/** Seconds for the Pacer to fade in or out. */
export const GHOST_FADE_S = 1;

export const TILE_LENGTH = 12;
export const TILE_COUNT = 4;
export const TILE_WIDTH = 40;

export const FOG_NEAR = 8;
export const FOG_FAR = 20;

/** Share of the canvas width the desktop view shifts left, clear of the panel. */
export const DESKTOP_VIEW_SHIFT = 0.14;
