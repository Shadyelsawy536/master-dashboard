import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface LogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  actor_email: string | null;
}

interface RestaurantOption {
  id: string;
  name: string;
}

const ACTIONS = [
  'restaurant.created',
  'restaurant.status_changed',
  'subscription.extended',
  'subscription.plan_changed',
  'subscription.cancelled',
];

export function AuditLogs() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantFilter, setRestaurantFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('get_audit_logs', {
      p_restaurant_id: restaurantFilter || null,
      p_action: actionFilter || null,
      p_limit: 200,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setLogs(data as LogRow[]);
  }, [restaurantFilter, actionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
      .then(({ data }) => setRestaurants((data as RestaurantOption[]) ?? []));
  }, []);

  function describeMetadata(log: LogRow) {
    if (!log.metadata) return null;
    const entries = Object.entries(log.metadata).filter(([, v]) => v !== null && v !== undefined);
    if (entries.length === 0) return null;
    return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ');
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Audit Logs</h1>
      <p className="mt-1 text-sm text-ink/60">
        Who did what, when, and to which restaurant — every write action across the platform, not modifiable from
        anywhere in this dashboard.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={restaurantFilter}
          onChange={(e) => setRestaurantFilter(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="">All restaurants</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        {(restaurantFilter || actionFilter) && (
          <button
            onClick={() => {
              setRestaurantFilter('');
              setActionFilter('');
            }}
            className="text-xs text-ink/40 hover:text-ink"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Restaurant</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {!logs && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink/40">
                  Loading…
                </td>
              </tr>
            )}
            {logs?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink/40">
                  No matching log entries.
                </td>
              </tr>
            )}
            {logs?.map((log) => (
              <tr key={log.id} className="border-b border-line align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-ink/60">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-ink/70">{log.actor_email ?? 'system'}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink">{log.action}</td>
                <td className="px-4 py-3">
                  {log.restaurant_id ? (
                    <Link to={`/restaurants/${log.restaurant_id}`} className="text-accent hover:underline">
                      {log.restaurant_name ?? log.restaurant_id}
                    </Link>
                  ) : (
                    <span className="text-ink/30">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink/50">{describeMetadata(log) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
