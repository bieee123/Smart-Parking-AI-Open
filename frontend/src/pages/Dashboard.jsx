import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { formatDate } from '../utils/helpers';
import { 
  HiHashtag, HiMinusCircle, HiCheckCircle, HiChartPie, 
  HiVideoCamera, HiMap, HiExclamation, HiChevronRight 
} from 'react-icons/hi';
import { FaParking, FaCar } from 'react-icons/fa';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [summaryRes, logsRes] = await Promise.all([
          api.dashboard.summary(),
          api.logs.recent(),
        ]);
        setSummary(summaryRes.data);
        setRecentLogs(logsRes.data?.logs?.slice(0, 5) || []);
        setError('');
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Failed to load dashboard data. Is the backend running?');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-64 animate-pulse" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
              <div className="flex justify-between items-start">
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="w-10 h-10 bg-gray-50 rounded-full animate-pulse" />
              </div>
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-24 bg-gray-50 rounded-xl animate-pulse border border-gray-100" />
            <div className="h-24 bg-gray-50 rounded-xl animate-pulse border border-gray-100" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4 border-b border-gray-50 pb-4">
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-32 bg-gray-50 rounded animate-pulse" />
                <div className="h-4 flex-1 bg-gray-50 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-6 py-4 rounded-lg">
          <div className="flex items-center gap-2">
            <HiExclamation className="text-xl" />
            <p className="font-medium">{error}</p>
          </div>
          <p className="text-sm mt-1 text-amber-700">
            Make sure the backend is running on <code className="bg-amber-100 px-1 rounded">http://localhost:8000</code>
          </p>
        </div>
        {/* Show placeholder stats so the UI is still visible */}
        <PlaceholderDashboard recentLogs={recentLogs} />
      </div>
    );
  }

  const occupancyRate = summary.total_slots
    ? Math.round((summary.occupied / summary.total_slots) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Real-time parking monitoring overview</p>
        {summary.last_update && (
          <p className="text-xs text-gray-400 mt-1">
            Last updated: {formatDate(summary.last_update)}
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Slots" value={summary.total_slots} icon={<HiHashtag />} color="bg-blue-500" />
        <StatCard title="Occupied" value={summary.occupied} icon={<HiMinusCircle />} color="bg-red-500" />
        <StatCard title="Available" value={summary.available} icon={<HiCheckCircle />} color="bg-green-500" />
        <StatCard title="Occupancy Rate" value={`${occupancyRate}%`} icon={<HiChartPie />} color="bg-purple-500" />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/live-camera"
            className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <span className="text-3xl mr-4 text-blue-600">
              <HiVideoCamera />
            </span>
            <div>
              <h3 className="font-semibold text-gray-900">Live Camera</h3>
              <p className="text-sm text-gray-600">View real-time camera feeds</p>
            </div>
          </Link>
          <Link
            to="/map-parking"
            className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <span className="text-3xl mr-4 text-green-600">
              <HiMap />
            </span>
            <div>
              <h3 className="font-semibold text-gray-900">Parking Map</h3>
              <p className="text-sm text-gray-600">View parking layout and availability</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {recentLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No recent activity to display</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Event</th>
                  <th className="px-4 py-3">Slot</th>
                  <th className="px-4 py-3">License Plate</th>
                  <th className="px-4 py-3 rounded-r-lg">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.event === 'vehicle_enter'
                            ? 'bg-green-100 text-green-800'
                            : log.event === 'vehicle_exit'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {log.event.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      Slot #{log.slot_id}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {log.license_plate || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDate(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Fallback when backend is down ─────────────────────────── */
function PlaceholderDashboard({ recentLogs }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Slots" value="—" icon={<HiHashtag />} color="bg-blue-500" />
        <StatCard title="Occupied" value="—" icon={<HiMinusCircle />} color="bg-red-500" />
        <StatCard title="Available" value="—" icon={<HiCheckCircle />} color="bg-green-500" />
        <StatCard title="Occupancy Rate" value="—" icon={<HiChartPie />} color="bg-purple-500" />
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {recentLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No data available</p>
          </div>
        ) : null}
      </div>
    </>
  );
}

/* ── Stat Card ─────────────────────────────────────────────── */
function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`${color} rounded-full p-3 text-2xl`}>{icon}</div>
      </div>
    </div>
  );
}
