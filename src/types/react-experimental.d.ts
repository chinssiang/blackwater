// Activates the React canary/experimental type declarations so `ViewTransition`
// (and related view-transition types) are exported from the `react` module.
// We run on Next's experimental React build (see `experimental.taint` in
// next.config.mjs), which provides these at runtime.
/// <reference types="react/canary" />
/// <reference types="react/experimental" />
