import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Every item here maps to a section of the Master Dashboard spec.
// Only "Restaurants" is wired to a real page so far -- the rest are
// listed but disabled, so the nav shows the full intended shape of the
// dashboard from day one instead of silently growing new items later.
const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: '◧', enabled: false },
  { to: '/restaurants', label: 'Restaurants', icon: '▦', enabled: true },
  { to: '/subscriptions', label: 'Subscriptions', icon: '◆', enabled: true },
  { to: '/feature-flags', label: 'Feature Flags', icon: '⚑', enabled: true },
  { to: '/analytics', label: 'Analytics', icon: '◫', enabled: false },
  { to: '/payments', label: 'Payment Monitoring', icon: '⌁', enabled: false },
  { to: '/platform-users', label: 'Platform Users', icon: '◐', enabled: false },
  { to: '/audit-logs', label: 'Audit Logs', icon: '☰', enabled: false },
  { to: '/system-health', label: 'System Health', icon: '♥', enabled: false },
] as const;

export function Layout() {
  const { user, platformRoleName, signOut } = useAuth();

  return (
    <div className="flex h-screen bg-canvas text-ink">
      <aside className="flex w-60 flex-col border-r border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-6 py-5">
          <span className="font-display text-lg font-semibold tracking-tight">Platform</span>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
            Master
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) =>
            item.enabled ? (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-accent text-white' : 'text-ink/70 hover:bg-canvas hover:text-ink'
                  }`
                }
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </NavLink>
            ) : (
              <div
                key={item.to}
                title="Not built yet"
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink/30"
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
                <span className="ml-auto text-[10px] uppercase tracking-wide text-ink/25">soon</span>
              </div>
            )
          )}
        </nav>
        <div className="border-t border-line px-4 py-4">
          <p className="truncate text-xs font-medium text-ink">{user?.email}</p>
          <p className="text-[11px] uppercase tracking-wide text-ink/40">{platformRoleName}</p>
          <button onClick={signOut} className="mt-2 text-xs font-medium text-accent hover:underline">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
