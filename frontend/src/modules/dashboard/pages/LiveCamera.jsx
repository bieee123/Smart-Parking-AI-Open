import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { api } from '../../../services/api';
import { formatDate } from '../../../utils/helpers';
import {
  HiCamera, HiTruck, HiChip, HiCloudUpload, HiPlay, HiCheckCircle,
  HiRefresh, HiChevronRight, HiDownload, HiTrash, HiInformationCircle, HiX,
  HiIdentification
} from 'react-icons/hi';
import { FaFileVideo, FaRobot, FaParking, FaTrafficLight } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';


// Vehicle class mapping — from vehicle_model.onnx metadata
// {0:'car', 1:'threewheel', 2:'bus', 3:'truck', 4:'motorbike', 5:'van'}
const VEHICLE_LABELS = {
  0: 'CAR',
  1: 'THREEWHEEL',
  2: 'BUS',
  3: 'TRUCK',
  4: 'MOTORBIKE',
  5: 'VAN',
  99: 'PLATE',
};

// Color per vehicle type
const VEHICLE_COLORS = {
  0: '#22c55e',  // car - green
  1: '#f59e0b',  // threewheel - amber
  2: '#3b82f6',  // bus - blue
  3: '#8b5cf6',  // truck - purple
  4: '#06b6d4',  // motorbike - cyan
  5: '#10b981',  // van - emerald
  99: '#3b82f6',  // plate - blue
  'violation': '#ef4444', // red
};

const LiveCamera = () => {
  const { t } = useTranslation();

  // ── Persistent camera states via localStorage ──────────────────────────────
  const CAMERA_STATE_KEY = 'smart_parking_camera_states';

  const saveCameraStates = (cams) => {
    try {
      const existing = JSON.parse(localStorage.getItem(CAMERA_STATE_KEY) || '{}');
      const newState = { ...existing };
      cams.forEach(c => { newState[c.id] = c.status; });
      localStorage.setItem(CAMERA_STATE_KEY, JSON.stringify(newState));
    } catch (e) {
      console.error('Failed to save camera states', e);
    }
  };

  const HISTORY_KEY = 'smart_parking_analysis_history';
  const saveAnalysisHistory = (history) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50))); // limit to 50 items
    } catch (e) {
      console.error('Failed to save analysis history', e);
    }
  };

  const applySavedStates = (cams) => {
    try {
      const saved = JSON.parse(localStorage.getItem(CAMERA_STATE_KEY) || '{}');
      return cams.map(c => saved[c.id] ? { ...c, status: saved[c.id] } : c);
    } catch { return cams; }
  };

  const [cameras, setCameras] = useState(() => {
    const defaults = [
      { id: 'CAM-ENTRANCE', name: 'Entrance Gate', status: 'online', type: 'parking' },
      { id: 'CAM-ZONE-A', name: 'Zone A', status: 'online', type: 'parking' },
      { id: 'CAM-ZONE-B', name: 'Zone B', status: 'online', type: 'parking' },
      { id: 'CAM-ZONE-C', name: 'Zone C', status: 'online', type: 'parking' },
      { id: 'CAM-EXIT', name: 'Exit Gate', status: 'online', type: 'parking' },
    ];
    return applySavedStates(defaults);
  });

  const [streetCameras, setStreetCameras] = useState(() => {
    const defaults = [
      { id: 'ATCS-001', name: 'ATCS Pusat - 001', status: 'offline', area: 'Street' },
      { id: 'ATCS-002', name: 'ATCS Pusat - 002', status: 'offline', area: 'Street' },
      { id: 'ATCS-003', name: 'ATCS Pusat - 003', status: 'offline', area: 'Street' },
      { id: 'ATCS-004', name: 'ATCS Pusat - 004', status: 'offline', area: 'Street' },
    ];
    return applySavedStates(defaults);
  });

  const [trafficData, setTrafficData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(() => {
    const defaults = [
      { id: 'CAM-ENTRANCE', name: 'Entrance Gate', status: 'online', type: 'parking' },
    ];
    return applySavedStates(defaults)[0];
  });
  const [selectedStreetCamera, setSelectedStreetCamera] = useState(() => {
    const defaults = [
      { id: 'ATCS-001', name: 'ATCS Pusat', status: 'online' },
    ];
    return applySavedStates(defaults)[0];
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('parking'); // 'parking' or 'street'
  const [sourceMode, setSourceMode] = useState('live'); // 'live' or 'upload'
  const [isEditMode, setIsEditMode] = useState(false);

  // B1: File preview state
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileType, setFileType] = useState(null); // 'video' or 'image'

  // Upload states — enhanced from original isUploading/uploadProgress
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle'|'uploading'|'processing'|'done'|'error'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [analysisHistory, setAnalysisHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('smart_parking_analysis_history') || '[]');
    } catch { return []; }
  });
  // Keep isUploading as derived state for backward compatibility with existing UI
  const isUploading = uploadStatus === 'uploading' || uploadStatus === 'processing';

  const [streamResolving, setStreamResolving] = useState(false);

  // Violation alert state
  const [violationAlert, setViolationAlert] = useState(null);

  // B3: Plate alert state (from backend named SSE event)
  const [plateAlert, setPlateAlert] = useState(null);
  const plateAlertTimerRef = useRef(null);
  const progressSourceRef = useRef(null); // Ref to hold EventSource for cleanup
  const [allSlots, setAllSlots] = useState([]);
  const [syncingSlot, setSyncingSlot] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null); // Bounding box overlay canvas
  const fileInputRef = useRef(null);
  const previewRef = useRef(null); // Combined ref for video/image upload preview

  // Canvas bounding box helper

  // ── Canvas bounding box helper ───────────────────────────────────────────────
  const drawBoxes = useCallback((boxes, isViolation = false) => {
    const canvas = canvasRef.current;
    const media = previewRef.current || videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!boxes?.length || !media) return;

    const scaleX = canvas.width;
    const scaleY = canvas.height;

    boxes.forEach(([x, y, w, h, confidence, classId]) => {
      if ((confidence ?? 1) < 0.20) return;

      // Use VEHICLE_COLORS per class, red for violation
      const isViol = isViolation || classId === undefined;
      const color = isViol ? VEHICLE_COLORS['violation'] : (VEHICLE_COLORS[classId] ?? '#22c55e');
      const label = isViol ? 'VIOLATION' : (VEHICLE_LABELS[classId] || 'VEHICLE');

      // Bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY);

      // Label background
      ctx.fillStyle = color;
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      const confPct = confidence ? `${(confidence * 100).toFixed(0)}%` : '';
      const text = `${label} ${confPct}`;
      const textWidth = ctx.measureText(text).width;
      const bx = x * scaleX;
      const by = y * scaleY;
      ctx.fillRect(bx, by - 20, textWidth + 10, 20);

      // Label text
      ctx.fillStyle = 'white';
      ctx.fillText(text, bx + 5, by - 6);
    });
  }, []);

  // Sync canvas size to media element via ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const preview = previewRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
        // Redraw boxes immediately after resizing clears the canvas
        if (trafficData?.boxes) {
          drawBoxes(trafficData.boxes);
        }
      }
    });

    if (video) observer.observe(video);
    if (preview) observer.observe(preview);

    // Initial draw if we already have data
    if (trafficData?.boxes) {
      setTimeout(() => drawBoxes(trafficData.boxes), 100);
    }

    return () => observer.disconnect();
  }, [activeTab, sourceMode, previewUrl, trafficData, drawBoxes]);

  // Fetch camera list, logs, and analysis history on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [statusRes, logsRes, historyRes, slotsRes] = await Promise.all([
          api.camera.getStatus(),
          api.camera.getLogs(),
          api.ai.getHistory(),
          api.parking.getSlots(),
        ]);
        const allCams = statusRes.data || [];
        setAllSlots(slotsRes?.data || []);

        // Split cameras by type
        const parkingCams = allCams.filter(c => c.type === 'parking');
        const streetCams = allCams.filter(c => c.type === 'street');

        // Merge with initial mocks if DB doesn't have them
        const mergedParking = [...parkingCams];
        cameras.forEach(mock => {
          if (!mergedParking.find(m => m.id === mock.id)) mergedParking.push(mock);
        });

        const mergedStreet = [...streetCams.map(c => ({ ...c, streamUrl: c.stream_url }))];
        streetCameras.forEach(hard => {
          if (!mergedStreet.find(m => m.id === hard.id)) mergedStreet.push(hard);
        });

        const finalParkingCams = applySavedStates(mergedParking);
        const finalStreetCams = applySavedStates(mergedStreet);

        setCameras(finalParkingCams);
        setStreetCameras(finalStreetCams);

        setLogs(logsRes.data?.logs || []);

        // Merge DB history with local history, avoiding duplicates by ID
        const dbHistory = historyRes.data || [];
        setAnalysisHistory(prev => {
          const combined = [...dbHistory];
          prev.forEach(local => {
            if (!combined.find(c => c.id === local.id)) combined.push(local);
          });
          const sorted = combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          saveAnalysisHistory(sorted);
          return sorted;
        });

        if (finalParkingCams.length > 0) setSelectedCamera(finalParkingCams[0]);
        if (finalStreetCams.length > 0) setSelectedStreetCamera(finalStreetCams[0]);
      } catch (err) {
        console.error('Camera fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const toggleCameraStatus = async (id, currentStatus, type) => {
    const newStatus = currentStatus === 'online' ? 'offline' : 'online';

    // 1. Calculate updated list
    const targetList = type === 'parking' ? cameras : streetCameras;
    const updated = targetList.map(c => c.id === id ? { ...c, status: newStatus } : c);

    // 2. Update UI states
    if (type === 'parking') {
      setCameras(updated);
      if (selectedCamera?.id === id) setSelectedCamera({ ...selectedCamera, status: newStatus });
    } else {
      setStreetCameras(updated);
      if (selectedStreetCamera?.id === id) setSelectedStreetCamera({ ...selectedStreetCamera, status: newStatus });
    }

    // 3. Save to localStorage (merging is handled inside saveCameraStates)
    saveCameraStates(updated);

    try {
      // 4. Persistent update to backend DB
      await api.camera.updatePersistentStatus(id, newStatus);
    } catch (err) {
      console.warn('Backend persist failed — localStorage state still saved:', err.message);
    }
  };

  // B1: Robust box redraw trigger — draw vehicles then violations on top
  useEffect(() => {
    if (trafficData?.boxes) {
      const timer = setTimeout(() => {
        drawBoxes(trafficData.boxes, false);
        // Draw violations in red on top if present
        if (trafficData?.violations?.length > 0) {
          const canvas = canvasRef.current;
          if (canvas) {
            // Don't clear — add violations on top of vehicle boxes
            const ctx = canvas.getContext('2d');
            const scaleX = canvas.width;
            const scaleY = canvas.height;
            trafficData.violations.forEach(([x, y, w, h, conf]) => {
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 3;
              ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY);
              ctx.fillStyle = '#ef4444';
              ctx.font = 'bold 11px Inter, system-ui';
              const text = `ILLEGAL ${conf ? (conf * 100).toFixed(0) + '%' : ''}`;
              const tw = ctx.measureText(text).width;
              ctx.fillRect(x * scaleX, y * scaleY - 20, tw + 10, 20);
              ctx.fillStyle = 'white';
              ctx.fillText(text, x * scaleX + 5, y * scaleY - 6);
            });
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [trafficData, drawBoxes, sourceMode, previewUrl]);

  // HLS Stream Handler for Street Tab (with YouTube resolution)
  useEffect(() => {
    // Only run if tab is street AND camera is online
    if (activeTab === 'street' && selectedStreetCamera?.streamUrl && videoRef.current && selectedStreetCamera.status === 'online') {
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
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.src = "";
        }
      };
    } else {
      // Cleanup if offline or tab changed
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
      }
    }
  }, [activeTab, selectedStreetCamera, selectedStreetCamera?.status]);

  // Dynamic SSE Source for AI Detections
  useEffect(() => {
    // Only connect AI stream if camera is online
    const isParkingOnline = activeTab === 'parking' && selectedCamera?.status === 'online';
    const isStreetOnline = activeTab === 'street' && selectedStreetCamera?.status === 'online' && selectedStreetCamera?.streamUrl;

    if (!isParkingOnline && !isStreetOnline) {
      setTrafficData(null);
      return;
    }

    let url = '/api/live/stream';
    if (activeTab === 'street') {
      url = `/ai/traffic/stream?url=${encodeURIComponent(selectedStreetCamera.streamUrl)}`;
    }

    const eventSource = new EventSource(url);

    // Default message handler
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setTrafficData(data);

        // Violation alert
        if (data.violations?.length > 0) {
          setViolationAlert({
            location: data.violations[0]?.location || selectedStreetCamera?.name || 'Detected area',
            timestamp: new Date().toISOString(),
          });
          setTimeout(() => setViolationAlert(null), 8000);
        }

        // Log detected plate — prefer new plate_number field, fallback to last_plate
        const detectedPlate = data.plate_number || data.last_plate;
        const isValidPlate = detectedPlate
          && detectedPlate !== 'NO_PLATE_DETECTED'
          && detectedPlate !== 'UNREADABLE'
          && detectedPlate !== 'N/A';

        if (isValidPlate) {
          setLogs(prev => [{
            id: Date.now(),
            camera_id: selectedStreetCamera?.id || selectedCamera?.id || 'AI',
            event: 'PLATE_DETECTED',
            plate: detectedPlate,
            plate_confidence: data.plate_confidence || null,
            timestamp: new Date().toISOString(),
          }, ...prev.slice(0, 99)]);
        }
      } catch (e) {
        console.error('Failed to parse AI stream data', e);
      }
    };

    // B3: Named SSE event — plate_alert from blacklist check
    eventSource.addEventListener('plate_alert', (event) => {
      try {
        const alert = JSON.parse(event.data);
        setPlateAlert(alert);
        if (plateAlertTimerRef.current) clearTimeout(plateAlertTimerRef.current);
        plateAlertTimerRef.current = setTimeout(() => setPlateAlert(null), 12000);

        // Also push to logs
        setLogs(prev => [{
          id: Date.now(),
          camera_id: alert.camera_id || 'unknown',
          event: 'PLATE_ALERT',
          plate: alert.plate,
          reason: alert.reason,
          timestamp: alert.timestamp,
        }, ...prev]);
      } catch (e) {
        console.error('plate_alert parse error', e);
      }
    });

    return () => eventSource.close();
  }, [activeTab, selectedStreetCamera, sourceMode]);

  // Persistent Video Job Monitoring
  useEffect(() => {
    const savedJobId = localStorage.getItem('active_video_job');
    if (savedJobId && sourceMode === 'upload' && uploadStatus === 'idle') {
      console.log("Resuming video job:", savedJobId);
      resumeVideoJob(savedJobId);
    }

    return () => {
      if (progressSourceRef.current) progressSourceRef.current.close();
    };
  }, [sourceMode]);

  const resumeVideoJob = (jobId) => {
    setUploadStatus('processing');
    setUploadProgress(0);

    if (progressSourceRef.current) progressSourceRef.current.close();
    const progressSource = new EventSource(`/ai/traffic/process-status?job_id=${jobId}`);
    progressSourceRef.current = progressSource;

    progressSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setUploadProgress(data.progress ?? 0);

        if (data.result) {
          // Normalise plate: prefer plate_number, fallback to last_plate
          const plate = data.result.plate_number || data.result.last_plate || 'UNREADABLE';
          const plateConf = data.result.plate_confidence ?? null;

          // Update current preview incrementally
          setTrafficData({
            vehicle_count: data.result.total_vehicles || data.result.vehicle_count || 0,
            density_level: data.result.avg_density || data.result.density_level || 'medium',
            plate_number: plate,
            plate_confidence: plateConf,
            last_plate: plate,   // keep for legacy renders
            boxes: data.result.boxes || [],
            source: 'video-live',
          });

          // Upsert into history incrementally
          setAnalysisHistory(prev => {
            const exists = prev.find(item => item.id === jobId);
            const newData = {
              id: jobId,
              vehicle_count: data.result.total_vehicles || data.result.vehicle_count || 0,
              density_level: data.result.avg_density || data.result.density_level || 'medium',
              plate_number: plate,
              plate_confidence: plateConf,
              last_plate: plate,
              timestamp: exists?.timestamp || new Date().toISOString(),
            };
            const sorted = exists
              ? prev.map(item => item.id === jobId ? newData : item)
              : [newData, ...prev];
            saveAnalysisHistory(sorted);
            return sorted;
          });
        }

        if (data.status === 'done') {
          setUploadStatus('done');
          localStorage.removeItem('active_video_job');
          progressSource.close();
        } else if (data.status === 'error') {
          setUploadStatus('error');
          localStorage.removeItem('active_video_job');
          progressSource.close();
        }
      } catch (err) {
        console.error("SSE error:", err);
        progressSource.close();
        setUploadStatus('error');
      }
    };
    progressSource.onerror = () => {
      progressSource.close();
      // If error occurs, maybe job was deleted or expired
      localStorage.removeItem('active_video_job');
    };
  };

  const handleSyncToSlot = async () => {
    if (!syncingSlot || !trafficData) return;

    const plate = trafficData.plate_number || trafficData.last_plate;
    if (!plate || plate === 'UNREADABLE' || plate === 'N/A') {
      alert("Cannot sync: No valid license plate detected.");
      return;
    }

    try {
      setIsSyncing(true);
      // Update slot status to occupied with detected data
      // This will automatically trigger a parking log creation in the backend
      await api.parking.updateSlot(syncingSlot, {
        status: 'occupied',
        is_occupied: true,
        license_plate: plate,
        vehicle_type: 'car', // Default to car, or could infer from detection
      });

      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to sync to slot:', err);
      alert('Failed to sync to slot. Check console for details.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Create local preview
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const isImage = file.type.startsWith('image/');
    setFileType(isImage ? 'image' : 'video');

    const formData = new FormData();
    formData.append(isImage ? 'image' : 'video', file);

    try {
      setUploadStatus('uploading');
      setUploadProgress(10);
      setUploadResult(null);

      // Simulate progress for image processing to make it feel real
      let progressInterval;
      if (isImage) {
        progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + Math.floor(Math.random() * 5) + 1; // Increment by 1-5%
          });
        }, 300);
      }

      const endpoint = isImage ? '/ai/traffic/analyze' : '/ai/traffic/upload';
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Upload failed: HTTP ${response.status}`);
      const result = await response.json();

      if (isImage) {
        if (progressInterval) clearInterval(progressInterval);
        // Image analysis is synchronous
        setUploadStatus('done');
        setUploadResult(result.data);
        setTrafficData(result.data);
        setAnalysisHistory(prev => {
          const updated = [{
            id: Date.now(),
            ...result.data,
            timestamp: new Date().toISOString()
          }, ...prev];
          saveAnalysisHistory(updated);
          return updated;
        });
        setUploadProgress(100);
      } else {
        // Video analysis is asynchronous
        const jobId = result.data?.job_id;
        if (!jobId) {
          // Fallback if video.py not active
          setUploadStatus('done');
          setUploadResult(result);
          setTrafficData(result);
          return;
        }

        setUploadStatus('processing');
        localStorage.setItem('active_video_job', jobId);
        resumeVideoJob(jobId);
      }
    } catch (err) {
      console.error("Upload failed", err);
      setUploadStatus('error');
    }
  };

  const handleDownload = () => {
    if (!trafficData) return;
    const blob = new Blob([JSON.stringify(trafficData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = () => {
    setTrafficData(null);
    setUploadResult(null);
    setUploadStatus('idle');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
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

  const streetCameraLogs = logs.filter(
    (l) => l.camera_id === selectedStreetCamera?.id
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Violation Alert Banner */}
      {violationAlert && (
        <div className="mb-4 bg-red-600 text-white px-4 py-3 rounded-lg flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="text-lg">⚠</span>
            {t('live_camera.illegal_parking')} &mdash; {violationAlert.location}
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
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center shadow-sm">
          <HiCamera className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('live_camera.title')}</h1>
          <p className="text-gray-500 text-sm">{t('live_camera.desc')}</p>
        </div>
      </div>

      {/* Tab Switcher & Edit Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit border border-gray-200">
          <button
            onClick={() => {
              setActiveTab('parking');
              setSourceMode('live');
            }}
            className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'parking' && sourceMode === 'live'
              ? 'bg-white text-primary-600 shadow-sm border border-gray-100'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <FaParking className={activeTab === 'parking' && sourceMode === 'live' ? 'text-primary-600' : 'text-gray-400'} />
            {t('live_camera.parking_cctv')}
          </button>
          <button
            onClick={() => {
              setActiveTab('street');
              setSourceMode('live');
            }}
            className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'street' && sourceMode === 'live'
              ? 'bg-white text-primary-600 shadow-sm border border-gray-100'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <FaTrafficLight className={activeTab === 'street' && sourceMode === 'live' ? 'text-primary-600' : 'text-gray-400'} />
            {t('live_camera.street_traffic')}
          </button>
          <button
            onClick={() => setSourceMode('upload')}
            className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition-all ${sourceMode === 'upload'
              ? 'bg-white text-primary-600 shadow-sm border border-gray-100'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <HiChip className={sourceMode === 'upload' ? 'text-primary-600' : 'text-gray-400'} />
            {t('live_camera.video_analytics')}
          </button>
        </div>

        {sourceMode === 'live' && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500">{t('live_camera.edit_mode')}</span>
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isEditMode ? 'bg-primary-600' : 'bg-gray-300'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEditMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>
        )}
      </div>


      {/* Parking CCTV Tab */}
      {activeTab === 'parking' && sourceMode === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Camera List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{t('live_camera.parking_cameras')}</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {cameras.map((camera) => (
                  <div
                    key={camera.id}
                    className={`w-full p-4 text-left flex items-center justify-between transition-colors ${selectedCamera?.id === camera.id ? 'bg-primary-50' : 'hover:bg-gray-50'
                      }`}
                  >
                    <button
                      onClick={() => setSelectedCamera(camera)}
                      className="flex-1 text-left"
                    >
                      <p className="font-medium text-gray-900">{camera.name}</p>
                      <p className="text-sm text-gray-500">
                        {camera.status === 'online' ? (
                          <span className="text-green-600">● Online</span>
                        ) : (
                          <span className="text-red-500">● Offline</span>
                        )}
                      </p>
                    </button>

                    {isEditMode && (
                      <button
                        onClick={() => toggleCameraStatus(camera.id, camera.status, 'parking')}
                        className={`ml-2 px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${camera.status === 'online'
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-green-100 text-green-600 hover:bg-green-200'
                          }`}
                      >
                        {camera.status === 'online' ? 'Turn Off' : 'Turn On'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Events (Left) */}
            <div className="bg-white rounded-lg shadow mt-6">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{t('live_camera.parking_alerts')}</h2>
              </div>
              <div className="divide-y divide-gray-100 max-h-[160px] overflow-y-auto">
                {logs.length > 0 ? (
                  logs.slice(0, 15).map((log) => (
                    <div key={log.id} className="p-3 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900 uppercase">{log.camera_id}</span>
                        <span className="text-gray-400">{formatDate(log.timestamp)}</span>
                      </div>
                      <p className="text-gray-600">
                        {log.event.replace(/_/g, ' ').toLowerCase()}
                        {log.plate && <span className="ml-1 text-gray-400">— {log.plate}</span>}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-400 text-sm">{t('live_camera.no_events')}</div>
                )}
              </div>
            </div>
          </div>

          {/* Camera Feed & Events for Camera */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedCamera?.name || t('live_camera.select_camera')}
                </h2>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium uppercase">{t('live_camera.live_stream')}</span>
              </div>

              <div className="aspect-video bg-[#1a1d24] flex flex-col items-center justify-center relative group">
                <svg className="w-16 h-16 text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <div className="text-center px-10">
                  <h3 className="text-lg font-bold text-gray-300">{t('live_camera.feed_placeholder')}</h3>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-md">
                    {t('live_camera.feed_desc')}
                  </p>
                  {selectedCamera?.linked_slot && (
                    <p className="text-sm text-primary-500 mt-4 font-bold">
                      {t('live_camera.linked_to')} <span className="underline">{selectedCamera.linked_slot}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Events for [Camera Name] */}
            <div className="bg-white rounded-lg shadow h-[220px] flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between shrink-0">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-tight">
                  {t('live_camera.events_for', { name: selectedCamera?.name || t('live_camera.camera') })}
                </h2>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  {t('live_camera.live_feed')}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {cameraLogs.length > 0 ? (
                  cameraLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="p-4 flex items-center justify-between border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">{log.event.replace(/_/g, ' ').toLowerCase()}</span>
                        {log.plate && <span className="text-xs font-mono text-gray-400">{log.plate}</span>}
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(log.timestamp)}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    {t('live_camera.no_logs')}
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
                <h2 className="text-lg font-semibold text-gray-900">{t('live_camera.street_cameras')}</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {streetCameras.map((camera) => (
                  <div
                    key={camera.id}
                    className={`w-full p-4 text-left flex items-center justify-between transition-colors ${selectedStreetCamera?.id === camera.id ? 'bg-primary-50' : 'hover:bg-gray-50'
                      }`}
                  >
                    <button
                      onClick={() => setSelectedStreetCamera(camera)}
                      className="flex-1 text-left"
                    >
                      <p className="font-medium text-gray-900">{camera.name}</p>
                      <p className="text-sm text-gray-500">
                        {camera.status === 'online' ? (
                          <span className="text-green-600">● Online</span>
                        ) : (
                          <span className="text-red-500">● Offline</span>
                        )}
                      </p>
                    </button>

                    {isEditMode && (
                      <button
                        onClick={() => toggleCameraStatus(camera.id, camera.status, 'street')}
                        className={`ml-2 px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${camera.status === 'online'
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-green-100 text-green-600 hover:bg-green-200'
                          }`}
                      >
                        {camera.status === 'online' ? 'Turn Off' : 'Turn On'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow mt-6">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{t('live_camera.traffic_alerts')}</h2>
              </div>
              <div className="divide-y divide-gray-100 max-h-[160px] overflow-y-auto">
                {logs.filter(l => streetCameras.find(sc => sc.id === l.camera_id)).length > 0 ? (
                  logs.filter(l => streetCameras.find(sc => sc.id === l.camera_id)).slice(0, 10).map((log) => (
                    <div key={log.id} className="p-3 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900 uppercase">{log.camera_id}</span>
                        <span className="text-gray-400">{formatDate(log.timestamp)}</span>
                      </div>
                      <p className="text-gray-600">
                        {log.event.replace(/_/g, ' ').toLowerCase()}
                        {log.plate && <span className="ml-1 text-gray-400">— {log.plate}</span>}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-400 text-sm">{t('live_camera.no_traffic_alerts')}</div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{selectedStreetCamera?.name || t('live_camera.select_street_camera')}</h2>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium uppercase">{t('live_camera.live_stream')}</span>
              </div>
              <div className="aspect-video bg-gray-900 relative">
                {selectedStreetCamera?.status === 'online' ? (
                  <>
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
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                    <div className="text-center p-8 bg-gray-800/30 rounded-2xl border border-dashed border-gray-700">
                      <div className="w-20 h-20 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <HiCamera className="text-4xl text-gray-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-400 mb-2">{t('live_camera.feed_unavailable')}</h3>
                      <p className="text-gray-600 max-w-xs mx-auto">
                        {isEditMode ? t('live_camera.enable_to_resume') : t('live_camera.contact_support')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow mt-6 h-[220px] flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-gray-50/50 shrink-0">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-tight">
                  {t('live_camera.events_for', { name: selectedStreetCamera?.name || t('live_camera.street_camera') })}
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {streetCameraLogs.length > 0 ? (
                  streetCameraLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="p-4 flex items-center justify-between border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">{log.event.replace(/_/g, ' ').toLowerCase()}</span>
                        {log.plate && <span className="text-xs font-mono text-gray-400">{log.plate}</span>}
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(log.timestamp)}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    {t('live_camera.no_logs')}
                  </div>
                )}
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
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{t('live_camera.upload_video')}</h2>
                  <p className="text-sm text-gray-500 mt-1">{t('live_camera.upload_desc')}</p>
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 gap-10">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative group cursor-pointer border-3 border-dashed rounded-[2rem] p-6 transition-all flex flex-col items-center justify-center gap-3 ${sourceMode === 'upload' ? 'bg-primary-50/30 border-primary-200 hover:border-primary-400 hover:bg-primary-50' : 'bg-gray-50 border-gray-200'
                      }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="video/*,image/*"
                      onChange={handleVideoUpload}
                    />
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-xl shadow-primary-500/10 flex items-center justify-center text-primary-600 transition-transform group-hover:scale-110">
                      <HiCloudUpload className="text-3xl" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-gray-900">{t('live_camera.drop_file')}</h3>
                      <p className="text-sm text-gray-500 mt-2">{t('live_camera.drop_desc')}</p>
                    </div>
                  </div>
                </div>

                {isUploading ? (
                  <div className="mt-8 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{t('live_camera.processing')}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200/50">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : uploadStatus === 'done' ? (
                  <div className="mt-8 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3 animate-in zoom-in duration-300">
                    <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center shrink-0">
                      <HiCheckCircle className="text-xl" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-green-800 uppercase tracking-wider">{t('live_camera.analysis_complete')}</p>
                      <p className="text-[10px] text-green-600 font-medium">{t('live_camera.analysis_success')}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Analysis History */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mt-6 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">{t('live_camera.history')}</h2>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{analysisHistory.length} {t('live_camera.entries')}</span>
              </div>
              <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                {analysisHistory.length > 0 ? (
                  analysisHistory.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-gray-900">
                          {item.id.toString().includes('VIDEO') ? t('live_camera.video_analysis') : t('live_camera.image_analysis')}
                        </p>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 rounded text-[9px] font-bold text-blue-600 uppercase">
                          {item.vehicle_count || 0} {t('live_camera.vehicles')}
                        </span>
                        <span className={`px-2 py-0.5 border rounded text-[9px] font-bold uppercase ${item.density_level === 'high' ? 'bg-red-50 border-red-100 text-red-600' :
                          item.density_level === 'medium' ? 'bg-yellow-50 border-yellow-100 text-yellow-600' :
                            'bg-green-50 border-green-100 text-green-600'
                          }`}>
                          {item.density_level || 'low'}
                        </span>
                        {(() => {
                          const p = item.plate_number || item.last_plate;
                          if (!p || p === 'N/A' || p === 'UNREADABLE') return null;
                          return (
                            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-[9px] font-bold text-indigo-600 font-mono flex items-center gap-1">
                              <HiIdentification className="text-xs" /> {p}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center py-12">
                    <p className="text-xs text-gray-400 italic">{t('live_camera.no_sessions')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Results Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[650px]">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{t('live_camera.analysis_result')}</h2>
                {trafficData && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-blue-500 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {t('live_camera.source')}: {trafficData?.source?.toUpperCase() || 'UNKNOWN'}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={handleDownload} className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors" title={t('live_camera.download')}>
                        <HiDownload className="text-xl" />
                      </button>
                      <button onClick={handleDelete} className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors" title={t('live_camera.clear')}>
                        <HiTrash className="text-xl" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {trafficData?.summary && (
                <div className="px-5 py-2 bg-blue-50/50 border-b border-blue-100/50">
                  <p className="text-[11px] text-blue-700 font-medium italic">
                    &ldquo;{trafficData.summary}&rdquo;
                  </p>
                </div>
              )}

              <div className="flex-1 bg-gray-900 relative flex items-center justify-center overflow-hidden">
                {previewUrl ? (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                    {fileType === 'video' ? (
                      <video
                        ref={previewRef}
                        src={previewUrl}
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
                        loop
                        muted
                      />
                    ) : (
                      <img
                        ref={previewRef}
                        src={previewUrl}
                        className="w-full h-full object-contain"
                        alt="Preview"
                      />
                    )}
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    />

                    {/* Overlay stats for 'done' status */}
                    {(uploadStatus === 'done' && trafficData) && (
                      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-xl p-4 rounded-2xl border border-white/20 animate-in fade-in zoom-in duration-500 shadow-2xl z-30">
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col">
                            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">{t('live_camera.vehicles')}</p>
                            <p className="text-2xl font-black text-white leading-none">{trafficData?.vehicle_count || 0}</p>
                          </div>
                          <div className="w-px h-10 bg-white/10" />
                          <div className="flex flex-col">
                            <p className="text-[10px] text-green-400 font-black uppercase tracking-widest mb-1">{t('dashboard.license_plate')}</p>
                            <p className="text-xl font-mono font-bold text-white leading-none">
                              {trafficData?.plate_number || trafficData?.last_plate || 'N/A'}
                            </p>
                            {trafficData?.plate_confidence > 0 && (
                              <p className="text-[9px] text-green-400/70 mt-0.5">
                                {Math.round(trafficData.plate_confidence * 100)}% {t('live_camera.conf')}
                              </p>
                            )}
                          </div>
                          <div className="w-px h-10 bg-white/10" />
                          <div className="flex flex-col">
                            <p className="text-[10px] text-yellow-400 font-black uppercase tracking-widest mb-1">{t('live_camera.density')}</p>
                            <p className="text-xl font-black text-white leading-none uppercase">{trafficData?.density_level || 'low'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sync to Slot UI */}
                    {uploadStatus === 'done' && trafficData && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center gap-4 z-30 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col">
                          <label className="text-[10px] text-gray-400 font-bold uppercase mb-1">{t('live_camera.assign_to_slot')}</label>
                          <select
                            value={syncingSlot}
                            onChange={(e) => setSyncingSlot(e.target.value)}
                            className="bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg border border-gray-700 outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">{t('live_camera.select_slot')}</option>
                            {allSlots.filter(s => !s.is_occupied).map(slot => (
                              <option key={slot.id} value={slot.id}>{t('live_camera.slot')} {slot.slot_number} ({slot.zone})</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={handleSyncToSlot}
                          disabled={!syncingSlot || isSyncing}
                          className={`mt-4 px-6 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${syncSuccess
                            ? 'bg-green-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-700 disabled:text-gray-500'
                            }`}
                        >
                          {isSyncing ? (
                            <HiRefresh className="animate-spin" />
                          ) : syncSuccess ? (
                            <HiCheckCircle className="text-lg" />
                          ) : (
                            <HiRefresh />
                          )}
                          {syncSuccess ? 'Synced!' : isSyncing ? 'Syncing...' : 'Sync to Map'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : isUploading ? (
                  <div className="w-full max-w-xl space-y-8 animate-pulse p-8">
                    <div className="text-center mb-8">
                      <div className="w-24 h-24 bg-white/5 rounded-full mx-auto mb-6 border-2 border-white/10" />
                      <div className="h-8 w-64 bg-white/5 rounded mx-auto mb-2" />
                      <div className="h-4 w-48 bg-white/5 rounded mx-auto" />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-white/5 p-6 rounded-2xl border border-white/10 h-32" />
                      <div className="bg-white/5 p-6 rounded-2xl border border-white/10 h-32" />
                    </div>
                  </div>
                ) : uploadStatus === 'error' ? (
                  <div className="text-center p-8">
                    <p className="text-xl font-bold text-red-400 mb-2">Analysis Failed</p>
                    <p className="text-sm text-gray-400">Could not process this file. Please check format.</p>
                    <button
                      onClick={() => setUploadStatus('idle')}
                      className="mt-4 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <div className="text-center group p-8">
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
              </div>
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
      )}
    </div>
  );
};

export default LiveCamera;
