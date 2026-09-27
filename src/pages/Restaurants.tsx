import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Badge, restaurantStatusTone, subscriptionStatusTone } from '../components/Badge';

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  subscription_status: string | null;
  current_period_end: string | null;
  plan_name: string | null;
  payment_provider_name: string | null;
  payment_provider_active: boolean | null;
  staff_count: number;
  order_count: number;
  revenue: number;
  last_order_at: string | null;
}

function currency(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n) + ' EGP';
}

function relativeTime(iso: string | null) {
  if (!iso) return 'Never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

// Derived from real data, not a separate "issues" table -- the spec's own
// System Health section (59) says never hardcode fake indicators, so this
// only flags things we can actually verify from what's in the database.
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

export function Restaurants() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RestaurantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('get_platform_restaurants_overview').then(({ data, error: rpcError }) => {
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      setRows((data as RestaurantRow[]) ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Restaurants</h1>
          <p className="mt-1 text-sm text-ink/60">
            {rows ? `${rows.length} restaurant${rows.length === 1 ? '' : 's'} on the platform` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <Link
            to="/restaurants/new"
            className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
          >
            + Create Restaurant
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Couldn't load restaurants: {error}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3 font-medium">Restaurant</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Subscription</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Revenue</th>
                <th className="px-4 py-3 font-medium">Payment provider</th>
                <th className="px-4 py-3 font-medium">Staff</th>
                <th className="px-4 py-3 font-medium">Last activity</th>
                <th className="px-4 py-3 font-medium">Issues</th>
              </tr>
            </thead>
            <tbody>
              {!filtered && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-ink/40">
                    Loading…
                  </td>
                </tr>
              )}
              {filtered?.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-ink/40">
                    No restaurants match "{search}".
                  </td>
                </tr>
              )}
              {filtered?.map((r) => {
                const issues = issuesFor(r);
                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/restaurants/${r.id}`)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-canvas/40"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{r.name}</p>
                      <p className="text-xs text-ink/40">{r.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={r.status} tone={restaurantStatusTone(r.status)} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={r.subscription_status ?? 'none'} tone={subscriptionStatusTone(r.subscription_status)} />
                    </td>
                    <td className="px-4 py-3 text-ink/70">{r.plan_name ?? '—'}</td>
                    <td className="px-4 py-3 text-ink/70">{r.order_count}</td>
                    <td className="px-4 py-3 font-medium text-ink">{currency(r.revenue)}</td>
                    <td className="px-4 py-3 text-ink/70">{r.payment_provider_name ?? '—'}</td>
                    <td className="px-4 py-3 text-ink/70">{r.staff_count}</td>
                    <td className="px-4 py-3 text-ink/70">{relativeTime(r.last_order_at)}</td>
                    <td className="px-4 py-3">
                      {issues.length === 0 ? (
                        <span className="text-xs text-ink/30">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {issues.map((issue) => (
                            <Badge key={issue} label={issue} tone="danger" />
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-ink/40">Click a row to see full details. Lifecycle actions (suspend/reactivate) live there too.</p>
    </div>
  );
}
