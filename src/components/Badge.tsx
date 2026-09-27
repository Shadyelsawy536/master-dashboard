export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}

export function restaurantStatusTone(status: string): BadgeTone {
  if (status === 'active') return 'success';
  if (status === 'trial') return 'warning';
  if (status === 'suspended' || status === 'inactive') return 'danger';
  return 'neutral';
}

export function subscriptionStatusTone(status: string | null): BadgeTone {
  if (!status) return 'neutral';
  if (status === 'active' || status === 'trial') return 'success';
  if (status === 'past_due') return 'warning';
  if (status === 'expired' || status === 'suspended' || status === 'cancelled') return 'danger';
  return 'neutral';
}
