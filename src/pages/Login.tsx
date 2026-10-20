import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

function getResetRedirectUrl() {
  const base = window.location.pathname.startsWith('/master-dashboard') ? '/master-dashboard' : '';
  return `${window.location.origin}${base}/reset-password`;
}

export function Login() {
  const { user, loading, error, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      // error is already surfaced via useAuth().error
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    setResetError(null);
    setResetSent(false);
    if (!email.trim()) {
      setResetError('Enter your email address first.');
      return;
    }
    setSubmitting(true);
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getResetRedirectUrl(),
    });
    setSubmitting(false);
    if (requestError) {
      setResetError(requestError.message);
      return;
    }
    setResetSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-ink">Master Dashboard</h1>
        <p className="mt-1 text-sm text-ink/60">Platform administration. Not a restaurant login.</p>

        <label className="mt-6 block text-xs font-medium uppercase tracking-wide text-ink/50">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink/50">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        {resetError && <p className="mt-3 text-sm text-danger">{resetError}</p>}
        {resetSent && <p className="mt-3 text-sm text-emerald-600">If an account exists for this email, a password reset link has been sent. Check your inbox.</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? 'Please wait…' : 'Sign in'}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={handlePasswordReset}
          className="mt-4 w-full text-sm font-medium text-accent underline underline-offset-4 disabled:opacity-60"
        >
          Forgot password? Send reset email
        </button>
        <p className="mt-3 text-center text-xs text-ink/50">The email link will return to this Master Dashboard address.</p>
      </form>
    </div>
  );
}
