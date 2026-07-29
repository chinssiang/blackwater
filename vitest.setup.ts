// Env vars required at import time by modules that transitively pull in
// `@/sanity/env` (which throws if these are missing) and by the SEO builders
// that read SITE_URL. Set here so unit tests can import those modules.
process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||= 'test-project';
process.env.NEXT_PUBLIC_SANITY_DATASET ||= 'test-dataset';
process.env.SITE_URL ||= 'https://blackwaterrc.com';
