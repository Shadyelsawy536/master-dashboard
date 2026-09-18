import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface PlanRow {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  is_active: boolean;
  sort_order: number;
}

interface FeatureRow {
  plan_id: string;
  feature_key: string;
  enabled: boolean;
}

export function Subscriptions() {
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [newFeatureKey, setNewFeatureKey] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [newPlan, setNewPlan] = useState({ name: '', slug: '', price_monthly: '', price_yearly: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [{ data: planRows, error: planError }, { data: featureRows }] = await Promise.all([
      supabase.from('plans').select('id, name, slug, price_monthly, price_yearly, is_active, sort_order').order('sort_order'),
      supabase.from('plan_features').select('plan_id, feature_key, enabled'),
    ]);
    if (planError) setError(planError.message);
    setPlans((planRows as PlanRow[]) ?? []);
    setFeatures((featureRows as FeatureRow[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The full set of feature keys used by ANY plan -- this is the checklist
  // shown for every plan, not a separate hardcoded list, so a feature key
  // typed in for one plan immediately becomes toggleable for the others too.
  const allFeatureKeys = Array.from(new Set(features.map((f) => f.feature_key))).sort();

  async function toggleFeature(planId: string, featureKey: string, enabled: boolean) {
    const existing = features.find((f) => f.plan_id === planId && f.feature_key === featureKey);
    if (existing) {
      await supabase.from('plan_features').update({ enabled }).eq('plan_id', planId).eq('feature_key', featureKey);
    } else {
      await supabase.from('plan_features').insert({ plan_id: planId, feature_key: featureKey, enabled });
    }
    load();
  }

  async function addFeatureKey(planId: string) {
    const key = (newFeatureKey[planId] ?? '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!key) return;
    await supabase.from('plan_features').insert({ plan_id: planId, feature_key: key, enabled: true });
    setNewFeatureKey((prev) => ({ ...prev, [planId]: '' }));
    load();
  }

  async function togglePlanActive(plan: PlanRow) {
    await supabase.from('plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
    load();
  }

  async function updatePrice(plan: PlanRow, field: 'price_monthly' | 'price_yearly', value: string) {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    await supabase.from('plans').update({ [field]: num }).eq('id', plan.id);
    load();
  }

  async function createPlan() {
    setCreating(true);
    setError(null);
    const slug = newPlan.slug.trim() || newPlan.name.trim().toLowerCase().replace(/\s+/g, '-');
    const { error: insertError } = await supabase.from('plans').insert({
      name: newPlan.name.trim(),
      slug,
      price_monthly: Number(newPlan.price_monthly) || 0,
      price_yearly: Number(newPlan.price_yearly) || 0,
      is_active: true,
      sort_order: (plans?.length ?? 0) + 1,
    });
    setCreating(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewPlan({ name: '', slug: '', price_monthly: '', price_yearly: '' });
    load();
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Subscriptions & Plans</h1>
      <p className="mt-1 text-sm text-ink/60">
        Manage the plan catalog here. Per-restaurant actions — extend trial, change plan, cancel — live on each
        restaurant's own Details page.
      </p>

      {error && <div className="mt-4 rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="mt-6 space-y-4">
        {!plans && <p className="text-sm text-ink/40">Loading…</p>}
        {plans?.map((plan) => (
          <div key={plan.id} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-semibold text-ink">{plan.name}</h2>
                <span className="text-xs text-ink/40">/{plan.slug}</span>
              </div>
              <button
                onClick={() => togglePlanActive(plan)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  plan.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {plan.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>

            <div className="mt-3 flex gap-6 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-ink/50">Monthly (EGP)</span>
                <input
                  type="number"
                  defaultValue={plan.price_monthly}
                  onBlur={(e) => updatePrice(plan, 'price_monthly', e.target.value)}
                  className="w-24 rounded-lg border border-line bg-canvas px-2 py-1 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-ink/50">Yearly (EGP)</span>
                <input
                  type="number"
                  defaultValue={plan.price_yearly}
                  onBlur={(e) => updatePrice(plan, 'price_yearly', e.target.value)}
                  className="w-24 rounded-lg border border-line bg-canvas px-2 py-1 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </label>
            </div>

            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink/40">Features</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {allFeatureKeys.map((key) => {
                const enabled = features.some((f) => f.plan_id === plan.id && f.feature_key === key && f.enabled);
                return (
                  <button
                    key={key}
                    onClick={() => toggleFeature(plan.id, key, !enabled)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      enabled ? 'border-accent bg-accent/10 text-accent' : 'border-line text-ink/40 hover:text-ink/70'
                    }`}
                  >
                    {key}
                  </button>
                );
              })}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="new feature key…"
                  value={newFeatureKey[plan.id] ?? ''}
                  onChange={(e) => setNewFeatureKey((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addFeatureKey(plan.id)}
                  className="w-32 rounded-full border border-dashed border-line px-3 py-1 text-xs outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-line p-5">
        <h2 className="text-sm font-semibold text-ink">Add a plan</h2>
        <div className="mt-3 grid grid-cols-4 gap-3">
          <input
            placeholder="Name"
            value={newPlan.name}
            onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))}
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <input
            placeholder="Slug (optional)"
            value={newPlan.slug}
            onChange={(e) => setNewPlan((p) => ({ ...p, slug: e.target.value }))}
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm font-mono outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <input
            type="number"
            placeholder="Price / mo"
            value={newPlan.price_monthly}
            onChange={(e) => setNewPlan((p) => ({ ...p, price_monthly: e.target.value }))}
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <input
            type="number"
            placeholder="Price / yr"
            value={newPlan.price_yearly}
            onChange={(e) => setNewPlan((p) => ({ ...p, price_yearly: e.target.value }))}
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <button
          onClick={createPlan}
          disabled={creating || !newPlan.name.trim()}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {creating ? 'Adding…' : 'Add Plan'}
        </button>
      </div>
    </div>
  );
}
