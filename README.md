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

- **Platform Analytics**: GMV, total orders, average order value, an MRR
  estimate (active/trialing subscriptions' plan prices — real recognized
  revenue once payment collection exists), restaurant status breakdown,
  subscription churn, 30-day order trend, 12-month restaurant growth, and
  top restaurants by revenue — all via `get_platform_analytics()`, straight
  from `orders`/`subscriptions`/`restaurants`. Payments show "no data yet"
  rather than a fabricated success-rate percentage, since the real payment
  provider integration (`create-payment` Edge Function) only just started
  being built elsewhere in this project and has 0 rows in `payments` so
  far.

- **Platform Users**: list/invite/remove platform admins, assign one of the
  5 platform roles (`Super Admin`, `Support`, `Finance`, `Developer`,
  `Sales`) via the `invite-platform-user` Edge Function (same invite +
  service-role-link pattern as `create-restaurant`). A safety guard
  (`remove_platform_user`) refuses to delete the last remaining platform
  admin, so the platform can never end up with nobody able to log in here.
  **Honest limitation**: roles are labels only for now — every platform
  user has full access to every page, same starting point restaurant staff
  permissions had before that got wired up to actually restrict pages.
  Scoping each platform role to only what it needs is a natural follow-up,
  not done in this pass.

- **Real bugs found and fixed after this was all "done" once already** —
  worth reading if anything here seems to contradict earlier claims in this
  file's history:
  - `authenticated` had `EXECUTE` on individual `private.*` functions but
    never `USAGE` on the `private` schema itself. This silently broke
    *every* admin RPC the moment a real (non-superuser) platform admin
    called them — Restaurants List, Create Restaurant, all Subscription
    actions, Analytics, Platform Users, and the Reports page hardening
    over in cafe-admin-dashboard. One `GRANT USAGE ON SCHEMA private TO
    authenticated` fixed all of them at once.
  - `audit_logs` had a `SELECT` policy but no `INSERT` policy at all, so
    every write-action RPC that logs to it failed too, separately from the
    bug above. Fixed by making those RPCs `SECURITY DEFINER` (each already
    does its own `is_platform_admin()` check first, so this doesn't loosen
    anything).
  - Changing `restaurants.status` never actually stopped anything —
    `is_restaurant_staff()` only checked membership, not whether the
    restaurant was allowed to operate. Suspending a tenant was cosmetic.
    Fixed with a new `private.is_restaurant_active()` check wired into
    `place_order` (blocks new orders at a suspended/inactive restaurant)
    and ~40 staff write policies across menu/offers/staff/settings/order-
    status tables (platform admins keep their override).
  - `change_subscription_plan` only ever touched `plan_id` — a cancelled
    subscription stayed showing `cancelled` forever even after being
    assigned a fresh plan, and a restaurant suspended by that cancellation
    never came back. Now assigning a plan clears the cancellation/expiry
    state and lifts a `suspended` status, same guarded pattern
    `extend_subscription` already used.
  - All of the above were caught by actually simulating the real
    `authenticated` role + a real JWT for a real user (including a
    deliberately non-admin test account for the enforcement checks), not
    by re-reading the SQL and assuming it was right — several earlier
    "verifications" in this project's history only ran as an elevated
    service role, which bypasses exactly the kind of bug that was hiding
    here.
- **Audit Logs**: platform-wide, filterable by restaurant and action type,
  via `get_audit_logs()`.

- **System Health**: real checks run on page load (and on demand via
  "Re-check now") — live Postgres stats (connections, DB size, oldest open
  transaction), a genuine round-trip ping to a dedicated `health-check`
  Edge Function (real measured latency, not simulated), whether Realtime
  is actually configured and how many tables are in the publication,
  Supabase Storage bucket count (0 today — this project uses Cloudflare R2
  directly instead, which the page says outright rather than showing a
  misleading red X), payment provider connection rate + 7-day success rate,
  and the `enforce-subscription-lifecycle` cron job's actual last-run
  status pulled from `cron.job_run_details`.

- **Overview**: the real landing page now (was redirecting straight to
  Restaurants before). Composed entirely from the RPCs already built above
  — no new backend logic — Restaurants/Orders-Today/GMV/MRR stat cards, a
  "Needs Attention" panel (same issue-derivation as the Restaurants list:
  no subscription, bad subscription status, no active payment provider, no
  staff), a compact system-status strip (Realtime + cron job health,
  linking to the full System Health page), and the last 8 audit log
  entries platform-wide.

**Deployment**: GitHub Pages, under `/master-dashboard/` in production
(see `.github/workflows/deploy.yml` and `vite.config.ts`'s mode-aware
`base`). `App.tsx` resolves the router's `basename` from the current path
so the same build works both there and at the domain root in local dev.

**Not built yet:**
- Payment Provider Monitoring — parked for now (see the payment
  architecture audit elsewhere in this project's history: the backend has
  real gaps — no webhook handler exists yet, and the credential-save path
  is broken — being addressed separately before this page would have real
  data to show)
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
