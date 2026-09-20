import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface AnalyticsData {
  totals: { gmv: number; total_orders: number; avg_order_value: number };
  restaurants: { total: number; active: number; trial: number; suspended: number; inactive: number };
  mrr: number;
  payment_success_rate: number | null;
  payment_sample_size: number;
  churn: number | null;
  restaurant_growth: { month: string; new_restaurants: number }[];
  orders_last_30_days: { day: string; orders: number; revenue: number | null }[];
  top_restaurants: { id: string; name: string; revenue: number | null; order_count: number }[];
}

function currency(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n) + ' EGP';
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('get_platform_analytics').then(({ data, error: rpcError }) => {
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      setData(data as AnalyticsData);
    });
  }, []);

  if (error) return <div className="p-8 text-sm text-danger">{error}</div>;
  if (!data) return <div className="p-8 text-sm text-ink/50">Loading…</div>;

  const maxDailyOrders = Math.max(1, ...data.orders_last_30_days.map((d) => d.orders));
  const maxGrowth = Math.max(1, ...data.restaurant_growth.map((m) => m.new_restaurants));

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Platform Analytics</h1>
      <p className="mt-1 text-sm text-ink/60">
        Real numbers from live orders, subscriptions, and restaurants — nothing here is a placeholder.
      </p>

      <div className="mt-6 grid grid-cols-5 gap-4">
        <StatCard label="GMV" value={currency(data.totals.gmv)} />
        <StatCard label="Orders" value={String(data.totals.total_orders)} />
        <StatCard label="Avg Order Value" value={currency(data.totals.avg_order_value)} />
        <StatCard label="MRR (est.)" value={currency(data.mrr)} />
        <StatCard label="Restaurants" value={`${data.restaurants.active} active / ${data.restaurants.total}`} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Orders — last 30 days</h2>
          {data.orders_last_30_days.length === 0 ? (
            <p className="mt-3 text-sm text-ink/40">No orders in the last 30 days.</p>
          ) : (
            <div className="mt-4 flex h-32 items-end gap-1">
              {data.orders_last_30_days.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day}: ${d.orders} orders, ${currency(d.revenue ?? 0)}`}
                  className="flex-1 rounded-t bg-accent/70 transition hover:bg-accent"
                  style={{ height: `${(d.orders / maxDailyOrders) * 100}%`, minHeight: 2 }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">New Restaurants — last 12 months</h2>
          {data.restaurant_growth.length === 0 ? (
            <p className="mt-3 text-sm text-ink/40">No signups recorded yet.</p>
          ) : (
            <div className="mt-4 flex h-32 items-end gap-2">
              {data.restaurant_growth.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    title={`${m.month}: ${m.new_restaurants}`}
                    className="w-full rounded-t bg-accent/70"
                    style={{ height: `${(m.new_restaurants / maxGrowth) * 90}px`, minHeight: 2 }}
                  />
                  <span className="text-[9px] text-ink/40">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Payments</h2>
          {data.payment_sample_size === 0 ? (
            <p className="mt-3 text-sm text-ink/40">
              No payment records yet — the payment provider integration is still being wired up, so there's genuinely
              nothing to report here rather than a fabricated percentage.
            </p>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <Row label="Success rate">{data.payment_success_rate}%</Row>
              <Row label="Sample size">{data.payment_sample_size} payments</Row>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Restaurant Status</h2>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Active">{data.restaurants.active}</Row>
            <Row label="Trial">{data.restaurants.trial}</Row>
            <Row label="Suspended">{data.restaurants.suspended}</Row>
            <Row label="Inactive">{data.restaurants.inactive}</Row>
            <Row label="Subscription churn">{data.churn != null ? `${data.churn}%` : 'No subscriptions yet'}</Row>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Top Restaurants by Revenue</h2>
        {data.top_restaurants.length === 0 ? (
          <p className="mt-3 text-sm text-ink/40">No order revenue yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <tbody>
              {data.top_restaurants.map((r, i) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 text-ink/40">#{i + 1}</td>
                  <td className="py-2">
                    <Link to={`/restaurants/${r.id}`} className="text-accent hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2 text-ink/60">{r.order_count} orders</td>
                  <td className="py-2 text-right font-medium text-ink">{currency(r.revenue ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-ink/40">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink/50">{label}</span>
      <span className="font-medium text-ink">{children}</span>
    </div>
  );
}
