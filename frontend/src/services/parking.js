import { request } from './api';

// ── Parking Slots ───────────────────────────────────────────
export const parkingApi = {
  // Get all slots with optional filters
  getSlots: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/parking/slots${qs ? `?${qs}` : ''}`);
  },

  // Get single slot detail
  getSlot: (id) => request(`/parking/slots/${id}`),

  // Update a slot (status, vehicle_type, license_plate, etc.)
  updateSlot: (id, data) =>
    request(`/parking/slots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Delete a slot
  deleteSlot: (id) =>
    request(`/parking/slots/${id}`, { method: 'DELETE' }),

  // ── Parking Logs ──────────────────────────────────────────
  getLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/parking/logs${qs ? `?${qs}` : ''}`);
  },

  createLog: (data) =>
    request('/parking/logs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  completeLog: (id, data = {}) =>
    request(`/parking/logs/${id}/complete`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ── Camera ──────────────────────────────────────────────────
export const cameraApi = {
  // Get camera status by camera ID
  getStatus: (cameraId) => request(`/camera/status/${cameraId}`),

  // Get all camera logs (protected)
  getLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/camera/logs${qs ? `?${qs}` : ''}`);
  },
};

export default { parking: parkingApi, camera: cameraApi };
