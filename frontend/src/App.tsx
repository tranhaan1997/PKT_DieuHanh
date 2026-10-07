import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import SsoCallbackPage from './pages/SsoCallbackPage';
import DashboardPage from './pages/DashboardPage';
import SitesPage from './pages/SitesPage';
import SolutionsPage from './pages/SolutionsPage';
import PeriodsPage from './pages/PeriodsPage';
import WorkOrdersPage from './pages/WorkOrdersPage';
import LookupPage from './pages/LookupPage';
import UsersPage from './pages/UsersPage';
import ManagerOrdersPage from './pages/ManagerOrdersPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import TtkvsPage from './pages/TtkvsPage';
import GuidePage from './pages/GuidePage';
import ReportsPage from './pages/ReportsPage';
import SyncHistoryPage from './pages/SyncHistoryPage';
import ActivityHistoryPage from './pages/ActivityHistoryPage';
import CalculatorsPage from './pages/CalculatorsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  const isTechnician = user?.role === 'TECHNICIAN';

  if (isTechnician) {
    return (
      <Routes>
        <Route path="/login"         element={<LoginPage />} />
        <Route path="/auth/callback" element={<SsoCallbackPage />} />
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/lookup" replace />} />
          <Route path="lookup" element={<LookupPage />} />
          <Route path="activity-history" element={<ActivityHistoryPage />} />
          <Route path="calculators/:code?" element={<CalculatorsPage />} />
          <Route path="*" element={<Navigate to="/lookup" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login"         element={<LoginPage />} />
      <Route path="/auth/callback" element={<SsoCallbackPage />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="sites"       element={<SitesPage />} />
        <Route path="solutions"   element={<SolutionsPage />} />
        <Route path="periods"     element={<PeriodsPage />} />
        <Route path="work-orders" element={<WorkOrdersPage />} />
        <Route path="lookup"         element={<LookupPage />} />
        <Route path="activity-history" element={<ActivityHistoryPage />} />
        <Route path="manager-orders" element={<ManagerOrdersPage />} />
        <Route path="calculators/:code?" element={<CalculatorsPage />} />
        {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') && <Route path="guide" element={<GuidePage />} />}
        {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') && <Route path="sync-history" element={<SyncHistoryPage />} />}
        {user?.role === 'ADMIN' && <Route path="users" element={<UsersPage />} />}
        {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') && <Route path="admin/ttkvs" element={<TtkvsPage />} />}
        {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR' || user?.role === 'VIEWER') && <Route path="reports" element={<ReportsPage />} />}
        {user?.role === 'ADMIN' && <Route path="admin/settings" element={<AdminSettingsPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
