import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Badge } from '../components/Badge';

interface FlagRow {
  id: string;
  feature_key: string;
  enabled: boolean;
  restaurant_id: string | null;
  plan_id: string | null;
  restaurant_name?: string;
  plan_name?: string;
}

interface PlanOption {
  id: string;
  name: string;
}

interface RestaurantOption {
  id: string;
  name: string;
}

type Scope = 'platform' | 'plan' | 'restaurant';

export function FeatureFlags() {
  const [flags, setFlags] = useState<FlagRow[] | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newKey, setNewKey] = useState('');
  const [newScope, setNewScope] = useState<Scope>('platform');
  const [newTargetId, setNewTargetId] = useState('');
  const [newEnabled, setNewEnabled] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [{ data: flagRows, error: flagError }, { data: planRows }, { data: restRows }] = await Promise.all([
      supabase.from('feature_flags').select('id, feature_key, enabled, restaurant_id, plan_id').order('feature_key'),
      supabase.from('plans').select('id, name'),
      supabase.from('restaurants').select('id, name').is('deleted_at', null),
    ]);
    if (flagError) setError(flagError.message);

    const planMap = new Map((planRows ?? []).map((p) => [p.id, p.name]));
    const restMap = new Map((restRows ?? []).map((r) => [r.id, r.name]));

    setFlags(
      (flagRows ?? []).map((f) => ({
        ...f,
        plan_name: f.plan_id ? planMap.get(f.plan_id) : undefined,
        restaurant_name: f.restaurant_id ? restMap.get(f.restaurant_id) : undefined,
      }))
    );
    setPlans((planRows as PlanOption[]) ?? []);
    setRestaurants((restRows as RestaurantOption[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFlag(flag: FlagRow) {
    await supabase.from('feature_flags').update({ enabled: !flag.enabled }).eq('id', flag.id);
    load();
  }

  async function deleteFlag(flag: FlagRow) {
    await supabase.from('feature_flags').delete().eq('id', flag.id);
    load();
  }

  async function createFlag() {
    if (!newKey.trim()) return;
    if (newScope !== 'platform' && !newTargetId) return;

    setCreating(true);
    setError(null);
    const { error: insertError } = await supabase.from('feature_flags').insert({
      feature_key: newKey.trim().toLowerCase().replace(/\s+/g, '_'),
      enabled: newEnabled,
      plan_id: newScope === 'plan' ? newTargetId : null,
      restaurant_id: newScope === 'restaurant' ? newTargetId : null,
    });
    setCreating(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewKey('');
    setNewTargetId('');
    load();
  }

  function scopeLabel(f: FlagRow) {
    if (f.restaurant_id) return `Restaurant: ${f.restaurant_name ?? f.restaurant_id}`;
    if (f.plan_id) return `Plan: ${f.plan_name ?? f.plan_id}`;
    return 'Platform-wide';
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Feature Flags</h1>
      <p className="mt-1 text-sm text-ink/60">
        Three levels, checked in this order: a restaurant-specific override beats its plan's default, which beats the
        platform-wide default. A flag nobody set is off. Call{' '}
        <span className="font-mono text-xs">get_feature_flag(restaurant_id, feature_key)</span> from any app to resolve
        it the same way everywhere, instead of re-implementing this priority per-app.
      </p>

      {error && <div className="mt-4 rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3 font-medium">Feature Key</th>
              <th className="px-4 py-3 font-medium">Scope</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {!flags && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink/40">
                  Loading…
                </td>
              </tr>
            )}
            {flags?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink/40">
                  No feature flags yet. Every feature is off by default until one is added below.
                </td>
              </tr>
            )}
            {flags?.map((f) => (
              <tr key={f.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-mono text-ink">{f.feature_key}</td>
                <td className="px-4 py-3 text-ink/70">{scopeLabel(f)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleFlag(f)}>
                    <Badge label={f.enabled ? 'enabled' : 'disabled'} tone={f.enabled ? 'success' : 'neutral'} />
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deleteFlag(f)} className="text-xs text-ink/40 hover:text-danger">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-line p-5">
        <h2 className="text-sm font-semibold text-ink">Add a flag</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            placeholder="feature_key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="w-48 rounded-lg border border-line bg-canvas px-3 py-2 text-sm font-mono outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <select
            value={newScope}
            onChange={(e) => {
              setNewScope(e.target.value as Scope);
              setNewTargetId('');
            }}
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="platform">Platform-wide</option>
            <option value="plan">For a specific plan…</option>
            <option value="restaurant">For a specific restaurant…</option>
          </select>
          {newScope === 'plan' && (
            <select
              value={newTargetId}
              onChange={(e) => setNewTargetId(e.target.value)}
              className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            >
              <option value="">Choose plan…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {newScope === 'restaurant' && (
            <select
              value={newTargetId}
              onChange={(e) => setNewTargetId(e.target.value)}
              className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            >
              <option value="">Choose restaurant…</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input type="checkbox" checked={newEnabled} onChange={(e) => setNewEnabled(e.target.checked)} />
            Enabled
          </label>
          <button
            onClick={createFlag}
            disabled={creating || !newKey.trim() || (newScope !== 'platform' && !newTargetId)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {creating ? 'Adding…' : 'Add Flag'}
          </button>
        </div>
      </div>
    </div>
  );
}
