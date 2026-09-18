# Master Dashboard

Platform-operator dashboard (spec sections 47–61 / Phase 7). Separate app from
`cafe-admin-dashboard` (that one is per-restaurant staff; this one is for
whoever runs the platform itself). Same Supabase project, same stack
(React + TypeScript + Vite + Tailwind), deliberately different accent color
so the two are never visually confused with each other.

## Status

**Built and working:**
- Platform admin authentication (`platform_users` membership, not
  `restaurant_users` — a restaurant owner's login does not work here).
- Restaurants list: every restaurant with live status, subscription status,
  plan, order count, revenue, connected payment provider, staff count, last
  order date, and derived "issues" (no subscription, subscription in a bad
  state, no active payment provider, zero staff) — all read from real data
  via `get_platform_restaurants_overview()`, no placeholder numbers.
- **Create Restaurant**: one form creates the restaurant + settings +
  branding + a 14-day trial subscription + an "Owner" role with all 9
  permissions, atomically (`create_restaurant_full` SQL function), then the
  `create-restaurant` Edge Function invites the admin's email via Supabase
  Auth and links them as Owner. If the invite step fails, the restaurant is
  still kept (not silently lost) and the error says exactly what to retry.
- **Restaurant Details** (click any row): subscription info, connected
  payment provider, live stats (orders/revenue/customers/last order), staff
  list, recent audit-log activity for that restaurant, and tenant status
  controls (trial/active/suspended/inactive) — enforced via
  `set_restaurant_status()`, which is a real DB write with an audit log
  entry, not a UI-only toggle.
- Seeded `plans` (Basic/Pro/Premium, per the spec's own example) — this
  table was completely empty before, which would have made Create
  Restaurant unusable.

- **Subscriptions & Plans**: Plans catalog page (price, active/inactive,
  feature toggles, add new plans — was completely empty before this, now
  seeded with Basic/Pro/Premium). Per-restaurant subscription actions
  (Extend Trial, Change Plan, Cancel — immediately or at period end) live on
  each restaurant's Details page, backed by real RPCs
  (`extend_subscription`, `change_subscription_plan`, `cancel_subscription`).
  A genuinely automatic enforcement job (`pg_cron`, hourly) moves
  trial/active subscriptions to `past_due` once their period ends, then to
  `expired` + suspends the restaurant once the (configurable, per-subscription)
  grace period also runs out — this is real, working, time-based
  enforcement per spec 52E, not a UI-only status. It can't yet key off
  actual payment success/failure, since no payment processor is wired up
  anywhere in this project yet (see the Payment Monitoring milestone).

- **Custom domains (prep work)**: `custom_domains` table + real DNS TXT
  verification (`verify-domain` Edge Function, does an actual DNS-over-HTTPS
  lookup — not a fake "mark as verified" button) so a restaurant can prove
  ownership of their own domain before it's ever considered for routing.
  Manageable from Restaurant Details. **Deliberately not wired into
  cafe-website yet** — that's a separate step once the hosting/subdomain
  setup (`{slug}.<platform-domain>` + wildcard SSL) is decided. Reserved
  slugs (`master`, `dashboard`, `www`, `api`, etc.) are now blocked in
  `create_restaurant_full` so a restaurant can never claim a slug that
  would collide with the platform's own subdomains.

- **Feature Flags**: full 3-tier management (platform-wide / per-plan /
  per-restaurant), backed by a single resolver function
  (`get_feature_flag(restaurant_id, feature_key)`) every app should call
  rather than each re-implementing the priority order. An unset flag
  resolves to `false` (safe default for a kill-switch system).

**Not built yet (next milestones, in spec order):**
- Platform Analytics
- Payment Provider Monitoring
- Platform Users (role management for platform staff — the 5 roles already
  exist in `platform_roles`, but there's no UI for it and no per-role
  permission enforcement yet, same as `role_permissions` was before it got
  wired up on the restaurant side)
- Audit Logs (a dedicated cross-restaurant log browser — right now audit
  entries only show up per-restaurant, inside Restaurant Details)
- System Health
- Support System (Phase 8 per the spec, lower priority)

The sidebar already shows every one of these sections, grayed out and
labeled "soon" — this is deliberate, so the dashboard's full intended shape
is visible from day one instead of nav items silently appearing over time.

## First platform admin

`shadyelsawy536@gmail.com` was granted the `Super Admin` platform role
directly via a migration (`bootstrap_platform_admin_and_roles`), since
`platform_users` started out empty and there was no other way to get the
first admin in. Anyone else needs a row added to `platform_users` — there's
no self-serve signup for this dashboard, intentionally.

## Setup

```
npm install
npm run dev
```

No `.env` needed — the Supabase URL/anon key are inlined in
`src/lib/supabase.ts`, same pattern as the other two web repos in this
project.
