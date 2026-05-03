import { useState, useEffect, useRef } from 'react';
import { parkingApi, cameraApi } from '../services/parking';

// Status options for editing
const STATUS_OPTIONS = ['empty', 'occupied', 'reserved', 'offline', 'error'];
const VEHICLE_OPTIONS = ['', 'car', 'motorcycle', 'truck'];

export default function SlotModal({ slot, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('details');
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    status: slot.status || 'empty',
    vehicle_type: slot.vehicle_type || '',
    license_plate: slot.license_plate || '',
    camera_id: slot.camera_id || '',
  });
  const [logs, setLogs] = useState([]);
  const [cameraStatus, setCameraStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const modalRef = useRef(null);

  // Fetch logs and camera status when modal opens
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch logs for this slot
        const logsRes = await parkingApi.getLogs({ slotId: slot.id, limit: 20 });
        setLogs(logsRes.data?.logs || []);

        // Fetch camera status if camera_id exists
        if (slot.camera_id) {
          try {
            const camRes = await cameraApi.getStatus(slot.camera_id);
            setCameraStatus(camRes.data);
          } catch {
            setCameraStatus(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch modal data:', err);
      }
    }
    fetchData();
  }, [slot.id, slot.camera_id]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const isOccupied = formData.status === 'occupied';
      await parkingApi.updateSlot(slot.id, {
        status: formData.status,
        is_occupied: isOccupied,
        vehicle_type: isOccupied ? formData.vehicle_type : null,
        license_plate: isOccupied ? formData.license_plate : null,
        camera_id: formData.camera_id || null,
      });
      setEditMode(false);
      // Notify parent to refresh data
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.message || 'Failed to update slot');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Format date helper
  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const tabs = [
    { 
      id: 'details', 
      label: 'Details', 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <rect x="4" y="3" width="16" height="18" rx="2"/>
          <path d="M8 7h8M8 11h8M8 15h5"/>
        </svg>
      )
    },
    { 
      id: 'logs', 
      label: 'Logs', 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M3 5h18M3 10h18M3 15h12M3 20h8"/>
          <circle cx="19" cy="17.5" r="3"/>
          <path d="M19 16v2M19 20v.01"/>
        </svg>
      )
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-slideUp"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
              (slot.status || 'empty') === 'empty' ? 'bg-green-500' :
              (slot.status || 'empty') === 'occupied' ? 'bg-red-500' :
              (slot.status || 'empty') === 'reserved' ? 'bg-blue-500' :
              (slot.status || 'empty') === 'offline' ? 'bg-yellow-500' : 'bg-orange-500'
            }`}>
              {slot.slot_number}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Slot {slot.slot_number}
              </h3>
              <p className="text-xs text-gray-500">
                Zone {slot.zone} · Floor {slot.floor}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-5">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  (slot.status || 'empty') === 'empty' ? 'bg-green-100 text-green-800' :
                  (slot.status || 'empty') === 'occupied' ? 'bg-red-100 text-red-800' :
                  (slot.status || 'empty') === 'reserved' ? 'bg-blue-100 text-blue-800' :
                  (slot.status || 'empty') === 'offline' ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {(slot.status || 'empty').charAt(0).toUpperCase() + (slot.status || 'empty').slice(1)}
                </span>
              </div>

              {/* Vehicle Info */}
              {slot.vehicle_type && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Vehicle</span>
                  <span className="text-sm font-medium text-gray-900 capitalize flex items-center gap-1.5">
                    {slot.vehicle_type === 'motorcycle' ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <circle cx="5.5" cy="15.5" r="2.5"/>
                          <circle cx="18.5" cy="15.5" r="2.5"/>
                          <path d="M8 15.5h7"/>
                          <path d="M15 6h2l2 4.5"/>
                          <path d="M9 6l3 4.5h4.5"/>
                          <path d="M9 6H7l-1.5 4"/>
                        </svg>
                        Motorcycle
                      </>
                    ) : slot.vehicle_type === 'car' ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <path d="M7 17H5a2 2 0 01-2-2v-3l2-6h14l2 6v3a2 2 0 01-2 2h-2"/>
                          <path d="M7 17h10"/>
                          <circle cx="7" cy="17" r="2"/>
                          <circle cx="17" cy="17" r="2"/>
                          <path d="M5 12h14"/>
                          <path d="M8 6l-1 6M16 6l1 6"/>
                        </svg>
                        Car
                      </>
                    ) : slot.vehicle_type === 'truck' ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <rect x="1" y="6" width="13" height="11" rx="1"/>
                          <path d="M14 9h4l3 4v4h-7V9z"/>
                          <circle cx="5.5" cy="18.5" r="1.5"/>
                          <circle cx="18.5" cy="18.5" r="1.5"/>
                          <path d="M14 13h4"/>
                        </svg>
                        Truck
                      </>
                    ) : slot.vehicle_type}
                  </span>
                </div>
              )}

              {/* License Plate */}
              {slot.license_plate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">License Plate</span>
                  <span className="text-sm font-mono font-medium text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                    {slot.license_plate}
                  </span>
                </div>
              )}

              {/* Camera */}
              {slot.camera_id && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Camera</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      cameraStatus?.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    <span className="text-sm font-mono text-gray-900">{slot.camera_id}</span>
                    {cameraStatus?.status && (
                      <span className="text-xs text-gray-500">({cameraStatus.status})</span>
                    )}
                  </div>
                </div>
              )}

              {/* Snapshot URL */}
              {cameraStatus?.snapshot_url && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Snapshot</span>
                  <a
                    href={cameraStatus.snapshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:underline"
                  >
                    View Image →
                  </a>
                </div>
              )}

              {/* Updated at */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Last Updated</span>
                <span className="text-sm text-gray-700">
                  {slot.updated_at ? formatDate(slot.updated_at) : '—'}
                </span>
              </div>

              {/* Edit Section */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                {!editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-1.5"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit Slot
                  </button>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">Edit Slot</h4>

                    {/* Status select */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => handleInputChange('status', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Vehicle type select */}
                    {formData.status === 'occupied' && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Vehicle Type</label>
                          <select
                            value={formData.vehicle_type}
                            onChange={(e) => handleInputChange('vehicle_type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                          >
                            {VEHICLE_OPTIONS.map((v) => (
                              <option key={v} value={v}>
                                {v === '' ? 'Select type' : v.charAt(0).toUpperCase() + v.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">License Plate</label>
                          <input
                            type="text"
                            value={formData.license_plate}
                            onChange={(e) => handleInputChange('license_plate', e.target.value)}
                            placeholder="e.g. B 1234 XYZ"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none text-gray-900"
                          />
                        </div>
                      </>
                    )}

                    {/* Camera ID */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Camera ID</label>
                      <input
                        type="text"
                        value={formData.camera_id}
                        onChange={(e) => handleInputChange('camera_id', e.target.value)}
                        placeholder="e.g. CAM-01"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none text-gray-900"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {saving ? (
                          <>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 animate-spin">
                              <path d="M21 12a9 9 0 11-6.219-8.56"/>
                            </svg>
                            Saving...
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                              <path d="M17 21v-8H7v8"/>
                              <path d="M7 3v5h8"/>
                            </svg>
                            Save
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setEditMode(false);
                          setFormData({
                            status: slot.status || 'empty',
                            vehicle_type: slot.vehicle_type || '',
                            license_plate: slot.license_plate || '',
                            camera_id: slot.camera_id || '',
                          });
                        }}
                        className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No parking logs found for this slot</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {log.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(log.entry_time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        {log.license_plate && (
                          <span className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                            {log.license_plate}
                          </span>
                        )}
                        {log.vehicle_type && (
                          <span className="text-gray-500 capitalize">{log.vehicle_type}</span>
                        )}
                        {log.duration_minutes != null && (
                          <span className="text-gray-500">{log.duration_minutes} min</span>
                        )}
                        {log.fee != null && (
                          <span className="text-gray-700 font-medium">Rp {log.fee.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inline animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
