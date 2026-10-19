# Observability rollout

## Phase 1: Master Dashboard browser diagnostics

This phase adds a small, dependency-free frontend diagnostic foundation to the Master Dashboard.

- Captures uncaught browser errors and unhandled promise rejections.
- Captures React rendering errors with an error boundary and shows a correlation reference.
- Keeps at most 50 events in memory for the current browser session.
- Redacts common email, phone-like number, bearer-token, and payment-key patterns before the event is retained or logged.
- Adds a Monitoring page that clearly distinguishes local diagnostics from remote monitoring.

## Explicitly not enabled yet

- Sentry SDK delivery. No Sentry DSN is present in this change, and no events are sent to Sentry.
- Supabase log ingestion into the Master Dashboard. Supabase logs must remain behind server-side privileged access; never expose service-role credentials in the browser.
- Payment-provider instrumentation. This phase does not modify create-payment, payment-webhook, Paymob, Kashier, or Fawry behavior.
- Persistent logs, alerting, or cross-session event history.

## Next phases

1. Add the pinned Sentry React SDK and initialize it per deployment environment using a public client DSN (never a secret key). Update and commit the lockfile, then verify a controlled test event in Sentry.
2. Add a server-side, authorization-checked log query path for Supabase logs; do not query privileged log sources directly from a browser.
3. Introduce a shared correlation ID convention for Edge Functions, order IDs, and payment references, with strict redaction and tenant-aware access.
4. Add alert thresholds and a production runbook.

## Verification checklist

- Open Master Dashboard and navigate to Monitoring.
- Click **Generate test event**; verify it appears in Recent local events and the warning count increases.
- Trigger a controlled React render failure in a non-production environment to verify the error boundary and correlation reference.
- Confirm the dashboard build passes before merging or deploying.
- Confirm payment provider files and Supabase database schema are unchanged in this phase.
