import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Restaurants } from './pages/Restaurants';
import { RestaurantDetails } from './pages/RestaurantDetails';
import { CreateRestaurant } from './pages/CreateRestaurant';
import { Subscriptions } from './pages/Subscriptions';
import { FeatureFlags } from './pages/FeatureFlags';
import { Analytics } from './pages/Analytics';
import { PlatformUsers } from './pages/PlatformUsers';
import { AuditLogs } from './pages/AuditLogs';
import { SystemHealth } from './pages/SystemHealth';

function ProtectedShell() {
  const { user, platformRoleName, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-sm text-ink/50">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!platformRoleName) {
    return (
      <div className="flex h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="text-lg font-semibold text-ink">No platform access</p>
          <p className="mt-2 text-sm text-ink/60">
            This account isn't a platform admin. This dashboard is for platform operators, not restaurant staff.
          </p>
        </div>
      </div>
    );
  }
  return <Layout />;
}

const routerBasename = window.location.pathname.startsWith('/master-dashboard')
  ? '/master-dashboard'
  : '';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={routerBasename}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedShell />}>
            <Route path="/" element={<Overview />} />
            <Route path="/restaurants" element={<Restaurants />} />
            <Route path="/restaurants/new" element={<CreateRestaurant />} />
            <Route path="/restaurants/:id" element={<RestaurantDetails />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/feature-flags" element={<FeatureFlags />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/platform-users" element={<PlatformUsers />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/system-health" element={<SystemHealth />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
