import { useEffect, useState } from 'react';
import {
  getRecentDiagnostics,
  generateMonitoringTestEvent,
  isSentryEnabled,
  subscribeDiagnostics,
  type DiagnosticEvent,
} from '../lib/observability';

function StatusCard({ title, status, detail }: { title: string; status: string; detail: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-2 text-sm font-semibold text-amber-700">{status}</p>
      <p className="mt-1 text-xs leading-5 text-ink/60">{detail}</p>
    </div>
  );
}

export function Monitoring() {
  const [events, setEvents] = useState<DiagnosticEvent[]>(() => getRecentDiagnostics());

  useEffect(() => subscribeDiagnostics(setEvents), []);

  const errors = events.filter((event) => event.level === 'error').length;
  const warnings = events.filter((event) => event.level === 'warning').length;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Monitoring</h1>
          <p className="mt-1 text-sm text-ink/60">
            Observability rollout — browser diagnostics foundation
          </p>
        </div>
        <button
          onClick={() => generateMonitoringTestEvent()}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
        >
          Generate test event
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard
          title="Browser diagnostics"
          status="Active — current session"
          detail="Captures uncaught browser errors, unhandled promise rejections, and React render failures."
        />
        <StatusCard
          title="Sentry"
          status={isSentryEnabled() ? 'Configured — SDK initialized' : 'Not configured'}
          detail={isSentryEnabled()
            ? 'The browser SDK initialized with the build-time DSN. Generate a test event and confirm it appears in the Sentry project to verify delivery.'
            : 'The build did not include VITE_SENTRY_DSN. Add it as a GitHub Actions repository secret and trigger a new deployment.'}
        />
        <StatusCard
          title="Supabase logs"
          status="Not connected to this page"
          detail="Use Supabase project logs for backend diagnostics until a secured server-side integration is added."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-ink/60">Captured in this browser session</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{events.length}</p>
          <p className="mt-1 text-xs text-ink/50">Last 50 events maximum; clears on refresh.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-ink/60">Errors / warnings</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{errors} <span className="text-base font-normal text-ink/40">/</span> {warnings}</p>
          <p className="mt-1 text-xs text-ink/50">These are local diagnostics, not platform-wide totals.</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-semibold text-ink">Recent local events</h2>
          <p className="mt-1 text-xs text-ink/50">Only exception messages and diagnostic metadata are retained locally; common email, phone-like, bearer-token, and secret key-value patterns are redacted.</p>
        </div>
        {events.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink/50">No events captured in this browser session.</div>
        ) : (
          <div className="divide-y divide-line">
            {events.map((event) => (
              <div key={event.id} className="grid gap-2 px-4 py-3 md:grid-cols-[150px_72px_minmax(0,1fr)]">
                <div className="text-xs text-ink/50">{new Date(event.timestamp).toLocaleString()}</div>
                <div>
                  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${event.level === 'error' ? 'bg-red-100 text-red-700' : event.level === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {event.level}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="break-words text-sm text-ink">{event.message}</p>
                  <p className="mt-1 break-all font-mono text-[10px] text-ink/40">
                    {event.source} · correlation {event.correlationId}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <strong>Rollout status:</strong> browser diagnostics are retained locally for this session. When Sentry is
        configured, errors and the generated test event are also sent to the Sentry project with identifying data
        filtered. Confirm the test event appears in Sentry before relying on remote alerting. Supabase backend logs
        remain separate and are not connected to this page.
      </div>
    </div>
  );
}
