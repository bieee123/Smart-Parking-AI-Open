const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.detail?.message || error.message || `HTTP ${response.status}`);
  }

  const result = await response.json();
  return result; // { success, data } or error shape
}

// Export request function for use in other service modules
export { request };

export const api = {
  // ── Auth ──────────────────────────────────────────────
  auth: {
    login: (credentials) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    getProfile: () => request('/auth/profile'),
  },

  // ── Parking Slots ─────────────────────────────────────
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

  // ── Parking Logs ──────────────────────────────────────
  logs: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/logs${qs ? `?${qs}` : ''}`);
    },
    recent: () => request('/logs/recent'),
    create: (data) =>
      request('/logs', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ── Dashboard ─────────────────────────────────────────
  dashboard: {
    summary: () => request('/dashboard/summary'),
    slotsMap: () => request('/dashboard/slots-map'),
  },

  // ── Camera (placeholder — no backend yet) ─────────────
  camera: {
    // Returns mock data until /camera/* endpoints exist
    getLogs: async () => ({ success: true, data: mockCameraLogs() }),
    getStatus: async () => ({ success: true, data: mockCameraStatus() }),
  },
};

// ── Mock camera data (backend not ready) ────────────────
function mockCameraLogs() {
  return [
    { id: 1, camera_id: 'CAM-01', event: 'vehicle_detected', plate: 'B 1234 XYZ', timestamp: new Date().toISOString() },
    { id: 2, camera_id: 'CAM-02', event: 'vehicle_enter', plate: 'B 5678 ABC', timestamp: new Date(Date.now() - 300000).toISOString() },
    { id: 3, camera_id: 'CAM-01', event: 'vehicle_exit', plate: 'B 1234 XYZ', timestamp: new Date(Date.now() - 600000).toISOString() },
  ];
}

function mockCameraStatus() {
  return [
    { id: 'CAM-01', name: 'Entrance Gate', status: 'online', last_heartbeat: new Date().toISOString(), linked_slot: 'A1-01' },
    { id: 'CAM-02', name: 'Zone A', status: 'online', last_heartbeat: new Date(Date.now() - 10000).toISOString(), linked_slot: 'A1-02' },
    { id: 'CAM-03', name: 'Zone B', status: 'offline', last_heartbeat: new Date(Date.now() - 3600000).toISOString(), linked_slot: null },
    { id: 'CAM-04', name: 'Exit Gate', status: 'online', last_heartbeat: new Date().toISOString(), linked_slot: 'B1-01' },
  ];
}

export default api;
