const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers,
    ...options,
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
      return;
    }
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.detail?.message || error.message || `HTTP ${response.status}`);
  }

  const result = await response.json();
  return result; // { success, data } or error shape
}

// Export request function for use in other service modules
export { request };

export const api = {
  // Auth
  auth: {
    login: (credentials) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  },

  // User Profile
  profile: {
    get: () => request('/profile'),
    update: (data) =>
      request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
    changePassword: (data) =>
      request('/profile/password', { method: 'POST', body: JSON.stringify(data) }),
    getActivities: () => request('/profile/activities'),
    deleteAccount: () => request('/profile', { method: 'DELETE' }),
    revokeSessions: (userId, type) => request('/profile/revoke-sessions', { method: 'POST', body: JSON.stringify({ targetUserId: userId, type }) }),
  },

  // Admin Management
  admin: {
    listUsers: () => request('/admin/users'),
    createUser: (data) => request('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id, data) => request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  },

  // Parking Slots
  slots: {
    getAll: () => request('/slots'),
    getById: (id) => request(`/slots/${id}`),
    create: (data) =>
      request('/slots', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) =>
      request(`/slots/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) =>
      request(`/slots/${id}`, { method: 'DELETE' }),
  },

  // Parking Logs
  logs: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/logs${qs ? `?${qs}` : ''}`);
    },
    recent: () => request('/logs/recent'),
    create: (data) =>
      request('/logs', { method: 'POST', body: JSON.stringify(data) }),
  },

  // Dashboard
  dashboard: {
    summary: () => request('/dashboard/summary'),
    slotsMap: () => request('/dashboard/slots-map'),
  },

  // Analytics — used by AnalyticsDashboard.jsx fetchAll()
  analytics: {
    occupancyTrends: (range = '7d') => request(`/analytics/occupancy/trends?range=${range}`),
    trafficCorrelation: (range = '7d') => request(`/analytics/traffic/correlation?range=${range}`),
    violationHotspots: (limit = 25) => request(`/analytics/violation/hotspots?limit=${limit}`),
    bottlenecks: () => request('/analytics/bottlenecks'),
    efficiency: () => request('/analytics/efficiency/slots'),
    executiveSummary: () => request('/analytics/executive-summary'),
  },

  // Camera (Persistent)
  camera: {
    getLogs: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/camera/logs${qs ? `?${qs}` : ''}`);
    },
    getStatus: () => request('/camera'),
    getAll: () => request('/camera'),
    updatePersistentStatus: (id, status) => 
      request(`/camera/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  },

  // AI & Analysis
  ai: {
    analyze: (formData) => request('/ai/analyze', { method: 'POST', body: formData }),
    getHistory: () => request('/ai/analysis/history'),
    saveHistory: (data) => request('/ai/analysis/history', { method: 'POST', body: JSON.stringify(data) }),
  },
};


export default api;
