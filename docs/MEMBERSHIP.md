# Membership System Guide

Last updated: 2026-09-27

## Overview

Membership is free, and members sign in with a 6-digit code sent to their email. There are no passwords. Visitors sign up and sign in the same way: the first code a person enters creates their account.

- **Where members use it:** the account pages, in English and Chinese: `/account` (profile), `/account/history` (club history), `/account/orders` and `/account/settings`, behind one sidebar.
- **Where the data lives:** a Postgres database hosted by Neon. It is **not** in Sanity, so the Studio can't show or edit members.
- **What is stored:** email address, sign-up date, the optional profile a member fills in on `/account` (first and last name, phone, country, birthday, an emergency contact — never shown to other members), the language they want email in, active sign-ins (sessions), pending codes, rate-limit counters, and which club events each email registered for or attended. No passwords or payment details.
- **Join key:** email is what links a member to Luma, Klaviyo and Shopify records.

This guide has two halves. Operators (non-technical crew) need only the next two sections. Developers should read everything.

## Managing members in the Neon Console

All member admin happens in the Neon Console at console.neon.tech. Every change there is live on the website immediately and cannot be undone, so read before you click.

### Getting in

1. Sign in to console.neon.tech with the account that owns the project (ask a developer to invite you).
2. Open the Blackwater project and make sure the branch selector says **production** (`main`) — other branches are test copies.
3. Click **Tables** in the left sidebar to browse, or **SQL Editor** to run a query.

### What each table is

| Table                 | One row per                            | Safe to edit?                             |
| --------------------- | -------------------------------------- | ----------------------------------------- |
| `member`              | person                                 | Yes, carefully — see below                |
| `member_session`      | signed-in browser                      | Delete only (signs that browser out)      |
| `member_verification` | code waiting to be typed               | Leave alone                               |
| `member_account`      | external login (always empty)          | Leave alone                               |
| `auth_rate_limit`     | per-IP counter                         | Leave alone                               |
| `sign_in_code_limit`  | per-email / per-IP / site-wide counter | Delete a row to lift a lock (see support) |
| `event_attendance`    | email × event (Luma link)              | Yes — this is where history is loaded     |
| `attendance_erasure`  | person whose history was erased        | Never — it stops re-imports restoring it  |

### Common tasks

- **Find a member:** open `member`, use the filter on `email`. Emails are stored lowercase.
- **Count members:** SQL Editor → `select count(*) from member;`
- **Sign a member out everywhere:** in `member_session`, filter `member_id` to their id and delete those rows. They are signed out on their next page load.
- **Change a member's email:** edit `email` in `member`. Their next code goes to the new address. Don't edit if the new address already belongs to another member — the database will refuse.
- **Delete a member:** delete their row in `member`. Their sessions go with it automatically. If they sign in again later, a fresh account is created.

### Rules

- The profile columns (`first_name`, `last_name`, `phone`, `country`, `birthday`, `emergency_contact_name`, `emergency_contact_phone`, `preferred_locale`) are the member's own; edit them only at the member's request. Empty means they haven't added one. `country` is a two-letter code (`TW`), `birthday` is `yyyy-MM-dd`, `preferred_locale` is `en`, `zh_tw` or empty.
- The emergency contact is for the crew to use when someone is hurt at a club event, and for nothing else.
- Never edit `id`, `created_at` or `consent_version` — they are the record of when and under which privacy notice the person joined.
- Never export member emails to a spreadsheet or tool that isn't already approved to hold them.
- If you are unsure, ask a developer before saving.

## Common support situations

| Member says                    | Likely cause                                                                         | What to do                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I never got the code"         | Spam folder, typo in email, or the site's mail account hit its daily cap             | Ask them to check spam and retype the address. If several people report it the same day, tell a developer — the shared mail account may be over its limit.                                                                                                                                                      |
| "It says my code is wrong"     | Typo, or they requested a second code (only the newest works)                        | Ask them to use the latest email only.                                                                                                                                                                                                                                                                          |
| "It says the code expired"     | Codes last 10 minutes                                                                | Request a new code.                                                                                                                                                                                                                                                                                             |
| "Too many attempts"            | 3 wrong tries burn a code                                                            | Request a new code.                                                                                                                                                                                                                                                                                             |
| "Too many requests, try later" | More than 5 codes for one email in an hour, or 20 from one network in a day          | Wait an hour. If urgent, delete the row in `sign_in_code_limit` whose `key` is `email:their@address`.                                                                                                                                                                                                           |
| "Nobody can sign in"           | Site-wide cap of 300 codes/day reached, mail not configured, or the database is down | Tell a developer. The `/account` page shows an "unavailable" message when the database can't be reached.                                                                                                                                                                                                        |
| "Delete my data"               | Privacy request                                                                      | They can do it themselves: Settings → Delete account. Otherwise ask a developer to run `scripts/import-luma-attendance.mjs --erase their@address --execute` (also for people with no account), then delete their `member` row if they have one. Also remove them from Klaviyo/Luma if the request covers those. |
| "I got signed out"             | 30 days without visiting `/account`, or someone deleted their session                | Normal — they sign in again with a new code.                                                                                                                                                                                                                                                                    |

## Architecture (developers)

Everything runs inside the Next.js app: **Better Auth** (email-OTP plugin) handles auth, **Drizzle** talks to **Neon Postgres**, and the site's existing SMTP account sends the codes. Better Auth was chosen over Auth.js, which is maintenance-only since 2026.

| Piece                   | Role                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Better Auth             | Endpoints under `/api/auth/*`: send code, verify code, get session, sign out. Owns sessions and rate limiting.  |
| drizzle-orm             | Typed query builder; Better Auth's `drizzleAdapter` reads/writes through it.                                    |
| drizzle-kit             | Generates SQL migrations from `schema.ts` and applies them.                                                     |
| Neon (`neon-http`)      | Serverless Postgres over HTTP per query — no pool, but no interactive transactions, so write single statements. |
| `createMailTransport()` | Shared SMTP transport in `src/lib/mail.ts` (also used by contact + product-submission forms).                   |

### File map (`src/lib/member/`)

| File                | Holds                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `schema.ts`         | The seven tables. Better Auth models renamed to club vocabulary (`member`, `member_session`…).               |
| `countries.ts`      | ISO 3166-1 alpha-2 codes the profile's country must be one of.                                               |
| `attendance.ts`     | `getMemberAttendance(email)`: the member's `event_attendance` rows.                                          |
| `devices.ts`        | `listMemberDevices(id, sessionId)`: live sessions for Settings, without their tokens.                        |
| `device-name.ts`    | `describeDevice(userAgent)`: "Safari · iPhone".                                                              |
| `db.ts`             | The only place a DB client is created.                                                                       |
| `auth.ts`           | `createAuth()` config + `getAuth()` singleton; `PRIVACY_NOTICE_VERSION`.                                     |
| `session.ts`        | `getCurrentMember()` for Server Components.                                                                  |
| `code-limits.ts`    | Per-email / per-IP / site-wide code limits.                                                                  |
| `handler.ts`        | GET/POST re-exported by `src/app/api/auth/[...all]/route.ts`.                                                |
| `name.ts`           | `formatMemberName()`: first + last as one string, in the order the name's own script writes it.              |
| `shared.ts`         | Constants the client form shares with the server (code length, locale header, error codes).                  |
| `sign-in-email.tsx` | The code email: copy (kept out of the dictionaries, which ship to the browser) and its React Email template. |

UI lives in `src/app/(frontend)/[locale]/(site)/account/`: one `page.tsx` per section (`/`, `history/`, `orders/`, `settings/`) plus `actions.ts` (the newsletter Server Action). In `_components/`: `AccountPage` (reads the session; sign-in form, unavailable note, or the frame), `AccountFrame` (sidebar markup), `AccountSections` (page heading and section block), `ProfileForm`, `HistoryList`, `LanguagePreference`, `NewsletterPreference`, `SignOutOthersButton`, `DeleteAccount`, and the original `SignInForm`, `SubmitButton`, `SignOutButton`, `SessionRefresh`. There is no `layout.tsx` on purpose: the session read would move into it, and a layout does not re-render between its pages.

`ProfileForm` saves the whole profile through Better Auth's own `POST /api/auth/update-user`, so the session and origin checks are the library's, then refreshes the route so the sidebar shows the new name. Every field is an `additionalFields` entry in `auth.ts` with its validator there: names and the emergency contact's name are trimmed and length-capped, phones are digits with the usual punctuation, `country` must be in `countries.ts`, `birthday` a real date from 1900 to today, `preferredLocale` a site locale. `name.ts` formats the name for the sidebar, family name first for a CJK name. Better Auth would also write its built-in `name` and `image` unvalidated, on a first sign-in and through update-user, so the `databaseHooks` in `auth.ts` refuse any member write that carries either.

Settings:

- **Language** saves `preferredLocale` through update-user. `sendVerificationOTP` reads it, so a saved language beats the page the member signs in from.
- **Emails** reads Klaviyo's `can_receive_email_marketing` for the member's address on the server, and the checkbox calls the `setNewsletterSubscription` Server Action (Next checks its origin). Subscribing adds them to the list for their language; unsubscribing is global, because Klaviyo consent is per profile. Without `KLAVIYO_PRIVATE_API_KEY` the section says it is unavailable.
- **Signed-in devices** is read by `devices.ts`, not Better Auth's `list-sessions`, which would hand every session token to the browser. "Sign out everywhere else" is Better Auth's `revoke-other-sessions`.
- **Delete account** is Better Auth's `delete-user`. With no password to confirm, it needs a session created in the last day, and answers `SESSION_EXPIRED` otherwise; the dialog then offers to sign in again. `deleteUser.beforeDelete` removes the member's `event_attendance` rows first, since no cascade reaches them.

### Lazy initialisation

`getDb()` and `getAuth()` build their clients on first use, never at import. `next build` imports these modules and neither CI nor previews have a `DATABASE_URL`. First use must also come **after** `await headers()` — that call is what tells Next to render `/account` per request instead of prerendering it.

## Sign-in flow (developers)

Sign-in is two POSTs from `SignInForm`, both plain `fetch` to Better Auth.

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as /api/auth
  participant D as Postgres
  participant M as SMTP
  B->>A: POST email-otp/send-verification-otp {email, type:sign-in}
  A->>A: hooks.before: mail configured? limits ok?
  A->>D: store hashed code (10 min)
  A-->>M: send code (after response)
  A-->>B: 200
  B->>A: POST sign-in/email-otp {email, otp}
  A->>D: verify hash, create member if new, create session
  A-->>B: Set-Cookie bw.session_token
  B->>B: router.refresh() re-renders /account
```

### Step 1 — request a code

1. `hooks.before` runs **before** the endpoint. It refuses with `503` if mail isn't configured and `429` if a limit is hit. Doing this inside `sendVerificationOTP` wouldn't work — Better Auth swallows errors thrown there and still replies "check your email".
2. Invalid emails are skipped by the hook so they never count against a limit (the endpoint rejects them anyway).
3. Better Auth issues a code and stores it **hashed** (`storeOTP: 'hashed'`; the library default is plain text). A new request replaces the previous code.
4. The email is sent via `after()`, so response time doesn't reveal SMTP timing. Language comes from the `x-bw-locale` header.
5. Only `type: 'sign-in'` sends mail; other OTP types the endpoint accepts are ignored.

### Step 2 — verify

- Code: 6 digits, valid **10 minutes**, burned after **3** wrong tries.
- Errors the form maps to messages: `INVALID_OTP`, `OTP_EXPIRED`, `TOO_MANY_ATTEMPTS` (in `shared.ts`, type-checked against Better Auth's list).
- First successful verify creates the `member` row. A database hook stamps `consent_version = PRIVACY_NOTICE_VERSION` — bump that constant whenever the privacy text in either dictionary changes.
- `emailVerified` is set true, since receiving the code proves the address.

## Sessions and cookies (developers)

Sessions are server-side and sliding: the cookie holds an opaque token, and each read looks it up in `member_session`. This is deliberately not a JWT access/refresh pair — deleting the row revokes the session on the next request, which is what short-lived access tokens try to approximate.

### The cookie

| Property | Value                                                                                     |
| -------- | ----------------------------------------------------------------------------------------- |
| Name     | `bw.session_token` (prefix from `cookiePrefix: 'bw'`)                                     |
| Content  | Opaque random token (unique in `member_session.token`)                                    |
| Flags    | `HttpOnly`, `Secure`, `SameSite=Lax`                                                      |
| Lifetime | 30 days (`expiresIn`)                                                                     |
| Refresh  | Pushed out a fresh 30 days when read more than 1 day after its last refresh (`updateAge`) |

### Reading the session

`getCurrentMember()` (`session.ts`) returns the member, `null` when signed out, or `'unavailable'` when there's no `DATABASE_URL` (every preview) or the read fails. It never throws: there is no `error.tsx`, so a throw would replace the whole document. Rules:

- Call it from a **page**, never a layout — it reads cookies, which would take every page beneath out of static generation. `/account` is the only dynamic page under `[locale]`.
- Keep `await headers()` as its own statement **outside** the `try`, so Next's dynamic-rendering signal isn't swallowed.
- It passes `disableRefresh: true`. A Server Component can't set cookies, so refreshing there would extend the row but drop the new cookie.

### Why `SessionRefresh` exists

`SessionRefresh` is a client component on `/account` that renders nothing and calls `GET /api/auth/get-session`. That route **can** set cookies, so it is where the 30-day cookie is actually re-issued. Remove it as a "no-op" and every member is signed out 30 days after sign-in, however often they visit. `auth.test.ts` ("staying signed in") pins this.

### Sign-out

`SignOutButton` POSTs `/api/auth/sign-out`, which deletes the session row and clears the cookie. Admins can force the same by deleting rows in `member_session`.

If per-request DB reads ever become a cost, Better Auth's `cookieCache` is the access-token analogue — at the price of sign-out lagging by its `maxAge`.

## Security controls (developers)

### Rate limits on code requests

Four limits stack, all stored in the **database** so every Vercel instance shares one count (an in-memory counter would multiply the limit by the number of warm instances).

| Limit                | Max | Window | Stops                                                                      | Where                |
| -------------------- | --- | ------ | -------------------------------------------------------------------------- | -------------------- |
| Per IP (Better Auth) | 3   | 1 min  | Rapid-fire from one client                                                 | `auth_rate_limit`    |
| Per email            | 5   | 1 hour | Bombing one inbox / replacing a member's code as they type                 | `sign_in_code_limit` |
| Per IP               | 20  | 1 day  | One address draining the site-wide cap (3/min would be 4,320/day)          | `sign_in_code_limit` |
| Site-wide            | 300 | 1 day  | Exhausting the shared SMTP cap, which would also silence the contact forms | `sign_in_code_limit` |

Notes: checks run per email → per IP → total, so a flood at one target never spends the others. Each check is one atomic upsert (neon-http has no transactions). A refused request still counts, keeping a flood refused. Old rows are pruned on each request. Our counters live in their own table because Better Auth prunes `auth_rate_limit` after its own short window.

**Client IP:** read from `x-vercel-forwarded-for`, then `x-real-ip`, then `x-forwarded-for`. Better Auth only trusts a header holding a single value — a CDN that appends to `x-forwarded-for` would otherwise lump every visitor into one bucket. If no IP can be trusted, the per-IP check is skipped rather than shared.

### Code storage

Codes are hashed at rest, expire in 10 minutes, and burn after 3 wrong attempts. A database leak doesn't hand out live codes.

### CSRF / origin check

Better Auth rejects cross-origin POSTs. Allowed origins are `SITE_URL` plus the deployment's own `VERCEL_URL` / `VERCEL_BRANCH_URL`, so previews work. `advanced.disableOriginCheck: false` looks redundant but is not: Better Auth defaults it to **true** when `NODE_ENV=test`, which would let the test suite pass with CSRF protection off.

### The database fence

There is no row-level security, so any query can read any member. The fence keeps every read inside code that scopes it:

- ESLint forbids importing `member/db`, `member/auth`, or any driver (`drizzle-orm`, `@neondatabase/serverless`, `@electric-sql/pglite`) outside `src/lib/member/` — in `.js`/`.mjs` too.
- It matches by **regex**, not path glob (a glob let `./member/db` through), and a `no-restricted-syntax` rule covers dynamic `import()`.
- New member reads go in `src/lib/member/` as functions taking the member's id. Don't widen the fence.
- The app holds no Sanity write token, and member data never goes to Sanity.

### Mail

Codes share the site's single SMTP account (~500/day on personal Gmail, 2,000 on Workspace) with the contact and product-submission forms. `createMailTransport()` picks TLS from the port: implicit on 465, STARTTLS otherwise.

## Schema changes, config and testing (developers)

### Changing the schema

1. Edit `src/lib/member/schema.ts`. JS field names stay Better Auth's camelCase; only SQL columns are snake_case.
2. `npm run db:generate` writes a SQL migration into `drizzle/`. Commit it (its `meta/` snapshots are Prettier-ignored).
3. `npm run db:migrate` applies it to whatever `DATABASE_URL` points at. Run it **by hand** — the build never migrates — and against production **before** deploying code that reads a new column: Drizzle names every schema column in its queries, so an unmigrated database fails every member read, sign-in included.

drizzle-kit only reads `.env`, so `drizzle.config.ts` loads `.env.local` itself and fails with a clear message if the URL is missing. `schema.ts` deliberately has no `server-only` import, because drizzle-kit loads it in plain Node.

### Environment variables

| Variable             | Needed by               | Notes                                              |
| -------------------- | ----------------------- | -------------------------------------------------- |
| `DATABASE_URL`       | `/account`, `/api/auth` | Every other page builds and serves without it.     |
| `BETTER_AUTH_SECRET` | same                    | Rotating it signs every member out.                |
| `SITE_URL`           | Better Auth `baseURL`   | Also the trusted origin in production.             |
| SMTP vars            | code emails             | Shared with the contact forms; see `.env.example`. |

### Testing

`auth.test.ts` runs the real config against an in-process Postgres (PGlite) with the committed migrations applied, so a migration that drifts from the schema fails CI. It covers the error codes, the cross-origin rejection, and the session-refresh behaviour.

### Gotchas checklist

- Never call `getCurrentMember()` from a layout.
- Never put `getAuth()` before `await headers()`.
- Never remove `SessionRefresh` or `disableOriginCheck: false`.
- Never move limit or mail checks into `sendVerificationOTP`.
- Bump `PRIVACY_NOTICE_VERSION` when the privacy wording changes.
- Write `event_attendance.email` lowercased and `luma_event_url` through `normalizeLumaEventUrl()`, or rows never match.
- The site chrome never reads the session — keep it that way to protect static generation. The header's "Member" label comes from `bw_member`, a readable hint cookie that the `hooks.after` in `auth.ts` writes alongside every write of the session cookie, with the same attributes and lifetime (`src/hooks/useSignedInHint.ts` reads it). It holds no token and can be stale, so it must never gate anything; visiting `/account` corrects it, because `SessionRefresh` runs there signed in or not.

## Filling in the data (roadmap)

The account pages are built to be filled from the club's other systems. Each source joins on the member's email, which the sign-in code has already proved belongs to them.

### Club history — Luma first

`event_attendance` is where it lands; `/account/history` reads it and joins it to the site's events by `pEvent.lumaUrl`. The club has no Luma Plus, so there is no API: a crew member exports each event's guest CSV and a developer loads it.

**After each event**, once check-in at the door is finished:

1. In Luma, open the event → **Manage** → **Guests** → download the CSV.
2. Dry run, then write:

   ```bash
   node --experimental-strip-types --no-warnings scripts/import-luma-attendance.mjs --url https://lu.ma/abc123 --name "Sunday Long Run" --starts 2026-09-20T07:00+08:00 guests.csv
   ```

   Add `--execute` once the counts look right. `--url` is the event's public link, the one in the event's **Luma URL** field in the Studio. `--name` and `--starts` only show for events the site has no page for.

What it does, in `src/lib/member/luma-import.ts`:

- Writes **every approved guest, member or not**, so a runner's past events are there the day they join.
- Overwrites on a re-run, so exporting again after a late check-in is the fix for a missing `checked_in_at`.
- Removes anyone on the list who is no longer `approved` (declined, waitlisted, cancelled).
- Refuses registrations made before someone's erasure (`attendance_erasure`), so re-importing an old CSV never restores the history of someone who deleted their account or asked to be forgotten.

It fails loudly if Luma renames a CSV column, naming the columns it found. If Luma Plus is ever bought, webhooks (`guest.registered`, `guest.updated`) into an `/api/luma/webhook` route can call the same `importLumaGuests()` and replace the manual step.

**Strava** is a poor source for attendance: its club activity feed does not identify athletes reliably, and matching someone's run to an event means asking each member to connect Strava (OAuth) and guessing from time and place. If it is ever wanted, it belongs as an opt-in "Connect Strava" in Settings that writes rows with the matching Luma event, not as a second history.

### Orders — Shopify

The Storefront token the site uses cannot read orders, and Shopify removed admin-created custom apps on 2026-01-01. Two ways in:

- **Customer Account API.** The member presses "Connect your orders" once and signs in with Shopify's own emailed code (OAuth with PKCE); we store their tokens in a new table and list orders live. The Shopify-sanctioned route for a headless store, but it is a second sign-in.
- **A Dev Dashboard app** with `read_orders` and protected-customer-data approval, queried server-side by the member's verified email. No second sign-in; more setup and review on the Shopify side.

Either way the page shell is ready: `account/orders/page.tsx` swaps its empty state for the list.

### Profile — prefill, never overwrite

The profile columns are named after the fields Luma (name, phone), Shopify (first/last name, phone, default address country) and Klaviyo (first/last name, phone, location, birthday) already hold. A sync should fill **empty** columns only: whatever the member typed on `/account` wins.
