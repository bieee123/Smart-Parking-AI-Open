import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { api } from '../services/api';
import { formatDate } from '../utils/helpers';
import { 
  HiCamera, HiTruck, HiChip, HiCloudUpload, HiPlay, HiCheckCircle, 
  HiRefresh, HiChevronRight, HiDownload, HiTrash, HiInformationCircle, HiX 
} from 'react-icons/hi';
import { FaFileVideo, FaRobot, FaParking, FaTrafficLight } from 'react-icons/fa';

export default function LiveCamera() {
  const [cameras, setCameras] = useState([]);
  const [trafficData, setTrafficData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [selectedStreetCamera, setSelectedStreetCamera] = useState({ id: 'ATCS-001', name: 'ATCS Pusat', status: 'online' });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('parking'); // 'parking' or 'street'
  const [sourceMode, setSourceMode] = useState('live'); // 'live' or 'upload'

  // Upload states — enhanced from original isUploading/uploadProgress
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle'|'uploading'|'processing'|'done'|'error'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  // Keep isUploading as derived state for backward compatibility with existing UI
  const isUploading = uploadStatus === 'uploading' || uploadStatus === 'processing';

  const [streamResolving, setStreamResolving] = useState(false);

  // Violation alert state
  const [violationAlert, setViolationAlert] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null); // Bounding box overlay canvas
  const fileInputRef = useRef(null);

  // Mock Street Cameras with real URL for the first one
  const streetCameras = [
    { 
      id: 'ATCS-001', 
      name: 'ATCS Pusat', 
      status: 'online', 
      area: 'Street',
      streamUrl: 'https://atcsdishub.medan.go.id/stream/L2AHMADYANIPULAUPINANG/stream.m3u8' 
    },
    { 
      id: 'ATCS-004', 
      name: 'ATCS Pusat', 
      status: 'online', 
      area: 'Street',
      streamUrl: 'https://www.youtube.com/watch?v=465lj-w4DPs'
    },
    { id: 'ATCS-002', name: 'ATCS Pusat', status: 'online', area: 'Street' },
    { id: 'ATCS-003', name: 'ATCS Pusat', status: 'offline', area: 'Street' },
  ];

  // ── Canvas bounding box helper ───────────────────────────────────────────────
  const drawBoxes = useCallback((boxes) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!boxes?.length || !video) return;

    // Normalize from AI resolution (640x640) to current display size
    const scaleX = canvas.width / 640;
    const scaleY = canvas.height / 640;

    boxes.forEach(([x, y, w, h, confidence, classId]) => {
      if ((confidence ?? 1) < 0.40) return; // skip low-confidence detections
      const color = classId === 5 ? '#ef4444' : '#22c55e'; // red=violation, green=vehicle
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY);
      ctx.fillStyle = color;
      ctx.font = '11px monospace';
      ctx.fillText(`${((confidence ?? 1) * 100).toFixed(0)}%`, x * scaleX + 2, y * scaleY - 4);
    });
  }, []);

  // Sync canvas size to video element via ResizeObserver
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
      }
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, [activeTab, sourceMode]);

  // Fetch camera list and logs on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [statusRes, logsRes] = await Promise.all([
          api.camera.getStatus(),
          api.camera.getLogs(),
        ]);
        const cams = statusRes.data || [];
        setCameras(cams);
        setLogs(logsRes.data || []);
        if (cams.length > 0) setSelectedCamera(cams[0]);
      } catch (err) {
        console.error('Camera fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // HLS Stream Handler for Street Tab (with YouTube resolution)
  useEffect(() => {
    if (activeTab === 'street' && selectedStreetCamera?.streamUrl && videoRef.current) {
      const video = videoRef.current;
      let hls;

      async function initPlayer() {
        try {
          setStreamResolving(true);
          // 1. Resolve URL (YouTube -> m3u8) via AI Service
          const resolveRes = await fetch(`http://localhost:9000/ai/traffic/resolve?url=${encodeURIComponent(selectedStreetCamera.streamUrl)}`);
          const resolveData = await resolveRes.json();
          const finalUrl = resolveData.resolved_url;

          setStreamResolving(false);
          if (!finalUrl) return;

          // 2. Initialize HLS Player
          if (Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(finalUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              video.play().catch(e => console.log("Auto-play prevented", e));
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = finalUrl;
            video.addEventListener('loadedmetadata', () => {
              video.play().catch(e => console.log("Auto-play prevented", e));
            });
          }
        } catch (err) {
          console.error("Stream resolution failed", err);
          setStreamResolving(false);
        }
      }

      initPlayer();

      return () => {
        if (hls) hls.destroy();
      };
    }
  }, [activeTab, selectedStreetCamera]);

  // Dynamic SSE Source for AI Detections
  useEffect(() => {
    let url = 'http://localhost:8000/api/live/stream'; // Default backend
    
    if (activeTab === 'street' && selectedStreetCamera?.streamUrl) {
      // Connect to AI Service (9000) for real-time video analysis
      url = `http://localhost:9000/ai/traffic/stream?url=${encodeURIComponent(selectedStreetCamera.streamUrl)}`;
    }

    const eventSource = new EventSource(url);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setTrafficData(data);

        // Draw bounding boxes if present in SSE data
        if (data.boxes) {
          drawBoxes(data.boxes);
        }

        // Violation alert — trigger if violations array has items OR density_level signals issue
        const hasViolations = (data.violations && data.violations.length > 0);
        if (hasViolations) {
          const alert = {
            location: data.violations[0]?.location || selectedStreetCamera?.name || 'Detected area',
            timestamp: new Date().toISOString(),
          };
          setViolationAlert(alert);
          // Auto-dismiss after 8 seconds
          setTimeout(() => setViolationAlert(null), 8000);
        }

        // If a plate is detected by AI, push to local logs for display
        if (data.last_plate && data.last_plate !== "NO_PLATE_DETECTED") {
          const newLog = {
            id: Date.now(),
            camera_id: selectedStreetCamera?.id || 'ATCS-AI',
            event: 'VEHICLE_DETECTED',
            plate: data.last_plate,
            timestamp: new Date().toISOString()
          };
          setLogs(prev => [newLog, ...prev]);
        }
      } catch (e) {
        console.error("Failed to parse AI stream data", e);
      }
    };

    return () => eventSource.close();
  }, [activeTab, selectedStreetCamera, sourceMode]);

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('video', file);

    try {
      setUploadStatus('uploading');
      setUploadProgress(10);
      setUploadResult(null);

      const response = await fetch('http://localhost:9000/ai/traffic/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Upload failed: HTTP ${response.status}`);

      const result = await response.json();
      setUploadStatus('processing');

      // Listen to SSE progress stream for processing updates
      const progressSource = new EventSource('http://localhost:9000/ai/traffic/process-status');
      progressSource.onmessage = (event) => {
        try {
          const { progress, result: processResult } = JSON.parse(event.data);
          setUploadProgress(progress ?? 0);
          if ((progress ?? 0) >= 100) {
            setUploadResult(processResult || result);
            setUploadStatus('done');
            // Update trafficData with overall results
            setTrafficData({
              vehicle_count: (processResult || result).total_vehicles || result.total_vehicles || 0,
              density_level: (processResult || result).avg_density || result.avg_density || 'medium',
              recommendation: `Analysis complete. Total ${(processResult || result).total_vehicles || result.total_vehicles || 0} vehicles processed.`,
              last_plate: result.sample_plate || 'N/A'
            });
            progressSource.close();
          }
        } catch { progressSource.close(); setUploadStatus('error'); }
      };
      progressSource.onerror = () => {
        // SSE progress not available — fall back to result from initial upload response
        setUploadResult(result);
        setUploadStatus('done');
        setUploadProgress(100);
        setTrafficData({
          vehicle_count: result.total_vehicles || 0,
          density_level: result.avg_density || 'medium',
          recommendation: `Analysis complete. Total ${result.total_vehicles || 0} vehicles processed.`,
          last_plate: result.sample_plate || 'N/A'
        });
        progressSource.close();
      };

    } catch (err) {
      console.error("Video upload failed", err);
      setUploadStatus('error');
      setUploadProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-80 bg-gray-200 rounded-lg" />
            <div className="lg:col-span-2 h-80 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const cameraLogs = logs.filter(
    (l) => l.camera_id === selectedCamera?.id
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Violation Alert Banner */}
      {violationAlert && (
        <div className="mb-4 bg-red-600 text-white px-4 py-3 rounded-lg flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="text-lg">⚠</span>
            Illegal parking detected &mdash; {violationAlert.location}
          </span>
          <button 
            onClick={() => setViolationAlert(null)} 
            className="p-1 hover:bg-red-700 rounded transition-colors"
          >
            <HiX />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Live Traffic & Cameras</h1>
        <p className="text-gray-600 mt-1">
          Monitor parking areas in real-time
          <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            AI YOLOv8 Detection Active
          </span>
        </p>
      </div>

      {/* Tab Switcher - Restored to Original Left Position & Colors */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit border border-gray-200">
        <button
          onClick={() => {
            setActiveTab('parking');
            setSourceMode('live');
          }}
          className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'parking' && sourceMode === 'live'
              ? 'bg-white text-primary-600 shadow-sm border border-gray-100'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FaParking className={activeTab === 'parking' && sourceMode === 'live' ? 'text-primary-600' : 'text-gray-400'} />
          Parking CCTV
        </button>
        <button
          onClick={() => {
            setActiveTab('street');
            setSourceMode('live');
          }}
          className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'street' && sourceMode === 'live'
              ? 'bg-white text-primary-600 shadow-sm border border-gray-100'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FaTrafficLight className={activeTab === 'street' && sourceMode === 'live' ? 'text-primary-600' : 'text-gray-400'} />
          Street Traffic
        </button>
        <button
          onClick={() => setSourceMode('upload')}
          className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition-all ${
            sourceMode === 'upload'
              ? 'bg-white text-primary-600 shadow-sm border border-gray-100'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <HiChip className={sourceMode === 'upload' ? 'text-primary-600' : 'text-gray-400'} />
          Video Analytics
        </button>
      </div>


      {/* Parking CCTV Tab */}
      {activeTab === 'parking' && sourceMode === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Camera List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Cameras</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {cameras.map((camera) => (
                  <button
                    key={camera.id}
                    onClick={() => setSelectedCamera(camera)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${selectedCamera?.id === camera.id ? 'bg-primary-50' : ''
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{camera.name}</p>
                        <p className="text-sm text-gray-500">
                          {camera.status === 'online' ? (
                            <span className="text-green-600">● Online</span>
                          ) : (
                            <span className="text-red-500">● Offline</span>
                          )}
                        </p>
                        {camera.linked_slot && (
                          <p className="text-xs text-gray-400 mt-1">
                            Linked: Slot {camera.linked_slot}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Camera Logs */}
            {logs.length > 0 && (
              <div className="bg-white rounded-lg shadow mt-6">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Events</h2>
                </div>
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {logs.slice(0, 10).map((log) => (
                    <div key={log.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{log.camera_id}</span>
                        <span className="text-xs text-gray-400">{formatDate(log.timestamp)}</span>
                      </div>
                      <p className="text-gray-600 mt-0.5">
                        {log.event.replace(/_/g, ' ')}
                        {log.plate && <span className="ml-1 font-mono text-xs">— {log.plate}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Camera Feed */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedCamera?.name || 'Select a camera'}
                  </h2>
                  {selectedCamera && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Last heartbeat: {selectedCamera.last_heartbeat ? formatDate(selectedCamera.last_heartbeat) : 'N/A'}
                    </p>
                  )}
                </div>
                {selectedCamera && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${selectedCamera.status === 'online'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                      }`}
                  >
                    {selectedCamera.status}
                  </span>
                )}
              </div>
              <div className="aspect-video bg-gray-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-4 left-4 z-10">
                  <span className="flex items-center gap-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] text-white font-mono uppercase tracking-widest border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Live Feed — {selectedCamera?.name || 'No Camera'}
                  </span>
                </div>

                {selectedCamera ? (
                  <div className="text-center text-white">
                    <div className="relative mb-4">
                      <svg className="w-16 h-16 mx-auto text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 border border-blue-500/30 rounded-full animate-ping opacity-20" />
                      </div>
                    </div>
                    <p className="text-lg font-medium text-gray-300">
                      {selectedCamera.status === 'online' ? 'Camera stream active' : 'Camera is currently offline'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Waiting for vehicle entry/exit event...
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-white">
                    <p className="text-lg font-medium text-gray-400">Select a camera to view feed</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Street Traffic Tab */}
      {activeTab === 'street' && sourceMode === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Street Cameras</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {streetCameras.map((camera) => (
                  <button
                    key={camera.id}
                    onClick={() => setSelectedStreetCamera(camera)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${selectedStreetCamera?.id === camera.id ? 'bg-primary-50' : ''
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{camera.name}</p>
                        <p className="text-sm text-gray-500">
                          {camera.status === 'online' ? (
                            <span className="text-green-600">● Online</span>
                          ) : (
                            <span className="text-red-500">● Offline</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow mt-6">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Traffic Alerts</h2>
              </div>
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                <div className="p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-red-600">High Density</span>
                    <span className="text-xs text-gray-400">Just now</span>
                  </div>
                  <p className="text-gray-600 mt-0.5">Congestion detected at Simpang Pos</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{selectedStreetCamera?.name}</h2>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">LIVE STREAM</span>
              </div>
              <div className="aspect-video bg-gray-900 relative">
                {streamResolving ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : null}
                <video ref={videoRef} className="w-full h-full object-cover" muted autoPlay playsInline />
                {/* Canvas overlay for bounding boxes — transparent, sits over the video */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ background: 'transparent' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Analytics Mode (Merged Layout) */}
      {sourceMode === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Left Column: Upload & History */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <HiCloudUpload className="text-blue-600 text-xl" />
                  Source File
                </h2>
              </div>
              
              <div className="p-6">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer group bg-gray-50/30"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="video/*,image/*"
                    onChange={handleVideoUpload}
                  />
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform shadow-sm">
                    <FaFileVideo className="text-3xl" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">Upload Video or Image</p>
                  <p className="text-[11px] text-gray-400 mt-2 font-medium">Drag & drop files to start AI analysis</p>
                </div>

                {isUploading && (
                  <div className="mt-8 space-y-3">
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                      <span className="text-blue-600 animate-pulse">AI Processing...</span>
                      <span className="text-gray-900">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200/50">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(37,99,235,0.4)]" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Analysis History (Placeholder like Recent Events) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mt-6 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Analysis History</h2>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">RECENT</span>
              </div>
              <div className="divide-y divide-gray-50">
                {trafficData && (
                   <div className="p-4 bg-blue-50/30 animate-in slide-in-from-left duration-300">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-gray-900">Last Processed File</p>
                      <span className="text-[10px] text-gray-400 font-mono">JUST NOW</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <span className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[9px] font-bold text-gray-600 uppercase">
                        {trafficData.vehicle_count} Vehicles
                      </span>
                      <span className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[9px] font-bold text-green-600 uppercase">
                        {trafficData.density_level}
                      </span>
                    </div>
                  </div>
                )}
                <div className="p-4 text-center py-12">
                  <p className="text-xs text-gray-400 italic">No previous sessions found</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Results Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-full overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">AI Intelligence Review</h2>
                {trafficData && (
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
                      <HiDownload className="text-xl" />
                    </button>
                    <button onClick={() => setTrafficData(null)} className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors">
                      <HiTrash className="text-xl" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 bg-gray-900 relative flex items-center justify-center p-8 min-h-[400px]">
                {isUploading ? (
                  <div className="w-full max-w-xl space-y-8 animate-pulse">
                     <div className="text-center mb-8">
                       <div className="w-24 h-24 bg-white/5 rounded-full mx-auto mb-6 border-2 border-white/10" />
                       <div className="h-8 w-64 bg-white/5 rounded mx-auto mb-2" />
                       <div className="h-4 w-48 bg-white/5 rounded mx-auto" />
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                       <div className="bg-white/5 p-6 rounded-2xl border border-white/10 h-32" />
                       <div className="bg-white/5 p-6 rounded-2xl border border-white/10 h-32" />
                     </div>
                     <div className="h-20 bg-white/5 border border-white/10 rounded-xl" />
                  </div>
                ) : uploadStatus === 'error' ? (
                  <div className="text-center">
                    <p className="text-xl font-bold text-red-400 mb-2">Upload Failed</p>
                    <p className="text-sm text-gray-400">Video analysis feature may not be ready yet. Please try again later.</p>
                    <button 
                      onClick={() => setUploadStatus('idle')} 
                      className="mt-4 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (uploadStatus === 'done' || trafficData?.recommendation?.includes('complete')) ? (
                  <div className="w-full max-w-xl animate-in zoom-in-95 duration-500">
                    <div className="text-center mb-8">
                       <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-blue-400/30 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                        <HiCheckCircle className="text-5xl text-blue-400" />
                      </div>
                      <h3 className="text-3xl font-black text-white tracking-tight">Processing Complete</h3>
                      <p className="text-gray-400 mt-2 text-sm">AI has successfully analyzed the uploaded source.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group">
                        <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] mb-2">Total Count</p>
                        <p className="text-4xl font-black text-white group-hover:scale-105 transition-transform origin-left">{trafficData.vehicle_count}</p>
                        <p className="text-xs text-gray-500 mt-1 italic">Vehicles detected</p>
                      </div>
                      <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group">
                        <p className="text-[10px] text-green-400 font-black uppercase tracking-[0.2em] mb-2">Traffic Flow</p>
                        <p className="text-4xl font-black text-white group-hover:scale-105 transition-transform origin-left uppercase">{trafficData.density_level}</p>
                        <p className="text-xs text-gray-500 mt-1 italic">Density level</p>
                      </div>
                    </div>

                    <div className="mt-6 bg-blue-600/20 border border-blue-500/30 p-4 rounded-xl">
                      <div className="flex gap-3">
                        <HiInformationCircle className="text-xl text-blue-400 mt-0.5" />
                        <p className="text-sm text-blue-100 leading-relaxed font-medium">
                          <span className="font-bold">AI Insight:</span> {trafficData.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center group">
                    <div className="relative mb-8">
                       <FaRobot className="text-7xl mx-auto text-gray-800 transition-colors group-hover:text-gray-700" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="w-32 h-32 border border-blue-500/20 rounded-full animate-ping" />
                      </div>
                    </div>
                    <p className="text-xl font-bold text-gray-500">Ready for Analysis</p>
                    <p className="text-sm text-gray-600 mt-2 max-w-xs mx-auto">
                      Select an image or video file from your local storage to perform real-time AI vehicle classification and density mapping.
                    </p>
                  </div>
                )}

                {/* Aesthetic HUD Elements */}
                <div className="absolute top-6 right-6 flex flex-col items-end gap-1">
                  <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500/40 w-2/3" />
                  </div>
                  <p className="text-[8px] font-mono text-white/20 uppercase tracking-tighter">AI_V8_ENGINE_READY</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
