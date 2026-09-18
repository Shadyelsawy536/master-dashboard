import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Badge, restaurantStatusTone, subscriptionStatusTone } from '../components/Badge';

interface Details {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logo_url: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    status: string;
    created_at: string;
  };
  subscription: {
    status: string;
    current_period_start: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    plan_name: string | null;
    plan_slug: string | null;
    plan_price_monthly: number | null;
  } | null;
  payment_provider: { name: string; is_active: boolean; connected_since: string } | null;
  stats: { order_count: number; revenue: number; last_order_at: string | null; customer_count: number };
  staff: { id: string; email: string; full_name: string; role_name: string | null; joined_at: string }[];
  recent_activity: { action: string; entity_type: string; metadata: unknown; created_at: string; actor_email: string | null }[];
}

interface DomainRow {
  id: string;
  domain: string;
  verification_token: string;
  verified: boolean;
  verified_at: string | null;
}

const STATUS_OPTIONS = ['trial', 'active', 'suspended', 'inactive'] as const;

interface PlanOption {
  id: string;
  name: string;
}

function currency(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n) + ' EGP';
}

export function RestaurantDetails() {
  const { id } = useParams<{ id: string }>();
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [reason, setReason] = useState('');

  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [extendDays, setExtendDays] = useState('7');
  const [subActionBusy, setSubActionBusy] = useState(false);
  const [subMessage, setSubMessage] = useState<string | null>(null);

  const [domains, setDomains] = useState<DomainRow[] | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [domainMessages, setDomainMessages] = useState<Record<string, string>>({});

  const loadDomains = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('custom_domains')
      .select('id, domain, verification_token, verified, verified_at')
      .eq('restaurant_id', id)
      .order('created_at');
    setDomains((data as DomainRow[]) ?? []);
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error: rpcError } = await supabase.rpc('get_restaurant_details', { p_restaurant_id: id });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setDetails(data as Details);
  }, [id]);

  useEffect(() => {
    load();
    loadDomains();
    supabase
      .from('plans')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setPlans((data as PlanOption[]) ?? []));
  }, [load, loadDomains]);

  async function addDomain() {
    if (!id || !newDomain.trim()) return;
    setAddingDomain(true);
    const { error: insertError } = await supabase
      .from('custom_domains')
      .insert({ restaurant_id: id, domain: newDomain.trim().toLowerCase() });
    setAddingDomain(false);
    if (insertError) {
      setDomainMessages((prev) => ({ ...prev, new: insertError.message }));
      return;
    }
    setNewDomain('');
    loadDomains();
  }

  async function verifyDomain(domainId: string) {
    setVerifyingId(domainId);
    setDomainMessages((prev) => ({ ...prev, [domainId]: '' }));
    const { data, error: invokeError } = await supabase.functions.invoke('verify-domain', {
      body: { domainId },
    });
    setVerifyingId(null);

    if (invokeError) {
      let message = invokeError.message;
      if (invokeError instanceof FunctionsHttpError) {
        try {
          message = (await invokeError.context.json())?.error ?? message;
        } catch {
          // fall back to generic message
        }
      }
      setDomainMessages((prev) => ({ ...prev, [domainId]: message }));
      return;
    }

    if (data?.verified) {
      setDomainMessages((prev) => ({ ...prev, [domainId]: 'Verified!' }));
      loadDomains();
    } else {
      setDomainMessages((prev) => ({
        ...prev,
        [domainId]: `Not verified yet -- TXT record not found. Add "${data?.expectedRecord?.host}" = "${data?.expectedRecord?.value}" and try again.`,
      }));
    }
  }

  async function removeDomain(domainId: string) {
    if (!confirm('Remove this domain?')) return;
    await supabase.from('custom_domains').delete().eq('id', domainId);
    loadDomains();
  }

  async function runSubscriptionAction(fn: () => Promise<{ error: { message: string } | null }>) {
    setSubActionBusy(true);
    setSubMessage(null);
    const { error: rpcError } = await fn();
    setSubActionBusy(false);
    if (rpcError) {
      setSubMessage(rpcError.message);
      return;
    }
    setSubMessage('Done.');
    load();
  }

  async function extendTrial() {
    const days = Number(extendDays);
    if (!id || !days || days <= 0) return;
    await runSubscriptionAction(() => supabase.rpc('extend_subscription', { p_restaurant_id: id, p_days: days }));
  }

  async function changePlan() {
    if (!id || !selectedPlanId) return;
    await runSubscriptionAction(() =>
      supabase.rpc('change_subscription_plan', { p_restaurant_id: id, p_plan_id: selectedPlanId })
    );
  }

  async function cancelSubscription(immediately: boolean) {
    if (!id) return;
    if (!confirm(immediately ? 'Cancel and suspend this restaurant immediately?' : 'Stop renewal at period end?')) return;
    await runSubscriptionAction(() =>
      supabase.rpc('cancel_subscription', { p_restaurant_id: id, p_immediately: immediately, p_reason: reason || null })
    );
  }

  async function changeStatus(status: (typeof STATUS_OPTIONS)[number]) {
    if (!id) return;
    setChangingStatus(true);
    const { error: rpcError } = await supabase.rpc('set_restaurant_status', {
      p_restaurant_id: id,
      p_status: status,
      p_reason: reason.trim() || null,
    });
    setChangingStatus(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setReason('');
    load();
  }

  if (error) {
    return (
      <div className="p-8">
        <Link to="/restaurants" className="text-sm text-accent hover:underline">
          ← Back to Restaurants
        </Link>
        <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
      </div>
    );
  }

  if (!details) return <div className="p-8 text-sm text-ink/50">Loading…</div>;

  const { restaurant, subscription, payment_provider, stats, staff, recent_activity } = details;

  return (
    <div className="p-8">
      <Link to="/restaurants" className="text-sm text-accent hover:underline">
        ← Back to Restaurants
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-ink">{restaurant.name}</h1>
            <Badge label={restaurant.status} tone={restaurantStatusTone(restaurant.status)} />
          </div>
          <p className="mt-1 text-sm text-ink/50">
            /{restaurant.slug} · created {new Date(restaurant.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard label="Orders" value={String(stats.order_count)} />
        <StatCard label="Revenue" value={currency(stats.revenue)} />
        <StatCard label="Customers" value={String(stats.customer_count)} />
        <StatCard label="Last order" value={stats.last_order_at ? new Date(stats.last_order_at).toLocaleDateString() : 'Never'} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        {/* Subscription */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Subscription</h2>
          {!subscription ? (
            <p className="mt-3 text-sm text-ink/50">No subscription on record.</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <Row label="Status">
                <Badge label={subscription.status} tone={subscriptionStatusTone(subscription.status)} />
              </Row>
              <Row label="Plan">{subscription.plan_name ?? '—'}</Row>
              <Row label="Price">{subscription.plan_price_monthly != null ? currency(subscription.plan_price_monthly) + '/mo' : '—'}</Row>
              <Row label="Current period ends">
                {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—'}
              </Row>
              <Row label="Cancels at period end">{subscription.cancel_at_period_end ? 'Yes' : 'No'}</Row>
            </div>
          )}
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
                className="w-16 rounded-lg border border-line bg-canvas px-2 py-1 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
              <span className="text-xs text-ink/50">days</span>
              <button
                onClick={extendTrial}
                disabled={subActionBusy}
                className="ml-auto rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-accent hover:text-accent disabled:opacity-40"
              >
                Extend
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="flex-1 rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              >
                <option value="">Change plan to…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={changePlan}
                disabled={subActionBusy || !selectedPlanId}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-accent hover:text-accent disabled:opacity-40"
              >
                Apply
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => cancelSubscription(false)}
                disabled={subActionBusy}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-warning hover:text-warning disabled:opacity-40"
              >
                Cancel at period end
              </button>
              <button
                onClick={() => cancelSubscription(true)}
                disabled={subActionBusy}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-danger hover:text-danger disabled:opacity-40"
              >
                Cancel immediately
              </button>
            </div>
            {subMessage && <p className="text-xs text-ink/50">{subMessage}</p>}
          </div>
        </div>

        {/* Payment provider */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Payment Provider</h2>
          {!payment_provider ? (
            <p className="mt-3 text-sm text-ink/50">No active payment provider connected.</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <Row label="Provider">{payment_provider.name}</Row>
              <Row label="Active">{payment_provider.is_active ? 'Yes' : 'No'}</Row>
              <Row label="Connected since">{new Date(payment_provider.connected_since).toLocaleDateString()}</Row>
            </div>
          )}
        </div>

        {/* Domains */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Domains</h2>
          <p className="mt-1 text-xs text-ink/50">
            Default: <span className="font-mono">{restaurant.slug}.&lt;platform-domain&gt;</span>. Custom domains need DNS
            verification before they'd ever be routed — not wired into the website yet, this just tracks and verifies
            ownership.
          </p>

          <div className="mt-3 space-y-2">
            {domains === null && <p className="text-sm text-ink/40">Loading…</p>}
            {domains?.length === 0 && <p className="text-sm text-ink/40">No custom domains added.</p>}
            {domains?.map((d) => (
              <div key={d.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-ink">{d.domain}</span>
                    <Badge label={d.verified ? 'verified' : 'unverified'} tone={d.verified ? 'success' : 'warning'} />
                  </div>
                  <div className="flex items-center gap-2">
                    {!d.verified && (
                      <button
                        onClick={() => verifyDomain(d.id)}
                        disabled={verifyingId === d.id}
                        className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-ink/70 hover:border-accent hover:text-accent disabled:opacity-40"
                      >
                        {verifyingId === d.id ? 'Checking…' : 'Verify'}
                      </button>
                    )}
                    <button onClick={() => removeDomain(d.id)} className="text-xs text-ink/40 hover:text-danger">
                      Remove
                    </button>
                  </div>
                </div>
                {!d.verified && (
                  <p className="mt-2 text-xs text-ink/50">
                    Add a TXT record: <span className="font-mono">_platform-verify.{d.domain}</span> ={' '}
                    <span className="font-mono">{d.verification_token}</span>
                  </p>
                )}
                {domainMessages[d.id] && <p className="mt-1 text-xs text-accent">{domainMessages[d.id]}</p>}
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              placeholder="www.example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm font-mono outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={addDomain}
              disabled={addingDomain || !newDomain.trim()}
              className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink/70 hover:border-accent hover:text-accent disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {domainMessages.new && <p className="mt-1 text-xs text-danger">{domainMessages.new}</p>}
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Staff ({staff.length})</h2>
          {staff.length === 0 ? (
            <p className="mt-3 text-sm text-ink/50">No staff linked to this restaurant.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {staff.map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  <span className="text-ink">{s.full_name || s.email}</span>
                  <span className="text-xs text-ink/40">{s.role_name ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tenant status control */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Tenant Status</h2>
          <p className="mt-1 text-xs text-ink/50">
            Changing this immediately affects what the restaurant's staff and customers can do — enforced server-side, not
            just hidden in the UI.
          </p>
          <input
            type="text"
            placeholder="Reason (optional, goes into the audit log)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-3 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                disabled={changingStatus || status === restaurant.status}
                onClick={() => changeStatus(status)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold capitalize text-ink/70 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Recent Activity (audit log)</h2>
        {recent_activity.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">No audit log entries for this restaurant yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {recent_activity.map((entry, i) => (
              <li key={i} className="flex items-center justify-between border-b border-line pb-2 last:border-0">
                <span className="text-ink">
                  {entry.action} <span className="text-ink/40">({entry.entity_type})</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-ink/40">
                  {entry.actor_email ?? 'system'} · {new Date(entry.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
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
