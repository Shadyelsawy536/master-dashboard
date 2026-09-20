import { useCallback, useEffect, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PlatformUserRow {
  id: string;
  user_id: string;
  email: string;
  role_name: string | null;
  role_id: string | null;
  created_at: string;
}

interface RoleOption {
  id: string;
  name: string;
  description: string | null;
}

export function PlatformUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<PlatformUserRow[] | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: userRows, error: userError }, { data: roleRows }] = await Promise.all([
      supabase.rpc('get_platform_users'),
      supabase.from('platform_roles').select('id, name, description').order('name'),
    ]);
    if (userError) setError(userError.message);
    setUsers((userRows as PlatformUserRow[]) ?? []);
    setRoles((roleRows as RoleOption[]) ?? []);
    if (roleRows?.length && !inviteRoleId) setInviteRoleId(roleRows[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(userRowId: string, roleId: string) {
    await supabase.from('platform_users').update({ platform_role_id: roleId }).eq('id', userRowId);
    load();
  }

  async function removeUser(userRowId: string) {
    if (!confirm('Remove this platform admin? They will lose all access to the Master Dashboard.')) return;
    const { error: rpcError } = await supabase.rpc('remove_platform_user', { p_platform_user_id: userRowId });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    load();
  }

  async function sendInvite() {
    if (!inviteEmail.trim() || !inviteRoleId) return;
    setInviting(true);
    setInviteMessage(null);

    const { data, error: invokeError } = await supabase.functions.invoke('invite-platform-user', {
      body: { email: inviteEmail.trim(), platformRoleId: inviteRoleId },
    });

    setInviting(false);

    if (invokeError) {
      let message = invokeError.message;
      if (invokeError instanceof FunctionsHttpError) {
        try {
          message = (await invokeError.context.json())?.error ?? message;
        } catch {
          // fall back to generic message
        }
      }
      setInviteMessage(message);
      return;
    }

    if (data?.success) {
      setInviteMessage(`Invited ${inviteEmail}.`);
      setInviteEmail('');
      load();
    } else {
      setInviteMessage(data?.error ?? 'Something went wrong.');
    }
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Platform Users</h1>
      <p className="mt-1 text-sm text-ink/60">
        Who can access this Master Dashboard, and with which role. This is separate from restaurant staff — a
        restaurant owner logging in here would see "No platform access".
      </p>
      <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-xs text-ink/50">
        Note: roles below are labels for now (Super Admin, Support, Finance, Developer, Sales) — every platform user
        currently has full access to every page in this dashboard, the same way restaurant staff permissions worked
        before that got wired up to actually restrict pages. Scoping each role to only what it needs (e.g. Finance
        seeing revenue but not System Health) is a natural follow-up once there's more than one real platform user.
      </p>

      {error && <div className="mt-4 rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Since</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {!users && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink/40">
                  Loading…
                </td>
              </tr>
            )}
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-ink">
                  {u.email}
                  {u.user_id === currentUser?.id && <span className="ml-2 text-xs text-ink/40">(you)</span>}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role_id ?? ''}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="rounded-lg border border-line bg-canvas px-2 py-1 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-ink/50">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => removeUser(u.id)} className="text-xs text-ink/40 hover:text-danger">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-line p-5">
        <h2 className="text-sm font-semibold text-ink">Invite a platform user</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="email"
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="w-64 rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <select
            value={inviteRoleId}
            onChange={(e) => setInviteRoleId(e.target.value)}
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            onClick={sendInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
        {inviteMessage && <p className="mt-2 text-xs text-ink/60">{inviteMessage}</p>}
      </div>
    </div>
  );
}
