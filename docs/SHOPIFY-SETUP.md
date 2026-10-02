# Shopify setup

The Shopify integration is **optional**. With none of its env vars set, product
pages render entirely from the manual Sanity fields and the Studio's product
picker degrades to a plain text input. Nothing crashes.

This document covers wiring it up.

---

## What changed on 2026-01-01 (read this first)

Shopify **removed the ability to create custom apps from the Shopify admin**
("Settings → Apps and sales channels → Develop apps"). That flow used to be the
only source of a static, non-expiring **Admin API access token** — the
`shpat_`-prefixed string most older setup guides tell you to copy.

If you go looking for `shpat_…` today on a store without a pre-existing custom
app, **you will not find it.** Apps are now created in the
[Dev Dashboard](https://dev.shopify.com/dashboard), which issues a **Client ID**
and a **Client Secret** instead. Admin API tokens must be minted on demand via
the client-credentials grant and expire every 24 hours.

**This project no longer needs an Admin API token at all.** Everything — the
storefront, and the Studio product picker — runs on the **Storefront API**, which
was never affected by the change. If you have a `SHOPIFY_ADMIN_API_TOKEN` set
anywhere, delete it.

> ⚠️ **The most common mistake.** A **38-character `shpss_`-prefixed** value is an
> **app client secret**, not an access token. Shopify's changelog ("App secret key
> length has increased") added that prefix precisely to make secrets identifiable.
> It is the `client_secret` you would exchange _for_ a token — it will never work
> in an `X-Shopify-Access-Token` or `X-Shopify-Storefront-Access-Token` header.
> Nothing in this project consumes it.

---

## Environment variables

| Variable                           | Where it comes from                                                              | Required for                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `SHOPIFY_STORE_DOMAIN`             | `your-store.myshopify.com` — no `https://`, no trailing slash                    | everything                                                            |
| `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` | Headless channel → your storefront → **private** access token                    | live prices, availability, variants, and the Studio picker            |
| `SHOPIFY_STOREFRONT_API_TOKEN`     | Headless channel → your storefront → **public** access token                     | fallback if you have no private token — see the throttling note below |
| `SHOPIFY_WEBHOOK_SECRET`           | Dev Dashboard → "Blackwater Studio" app → client secret (see §2)                 | store edits reaching the site without a redeploy                      |
| `SHOPIFY_API_VERSION`              | optional override; defaults to the version pinned in `src/lib/shopify/client.ts` | pinning/bumping deliberately                                          |

`SHOPIFY_STORE_DOMAIN` plus **one** of the two tokens must be present or the
integration stays off — `isShopifyConfigured()` checks for both. When both
tokens are set, the private one wins.

---

## 1. Storefront API token (Headless channel)

1. Shopify admin → **Sales channels** → add the **Headless** channel if it isn't
   installed.
2. **Create storefront**. Shopify generates a public and a private access token
   for it.
3. Copy the **private** access token into `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`.
   - Every call in this codebase runs server-side. Shopify throttles **public**
     tokens per buyer IP, expecting a `Shopify-Storefront-Buyer-IP` header to
     identify the real visitor; from a server, all traffic is attributed to one
     egress IP and shares a single small bucket. Under load that surfaces as
     sporadic throttling that soft-fails to manual Sanity prices with no error.
     Private tokens are throttled at the shop level and are the documented
     choice for server-side use.
   - `client.ts` sends `Shopify-Storefront-Private-Token` when the private token
     is set, and falls back to `X-Shopify-Storefront-Access-Token` with the
     public one otherwise. Treat the private token as a secret — never expose it
     to the browser.
4. Under the storefront's **Storefront API permissions**, make sure product
   listings and inventory reads are enabled (`unauthenticated_read_product_listings`,
   `unauthenticated_read_product_inventory`).
5. Set `SHOPIFY_STORE_DOMAIN` to the myshopify domain, e.g.
   `blackwater-tw.myshopify.com`.

Alternative: the same kind of token can be minted with the Admin API's
`storefrontAccessTokenCreate` mutation if you already have Admin access. The
Headless channel is simpler and needs no app.

### Publish your products to that storefront

A Storefront token only ever resolves products **published to its sales channel**.
This is now the single gate on visibility:

- unpublished → the product page silently falls back to its manual Sanity price,
- unpublished → the product does not appear in the Studio picker either.

That symmetry is intentional: the picker can only offer handles the product page
can actually render, so a linked product can never be quietly priceless.

Publishing to this channel is also what makes a product **buyable**: carts and
checkout are created against the same token, so an unpublished product cannot be
added to the cart even if a handle is set by hand.

You only set the handle **once**, on any one language version. Translations
inherit it (see `shopifyHandleField` in `src/sanity/lib/queries.ts`); fill it in
on a translated document only to point that language at a _different_ Shopify
product.

### Verify

```bash
API_VERSION="${SHOPIFY_API_VERSION:-$(grep -oE "DEFAULT_API_VERSION = '[^']+'" src/lib/shopify/client.ts | grep -oE "[0-9]{4}-[0-9]{2}")}"
curl -s -X POST "https://$SHOPIFY_STORE_DOMAIN/api/$API_VERSION/graphql.json" \
  -H 'Content-Type: application/json' \
  -H "Shopify-Storefront-Private-Token: $SHOPIFY_STOREFRONT_PRIVATE_TOKEN" \
  -d '{"query":"{ shop { name } }"}'
```

The version is read from your env, falling back to the pin in
`src/lib/shopify/client.ts` — so this probes the same API version the app uses
rather than a hardcoded one. If you're on a public token instead, swap the
header for `X-Shopify-Storefront-Access-Token: $SHOPIFY_STOREFRONT_API_TOKEN`.

A JSON body containing your shop name means the token and domain are good.

---

## 2. Webhooks (live revalidation)

Cached Storefront fetches are tagged `shopify` and `shopify:product:<handle>`,
and are invalidated by webhook rather than by a timer. Without this, store edits
do not reach the site until the next deploy.

The subscriptions are declared in `shopify/shopify.app.toml`, on the
"Blackwater Studio" app, and pushed with the Shopify CLI:

- **`products/update`** → refreshes that product's tag
- **`products/delete`** → broad refresh (payload carries no handle)
- **`inventory_levels/update`** → broad refresh (ditto)
- **`inventory_levels/connect`** / **`inventory_levels/disconnect`** → broad
  refresh — an item gaining or losing a stocking location changes what a market
  can sell without any quantity changing

Market settings (locations, catalogs, price lists) and Headless channel
publishing send no webhook this app can receive. After changing either, nudge
any product's stock (+1, then −1): the `inventory_levels/update` it sends
refreshes every product.

1. Put the app's **client secret** (Dev Dashboard → the app → Settings, or
   `shopify app env show --path shopify`) into `SHOPIFY_WEBHOOK_SECRET`: app
   webhooks are signed with it, not with the shop's shared secret from
   Settings → Notifications. `vercel env add` will not overwrite an existing
   variable, so remove it first, then redeploy:
   `npx vercel env rm SHOPIFY_WEBHOOK_SECRET production`, then
   `npx vercel env add SHOPIFY_WEBHOOK_SECRET production`.
   Do this **before** step 2, or deliveries 401 until the redeploy lands.
2. Edit `shopify/shopify.app.toml`, then `shopify app deploy --path shopify`.
   Deploy replaces the app's whole configuration with the file, so pull the live
   config first (`shopify app config link --path shopify`) if anyone may have
   changed it in the Dev Dashboard.
3. Confirm the app is **installed** on the store (Admin → Settings → Apps) and
   has approved any new scopes. App webhooks are delivered only to shops the app
   is installed on — otherwise the deploy succeeds and nothing ever arrives.

Delivery counts and failures show in the Dev Dashboard (7-day window).

> The address must answer without a redirect — Shopify follows none — so it is
> `www.blackwaterrc.com`, not the apex (308 to www) or a `vercel.app` alias
> (to be redirected to the domain). Shopify's admin **Settings → Notifications**
> page refuses this host as "the store's own domain"; that refusal is the other
> reason the subscriptions live in the app config.
>
> Do not also create webhooks under **Settings → Notifications → Webhooks**: those
> are signed with the shop's shared secret, so with `SHOPIFY_WEBHOOK_SECRET`
> holding the client secret every one of them fails with a 401 and no other
> symptom.

---

## 3. Deploying

```bash
npx vercel env add SHOPIFY_STORE_DOMAIN
npx vercel env add SHOPIFY_STOREFRONT_PRIVATE_TOKEN
npx vercel env add SHOPIFY_WEBHOOK_SECRET
```

Then redeploy. If `SHOPIFY_ADMIN_API_TOKEN` still exists in the Vercel project,
remove it — nothing reads it.

---

## Troubleshooting

**The Studio picker is a plain text box saying "not configured".**
The search route returned 503, which means `SHOPIFY_STORE_DOMAIN` or
no Storefront token is set. Check the server log — if the retired
`SHOPIFY_ADMIN_API_TOKEN` is still set, `client.ts` logs a one-time warning
saying so, and flags an `shpss_` value as a client secret.

**The picker says "Could not reach Shopify".**
The route returned 502: the credentials are present but the request failed. Check
the server log for `[shopify-search] fetch error`. Usually a wrong domain, a
revoked token, or a token whose Storefront API permissions are too narrow.

**"Too many searches — pause a moment and try again."**
The per-IP throttle in `src/app/api/shopify/search/route.ts` (`RATE_LIMIT`).
It resets on a rolling 10-minute window.

**A product exists in Shopify but the picker can't find it.**
It isn't published to the Headless storefront's sales channel. Publish it —
the product page couldn't have rendered its price either.

**The picker finds a product, but the product page shows the manual price.**
Check the handle stored in Sanity matches exactly, then look for
`[shopify] no product for handle "…"` in the server log.

**Webhooks return 401.**
`SHOPIFY_WEBHOOK_SECRET` doesn't match the secret Shopify signed with. Re-copy the
app's client secret from the Dev Dashboard, and check nobody created webhooks
under Settings → Notifications (see §2).

**Webhooks return 500 "Not configured".**
`SHOPIFY_WEBHOOK_SECRET` isn't set in that environment at all.

---

## Where the code lives

- `src/lib/shopify/client.ts` — Storefront GraphQL transport; reads env at call
  time so the integration is optional.
- `src/lib/shopify/product.ts` — soft-failing fetchers for the detail page and
  listing cards; every failure falls back to manual Sanity fields.
- `src/lib/shopify/cart.ts` — cart mutations; uncached, and errors propagate
  rather than soft-failing.
- `src/lib/shopify/types.ts` — client-safe types and pure helpers.
- `src/app/api/shopify/search/route.ts` — Storefront proxy for the Studio picker.
- `src/app/api/shopify/cart/route.ts` — on-site cart; cart id in an httpOnly cookie.
- `src/app/api/shopify/revalidate/route.ts` — HMAC-verified webhook receiver.
- `src/components/cart/` — `CartProvider`, `CartButton`, `CartDrawer`.
- `src/sanity/schemaTypes/components/ShopifyProductInput.tsx` — the picker.

---

## Checkout

Shopping happens on this site; only the final checkout is Shopify-hosted (Shopify
does not offer a self-hosted checkout). The cart's `checkoutUrl` is followed as a
plain link, so the buyer goes straight to checkout and never sees the Shopify
storefront.

The storefront password does **not** block this — a password-protected Online
Store still lets headless carts check out, which is worth knowing because the
Online Store channel here is gated. Branding for that page is configured in the
Shopify admin under **Settings → Checkout**.
