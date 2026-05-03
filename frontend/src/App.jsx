import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveCamera from './pages/LiveCamera';
import ParkingMap from './pages/ParkingMap';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import SimulatorPage from './pages/SimulatorPage';
import ExecutiveSummaryPage from './pages/ExecutiveSummaryPage';

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="text-gray-500 mt-4 text-lg">Page not found</p>
        <a href="/dashboard" className="mt-4 inline-block text-primary-600 hover:underline">
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected — wrapped in DashboardLayout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/live-camera"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <LiveCamera />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/map-parking"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ParkingMap />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/analytics"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <AnalyticsDashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Simulator */}
      <Route
        path="/simulator"
        element={
          <ProtectedRoute>
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
          <ProtectedRoute>
            <DashboardLayout>
              <ExecutiveSummaryPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
