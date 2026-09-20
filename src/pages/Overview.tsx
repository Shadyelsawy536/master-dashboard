import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Badge } from '../components/Badge';

interface RestaurantRow {
  id: string;
  name: string;
  status: string;
  subscription_status: string | null;
  payment_provider_name: string | null;
  payment_provider_active: boolean | null;
  staff_count: number;
}

interface AnalyticsData {
  totals: { gmv: number; total_orders: number };
  mrr: number;
  orders_last_30_days: { day: string; orders: number; revenue: number | null }[];
}

interface HealthData {
  scheduled_jobs: { jobname: string; active: boolean; last_run_status: string | null; last_run_at: string | null }[];
  realtime: { configured: boolean };
}

interface LogRow {
  id: string;
  action: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  actor_email: string | null;
  created_at: string;
}

function currency(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n) + ' EGP';
}

// Same derivation Restaurants.tsx uses -- kept here too rather than a new
// RPC, since it's cheap to compute from data already being fetched anyway.
function issuesFor(r: RestaurantRow): string[] {
  const issues: string[] = [];
  if (!r.subscription_status) issues.push('No subscription');
  else if (['past_due', 'expired', 'suspended', 'cancelled'].includes(r.subscription_status)) {
    issues.push(`Subscription ${r.subscription_status.replace('_', ' ')}`);
  }
  if (!r.payment_provider_name || r.payment_provider_active === false) issues.push('No active payment provider');
  if (r.staff_count === 0) issues.push('No staff assigned');
  return issues;
}

export function Overview() {
  const [restaurants, setRestaurants] = useState<RestaurantRow[] | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [logs, setLogs] = useState<LogRow[] | null>(null);

  useEffect(() => {
    supabase.rpc('get_platform_restaurants_overview').then(({ data }) => setRestaurants((data as RestaurantRow[]) ?? []));
    supabase.rpc('get_platform_analytics').then(({ data }) => setAnalytics(data as AnalyticsData));
    supabase.rpc('get_system_health').then(({ data }) => setHealth(data as HealthData));
    supabase.rpc('get_audit_logs', { p_restaurant_id: null, p_action: null, p_limit: 8 }).then(({ data }) => setLogs(data as LogRow[]));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayRow = analytics?.orders_last_30_days.find((d) => d.day === today);
  const attention = restaurants?.map((r) => ({ r, issues: issuesFor(r) })).filter((x) => x.issues.length > 0).slice(0, 5);

  const jobIsHealthy = (j: HealthData['scheduled_jobs'][number]) =>
    j.active && j.last_run_status === 'succeeded' && j.last_run_at && Date.now() - new Date(j.last_run_at).getTime() < 1000 * 60 * 90;

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Overview</h1>
      <p className="mt-1 text-sm text-ink/60">The whole platform, at a glance.</p>

      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard
          label="Restaurants"
          value={restaurants ? String(restaurants.length) : '—'}
          sub={restaurants ? `${restaurants.filter((r) => r.status === 'active').length} active` : undefined}
        />
        <StatCard label="Orders Today" value={todayRow ? String(todayRow.orders) : '0'} />
        <StatCard label="GMV (all time)" value={analytics ? currency(analytics.totals.gmv) : '—'} />
        <StatCard label="MRR (est.)" value={analytics ? currency(analytics.mrr) : '—'} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-6">
        {/* Needs attention */}
        <div className="col-span-2 rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Needs Attention</h2>
            <Link to="/restaurants" className="text-xs text-accent hover:underline">
              View all restaurants
            </Link>
          </div>
          {!attention ? (
            <p className="mt-3 text-sm text-ink/40">Loading…</p>
          ) : attention.length === 0 ? (
            <p className="mt-3 text-sm text-ink/40">Nothing needs attention right now.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {attention.map(({ r, issues }) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                  <Link to={`/restaurants/${r.id}`} className="font-medium text-ink hover:text-accent">
                    {r.name}
                  </Link>
                  <div className="flex flex-wrap justify-end gap-1">
                    {issues.map((issue) => (
                      <Badge key={issue} label={issue} tone="danger" />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* System status strip */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">System Status</h2>
            <Link to="/system-health" className="text-xs text-accent hover:underline">
              Details
            </Link>
          </div>
          {!health ? (
            <p className="mt-3 text-sm text-ink/40">Loading…</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink/50">Realtime</span>
                <Badge label={health.realtime.configured ? 'ok' : 'down'} tone={health.realtime.configured ? 'success' : 'danger'} />
              </div>
              {health.scheduled_jobs.map((j) => (
                <div key={j.jobname} className="flex items-center justify-between">
                  <span className="font-mono text-xs text-ink/50">{j.jobname}</span>
                  <Badge label={j.last_run_status ?? 'never run'} tone={jobIsHealthy(j) ? 'success' : 'warning'} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Recent Activity</h2>
          <Link to="/audit-logs" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        {!logs ? (
          <p className="mt-3 text-sm text-ink/40">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="mt-3 text-sm text-ink/40">No activity yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between border-b border-line pb-2 last:border-0">
                <span className="text-ink">
                  <span className="font-mono text-xs">{log.action}</span>
                  {log.restaurant_name && (
                    <>
                      {' — '}
                      <Link to={`/restaurants/${log.restaurant_id}`} className="text-accent hover:underline">
                        {log.restaurant_name}
                      </Link>
                    </>
                  )}
                </span>
                <span className="text-xs text-ink/40">{new Date(log.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-ink/40">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
      {sub && <p className="text-xs text-ink/40">{sub}</p>}
    </div>
  );
}
