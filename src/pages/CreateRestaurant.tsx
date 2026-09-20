import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface PlanRow {
  id: string;
  name: string;
  price_monthly: number;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateRestaurant() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanRow[] | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [planId, setPlanId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#8B4513');
  const [secondaryColor, setSecondaryColor] = useState('#F5E6D3');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('plans')
      .select('id, name, price_monthly')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setPlans((data as PlanRow[]) ?? []);
        if (data?.length) setPlanId(data[0].id);
      });
  }, []);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setWarning(null);

    const { data, error: invokeError } = await supabase.functions.invoke('create-restaurant', {
      body: {
        name,
        slug,
        planId,
        adminEmail,
        logoUrl: logoUrl.trim() || undefined,
        primaryColor,
        secondaryColor,
      },
    });

    setSubmitting(false);

    if (invokeError) {
      // supabase-js only populates `data` for 2xx responses. For a non-2xx
      // status (400/403/500 here), the actual JSON body we returned -- with
      // our specific error message -- lives on error.context (a Response),
      // and has to be parsed out manually or the user just sees a generic
      // "non-2xx status" message instead of the real reason.
      let message = invokeError.message;
      if (invokeError instanceof FunctionsHttpError) {
        try {
          const body = await invokeError.context.json();
          message = body?.error ?? message;
        } catch {
          // context wasn't JSON -- fall back to the generic message.
        }
      }
      setError(message);
      return;
    }

    if (data?.success) {
      navigate(`/restaurants/${data.restaurantId}`);
      return;
    }

    // 207-style partial success: restaurant exists, admin invite/link failed.
    if (data?.restaurantId) {
      setWarning(data.error ?? 'Restaurant created, but something after that failed.');
      return;
    }

    setError(data?.error ?? 'Something went wrong.');
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Create Restaurant</h1>
      <p className="mt-1 text-sm text-ink/60">
        This creates the restaurant, its settings, branding, a 14-day trial subscription, and an Owner role with full
        permissions — all in one step — then invites the admin by email.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <label className="block text-xs font-medium uppercase tracking-wide text-ink/50">Restaurant Name</label>
        <input
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink/50">Slug</label>
        <input
          required
          pattern="[a-z0-9-]+"
          title="Lowercase letters, numbers, and hyphens only"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm font-mono outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <p className="mt-1 text-xs text-ink/40">Used in the customer website URL and Flutter app tenant config.</p>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink/50">Admin Email</label>
        <input
          type="email"
          required
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <p className="mt-1 text-xs text-ink/40">
          They'll get an invite email and become the restaurant's Owner (full staff-side permissions).
        </p>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink/50">Plan</label>
        <select
          required
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          {!plans && <option>Loading…</option>}
          {plans?.length === 0 && <option value="">No active plans configured</option>}
          {plans?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.price_monthly} EGP/mo
            </option>
          ))}
        </select>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-ink/50">Primary Color</label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-line"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-ink/50">Secondary Color</label>
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-line"
            />
          </div>
        </div>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink/50">Logo URL (optional)</label>
        <input
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <p className="mt-1 text-xs text-ink/40">
          Payment provider setup is a separate step — Payment Monitoring, once it's built.
        </p>

        {error && <p className="mt-4 rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
        {warning && <p className="mt-4 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{warning}</p>}

        <button
          type="submit"
          disabled={submitting || !plans?.length}
          className="mt-6 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create Restaurant'}
        </button>
      </form>
    </div>
  );
}
