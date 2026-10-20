import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';

const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const Overview = lazy(() => import('./pages/Overview').then((m) => ({ default: m.Overview })));
const Restaurants = lazy(() => import('./pages/Restaurants').then((m) => ({ default: m.Restaurants })));
const RestaurantDetails = lazy(() => import('./pages/RestaurantDetails').then((m) => ({ default: m.RestaurantDetails })));
const CreateRestaurant = lazy(() => import('./pages/CreateRestaurant').then((m) => ({ default: m.CreateRestaurant })));
const Subscriptions = lazy(() => import('./pages/Subscriptions').then((m) => ({ default: m.Subscriptions })));
const FeatureFlags = lazy(() => import('./pages/FeatureFlags').then((m) => ({ default: m.FeatureFlags })));
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })));
const Customers = lazy(() => import('./pages/Customers').then((m) => ({ default: m.Customers })));
const PlatformUsers = lazy(() => import('./pages/PlatformUsers').then((m) => ({ default: m.PlatformUsers })));
const AuditLogs = lazy(() => import('./pages/AuditLogs').then((m) => ({ default: m.AuditLogs })));
const SystemHealth = lazy(() => import('./pages/SystemHealth').then((m) => ({ default: m.SystemHealth })));
const Monitoring = lazy(() => import('./pages/Monitoring').then((m) => ({ default: m.Monitoring })));

function PageFallback() {
  return <div className="flex min-h-40 items-center justify-center p-8 text-sm text-ink/50">Loading page…</div>;
}

function page(element: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

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
          <Route path="/login" element={page(<Login />)} />
          <Route path="/reset-password" element={page(<ResetPassword />)} />
          <Route element={<ProtectedShell />}>
            <Route path="/" element={page(<Overview />)} />
            <Route path="/restaurants" element={page(<Restaurants />)} />
            <Route path="/restaurants/new" element={page(<CreateRestaurant />)} />
            <Route path="/restaurants/:id" element={page(<RestaurantDetails />)} />
            <Route path="/subscriptions" element={page(<Subscriptions />)} />
            <Route path="/feature-flags" element={page(<FeatureFlags />)} />
            <Route path="/analytics" element={page(<Analytics />)} />
            <Route path="/customers" element={page(<Customers />)} />
            <Route path="/platform-users" element={page(<PlatformUsers />)} />
            <Route path="/audit-logs" element={page(<AuditLogs />)} />
            <Route path="/system-health" element={page(<SystemHealth />)} />
            <Route path="/monitoring" element={page(<Monitoring />)} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
