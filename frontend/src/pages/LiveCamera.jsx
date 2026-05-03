import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { api } from '../services/api';
import { formatDate } from '../utils/helpers';

export default function LiveCamera() {
  const [cameras, setCameras] = useState([]);
  const [trafficData, setTrafficData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [selectedStreetCamera, setSelectedStreetCamera] = useState({ id: 'ATCS-001', name: 'ATCS Medan - Simpang Pos', status: 'online' });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('parking'); // 'parking' or 'street'
  const [streamResolving, setStreamResolving] = useState(false);
  const videoRef = useRef(null);

  // Mock Street Cameras with real URL for the first one
  const streetCameras = [
    { 
      id: 'ATCS-001', 
      name: 'ATCS Medan - Simpang Pos', 
      status: 'online', 
      area: 'Street',
      streamUrl: 'https://atcsdishub.medan.go.id/stream/L2AHMADYANIPULAUPINANG/stream.m3u8' 
    },
    { 
      id: 'ATCS-004', 
      name: 'Jalur Puncak - Gunung Mas', 
      status: 'online', 
      area: 'Street',
      streamUrl: 'https://www.youtube.com/watch?v=465lj-w4DPs'
    },
    { id: 'ATCS-002', name: 'ATCS Medan - Jln. Thamrin', status: 'online', area: 'Street' },
    { id: 'ATCS-003', name: 'ATCS Medan - Jln. Gatot Subroto', status: 'offline', area: 'Street' },
  ];

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
  }, [activeTab, selectedStreetCamera]);

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

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit border border-gray-200">
        <button
          onClick={() => setActiveTab('parking')}
          className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'parking'
              ? 'bg-white text-primary-600 shadow-sm border border-gray-100'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          Parking CCTV
        </button>
        <button
          onClick={() => setActiveTab('street')}
          className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'street'
              ? 'bg-white text-primary-600 shadow-sm border border-gray-100'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          Street Traffic
        </button>
      </div>

      {activeTab === 'parking' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
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

          {/* Camera Feed Placeholder */}
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
                {/* Parking Camera Feed UI */}
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

              {/* Logs for selected camera */}
              {cameraLogs.length > 0 && (
                <div className="p-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Events for {selectedCamera.name}
                  </h3>
                  <div className="space-y-2">
                    {cameraLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded">
                        <span className="text-gray-700">
                          {log.event.replace(/_/g, ' ')}
                          {log.plate && <span className="ml-2 font-mono text-xs text-gray-500">{log.plate}</span>}
                        </span>
                        <span className="text-gray-400 text-xs">{formatDate(log.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Street Traffic Tab */}
      {activeTab === 'street' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
          {/* Street Camera List */}
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

            {/* Recent Traffic Alerts */}
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
                <div className="p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-600">Flow Improved</span>
                    <span className="text-xs text-gray-400">5m ago</span>
                  </div>
                  <p className="text-gray-600 mt-0.5">Jln. Thamrin traffic is easing</p>
                </div>
              </div>
            </div>
          </div>

          {/* Street Camera Feed & Analysis */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedStreetCamera?.name || 'Select a street camera'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">AI Analysis Stream Active</p>
                </div>
                {selectedStreetCamera && (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${selectedStreetCamera.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    {selectedStreetCamera.status}
                  </span>
                )}
              </div>

              <div className="aspect-video bg-gray-900 relative overflow-hidden group">
                {selectedStreetCamera ? (
                  <>
                    {/* Real Video Feed for Street */}
                    <div className="absolute inset-0 bg-black">
                      {streamResolving ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <div className="text-center">
                            <p className="text-blue-400 font-mono text-sm tracking-widest animate-pulse">RESOLVING AI STREAM</p>
                            <p className="text-white/40 text-[10px] mt-1 italic italic">Connecting via yt-dlp gateway...</p>
                          </div>
                        </div>
                      ) : selectedStreetCamera.streamUrl ? (
                        <video 
                          ref={videoRef}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                          <p className="text-gray-500 text-sm font-mono tracking-widest uppercase">No Stream Source Available</p>
                        </div>
                      )}
                    </div>

                    {/* CCTV Overlays */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
                        <span className="text-[10px] font-mono text-white/80 tracking-widest uppercase">
                          LIVE ATCS MEDAN — {selectedStreetCamera.name}
                        </span>
                      </div>
                      
                      {/* Real AI Detection Badges (Floating on video) */}
                      {trafficData?.last_plate && trafficData.last_plate !== "NO_PLATE_DETECTED" && (
                        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 animate-in zoom-in-50 duration-300">
                          <div className="bg-blue-600/90 backdrop-blur-md border-2 border-white px-6 py-2 rounded-lg shadow-[0_0_20px_rgba(37,99,235,0.5)]">
                            <p className="text-[8px] text-blue-100 font-bold uppercase tracking-widest mb-1">Plate Recognized</p>
                            <p className="text-2xl font-black text-white font-mono tracking-tighter">
                              {trafficData.last_plate}
                            </p>
                            <div className="mt-1 h-1 bg-white/20 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-400 transition-all duration-500" 
                                style={{ width: `${(trafficData.confidence || 0) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Scanning Laser Line */}
                      {selectedStreetCamera.status === 'online' && (
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400/20 to-transparent h-[2px] animate-scan top-0" />
                      )}
                    </div>

                    {/* AI Data Overlay if trafficData exists */}
                    {trafficData && (
                      <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/90 via-black/20 to-transparent">
                        <div className="flex items-end justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                trafficData.density_level === 'high' ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-green-500'
                              }`} />
                              <span className="text-white font-bold tracking-wider">{trafficData.density_level.toUpperCase()} DENSITY</span>
                            </div>
                            <p className="text-white/60 text-[10px] italic">AI Recommendation: {trafficData.recommendation}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-blue-400 text-2xl font-black">{trafficData.vehicle_count}</p>
                            <p className="text-white/40 text-[8px] uppercase font-bold tracking-tighter">Vehicles Detected</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-black/40">
                    <p className="text-gray-500 font-medium tracking-wide italic">STREET_UPLINK_DISCONNECTED</p>
                  </div>
                )}
              </div>

              {/* Mock Events for Street Camera */}
              <div className="p-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Events for {selectedStreetCamera?.name}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded">
                    <span className="text-gray-700">Vehicle congestion detected</span>
                    <span className="text-gray-400 text-xs">Just now</span>
                  </div>
                  <div className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded">
                    <span className="text-gray-700">Emergency vehicle detected (Ambulance)</span>
                    <span className="text-gray-400 text-xs">10m ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
