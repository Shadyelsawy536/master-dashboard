import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Restaurants } from './pages/Restaurants';
import { RestaurantDetails } from './pages/RestaurantDetails';
import { CreateRestaurant } from './pages/CreateRestaurant';
import { Subscriptions } from './pages/Subscriptions';
import { FeatureFlags } from './pages/FeatureFlags';

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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedShell />}>
            {/* Overview isn't built yet -- Restaurants is the real landing
                page for now, so signing in takes you somewhere useful. */}
            <Route path="/" element={<Navigate to="/restaurants" replace />} />
            <Route path="/restaurants" element={<Restaurants />} />
            <Route path="/restaurants/new" element={<CreateRestaurant />} />
            <Route path="/restaurants/:id" element={<RestaurantDetails />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/feature-flags" element={<FeatureFlags />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
