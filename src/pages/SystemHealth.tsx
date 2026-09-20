import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Badge, type BadgeTone } from '../components/Badge';

interface HealthData {
  database: { active_connections: number; database_size_mb: number; oldest_active_transaction_seconds: number };
  realtime: { configured: boolean; tables_enabled: number };
  storage: { bucket_count: number; note: string | null };
  scheduled_jobs: { jobname: string; schedule: string; active: boolean; last_run_status: string | null; last_run_at: string | null }[];
  payments: {
    restaurants_with_active_provider: number;
    total_restaurants: number;
    recent_success_rate: number | null;
    recent_sample_size: number;
  };
  checked_at: string;
}

export function SystemHealth() {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edgeLatencyMs, setEdgeLatencyMs] = useState<number | null>(null);
  const [edgeError, setEdgeError] = useState<string | null>(null);

  async function runChecks() {
    setData(null);
    setError(null);
    setEdgeLatencyMs(null);
    setEdgeError(null);

    const { data: healthData, error: rpcError } = await supabase.rpc('get_system_health');
    if (rpcError) setError(rpcError.message);
    else setData(healthData as HealthData);

    const start = performance.now();
    const { error: pingError } = await supabase.functions.invoke('health-check');
    if (pingError) setEdgeError(pingError.message);
    else setEdgeLatencyMs(Math.round(performance.now() - start));
  }

  useEffect(() => {
    runChecks();
  }, []);

  const jobIsHealthy = (j: HealthData['scheduled_jobs'][number]) =>
    j.active && j.last_run_status === 'succeeded' && j.last_run_at && Date.now() - new Date(j.last_run_at).getTime() < 1000 * 60 * 90; // within 90 min for an hourly job

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">System Health</h1>
          <p className="mt-1 text-sm text-ink/60">
            Every number here is a real check run right now — database stats, a live Edge Function ping, and actual
            cron job history. Nothing is a hardcoded green dot.
          </p>
        </div>
        <button
          onClick={runChecks}
          className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink/70 hover:border-accent hover:text-accent"
        >
          Re-check now
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}

      {!data ? (
        <p className="mt-6 text-sm text-ink/40">Running checks…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-6">
            <HealthCard
              title="Edge Functions"
              tone={edgeError ? 'danger' : 'success'}
              status={edgeError ? 'Unreachable' : `Responding (${edgeLatencyMs}ms)`}
            >
              {edgeError && <p className="mt-2 text-xs text-danger">{edgeError}</p>}
              <p className="mt-2 text-xs text-ink/50">Live round-trip to the health-check function, timed just now.</p>
            </HealthCard>

            <HealthCard title="Database" tone="success" status="Reachable">
              <Row label="Active connections">{data.database.active_connections}</Row>
              <Row label="Database size">{data.database.database_size_mb} MB</Row>
              <Row label="Oldest active transaction">{Math.round(data.database.oldest_active_transaction_seconds)}s</Row>
            </HealthCard>

            <HealthCard
              title="Realtime"
              tone={data.realtime.configured ? 'success' : 'danger'}
              status={data.realtime.configured ? 'Configured' : 'Not configured'}
            >
              <Row label="Tables broadcasting">{data.realtime.tables_enabled}</Row>
            </HealthCard>

            <HealthCard title="Storage" tone={data.storage.bucket_count > 0 ? 'success' : 'neutral'} status={`${data.storage.bucket_count} bucket(s)`}>
              {data.storage.note && <p className="mt-2 text-xs text-ink/50">{data.storage.note}</p>}
            </HealthCard>

            <HealthCard
              title="Payments"
              tone="neutral"
              status={`${data.payments.restaurants_with_active_provider}/${data.payments.total_restaurants} restaurants connected`}
            >
              {data.payments.recent_sample_size === 0 ? (
                <p className="mt-2 text-xs text-ink/50">No payments in the last 7 days.</p>
              ) : (
                <Row label="7-day success rate">{data.payments.recent_success_rate}%</Row>
              )}
            </HealthCard>

            <HealthCard
              title="Scheduled Jobs"
              tone={data.scheduled_jobs.every(jobIsHealthy) ? 'success' : 'warning'}
              status={`${data.scheduled_jobs.filter(jobIsHealthy).length}/${data.scheduled_jobs.length} healthy`}
            >
              {data.scheduled_jobs.map((j) => (
                <div key={j.jobname} className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-mono text-ink/70">{j.jobname}</span>
                  <Badge label={j.last_run_status ?? 'never run'} tone={jobIsHealthy(j) ? 'success' : 'warning'} />
                </div>
              ))}
            </HealthCard>
          </div>

          <p className="mt-4 text-xs text-ink/40">Last checked: {new Date(data.checked_at).toLocaleString()}</p>
        </>
      )}
    </div>
  );
}

function HealthCard({
  title,
  tone,
  status,
  children,
}: {
  title: string;
  tone: BadgeTone;
  status: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <Badge label={status} tone={tone} />
      </div>
      <div className="mt-3 space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink/50">{label}</span>
      <span className="font-medium text-ink">{children}</span>
    </div>
  );
}
