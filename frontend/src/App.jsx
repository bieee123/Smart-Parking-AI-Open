import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import ProfileLayout from './layouts/ProfileLayout';
import Dashboard from './modules/dashboard/pages/Dashboard';
import LiveCamera from './modules/dashboard/pages/LiveCamera';
import ParkingMap from './modules/dashboard/pages/ParkingMap';
import AnalyticsDashboard from './modules/dashboard/pages/AnalyticsDashboard';
import SimulatorPage from './modules/dashboard/pages/SimulatorPage';
import ExecutiveSummaryPage from './modules/dashboard/pages/ExecutiveSummaryPage';

// Profile Pages
import AccountInfo from './modules/profile/pages/AccountInfo';
import UserManagement from './modules/profile/pages/UserManagement';
import Security from './modules/profile/pages/Security';
import Personalization from './modules/profile/pages/Personalization';
import Sessions from './modules/profile/pages/Sessions';

// Public Pages
import LandingPage from './modules/public/pages/LandingPage';
import ViewerAuth from './modules/public/pages/ViewerAuth';
import AdminLogin from './modules/public/pages/AdminLogin';
import SlotViewer from './modules/public/pages/SlotViewer';

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="text-gray-500 mt-4 text-lg">{t('common.not_found')}</p>
        <a href="/dashboard" className="mt-4 inline-block text-primary-600 hover:underline">
          {t('common.go_to_dashboard')}
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<ViewerAuth />} />
      <Route path="/login" element={<ViewerAuth />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/parking" element={<SlotViewer />} />

      {/* Protected — wrapped in DashboardLayout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin', 'operator', 'viewer']}>
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/live-camera"
        element={
          <ProtectedRoute allowedRoles={['admin', 'operator']}>
            <DashboardLayout>
              <LiveCamera />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/map-parking"
        element={
          <ProtectedRoute allowedRoles={['admin', 'operator', 'viewer']}>
            <DashboardLayout>
              <ParkingMap />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/analytics"
        element={
          <ProtectedRoute allowedRoles={['admin', 'operator']}>
            <DashboardLayout>
              <AnalyticsDashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/simulator"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DashboardLayout>
              <SimulatorPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />


      {/* Executive Summary */}
      <Route
        path="/executive-summary"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DashboardLayout>
              <ExecutiveSummaryPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Profile Sections — wrapped in ProfileLayout */}
      <Route
        path="/profile/account"
        element={
          <ProtectedRoute>
            <ProfileLayout>
              <AccountInfo />
            </ProfileLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ProfileLayout>
              <UserManagement />
            </ProfileLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/security"
        element={
          <ProtectedRoute>
            <ProfileLayout>
              <Security />
            </ProfileLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/personalization"
        element={
          <ProtectedRoute>
            <ProfileLayout>
              <Personalization />
            </ProfileLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/sessions"
        element={
          <ProtectedRoute allowedRoles={['admin', 'operator']}>
            <ProfileLayout>
              <Sessions />
            </ProfileLayout>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
