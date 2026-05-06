import cv2
import threading
import time
import logging
import queue
import yt_dlp
from app.services.lpr_engine import lpr_engine
from app.services.traffic_engine import traffic_analyzer
from app.services.inference_engine import inference_engine, CONFIDENCE_THRESHOLD

# ── EnsembleEngine (optional — graceful if unavailable) ────────────────
try:
    from app.services.ensemble_engine import EnsembleEngine
    _ensemble = EnsembleEngine(inference_engine)
except Exception as _ens_err:
    print(f"[StreamProcessor] EnsembleEngine unavailable: {_ens_err}")
    _ensemble = None

logger = logging.getLogger(__name__)

class StreamProcessor:
    def __init__(self):
        self.stream_url = None
        self.resolved_url = None
        self.is_running = False
        self.latest_result = {
            "vehicle_count": 0,
            "density_level": "low",
            "recommendation": "Waiting for stream...",
            "last_plate": None,
            "confidence": 0.0
        }
        self.thread = None
        self.result_queue = queue.Queue(maxsize=10)

        # ONNX InferenceEngine — models may be None (mock mode) if files not found
        self.inference_engine = inference_engine
        _loaded = self.inference_engine.models_loaded
        logger.info(
            "[StreamProcessor] InferenceEngine status — vehicle:%s lpr:%s parking:%s",
            _loaded['vehicle'], _loaded['lpr'], _loaded['parking']
        )

    def start(self, url: str):
        if self.is_running and self.stream_url == url:
            return
        
        self.stop()
        self.stream_url = url
        self.is_running = True
        self.thread = threading.Thread(target=self._process_stream, daemon=True)
        self.thread.start()
        logger.info(f"🚀 Started AI Stream Processor for: {url}")

    def stop(self):
        self.is_running = False
        if self.thread:
            # We don't join for long because VideoCapture might hang
            self.thread = None
        logger.info("🛑 Stopped AI Stream Processor")

    def _get_direct_url(self, url):
        """Extract direct m3u8 URL from YouTube or other sites using yt-dlp."""
        if "youtube.com" in url or "youtu.be" in url:
            logger.info(f"📺 Extracting direct URL from YouTube: {url}")
            try:
                ydl_opts = {
                    'format': 'best',
                    'quiet': True,
                    'no_warnings': True,
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    return info.get('url')
            except Exception as e:
                logger.error(f"❌ Failed to extract YouTube URL: {e}")
        return url

    def _process_stream(self):
        self.resolved_url = self._get_direct_url(self.stream_url)
        cap = cv2.VideoCapture(self.resolved_url)
        frame_count = 0
        
        while self.is_running:
            ret, frame = cap.read()
            if not ret:
                logger.warning("⚠️ Failed to grab frame, re-resolving and reconnecting...")
                cap.release()
                time.sleep(2)
                self.resolved_url = self._get_direct_url(self.stream_url)
                cap = cv2.VideoCapture(self.resolved_url)
                continue

            # Process every 15th frame to save CPU (approx every 0.5s for 30fps)
            frame_count += 1
            if frame_count % 15 != 0:
                continue

            try:
                # 1. Convert frame to bytes for LPR engine
                _, buffer = cv2.imencode('.jpg', frame)
                img_bytes = buffer.tobytes()

                # 2. Detect License Plate (existing engine — always runs)
                lpr_res = lpr_engine.predict(img_bytes)

                # 3. Use EnsembleEngine for vehicle/slot detection when frame is available
                camera_id = getattr(self, 'camera_id', 'CCTV')
                if _ensemble is not None:
                    det = _ensemble.analyze_frame(frame, camera_id=camera_id)
                    vehicle_count  = det.get('vehicle_count', 0)
                    density_level  = det.get('density_level', 'low')
                    recommendation = det.get('recommendation', '')
                    boxes          = det.get('boxes', [])
                    violations     = det.get('violations', [])
                    vehicle_types  = det.get('vehicle_types', {})
                    summary        = det.get('summary', '')
                    lighting_mode  = det.get('lighting_mode', 'unknown')
                else:
                    # Fallback to existing traffic_analyzer
                    traffic_res    = traffic_analyzer.analyze_frame(img_bytes)
                    onnx_detections = self.inference_engine.detect_vehicles(frame)
                    vehicle_count  = len(onnx_detections) if onnx_detections else traffic_res['vehicle_count']
                    density_level  = traffic_res['density_level']
                    recommendation = traffic_res['recommendation']
                    boxes          = []
                    violations     = []
                    vehicle_types  = {}
                    summary        = f"{camera_id}: {density_level}, {vehicle_count} kendaraan"
                    lighting_mode  = 'unknown'

                # 4. Update Latest Result — full SSE output shape
                if _ensemble is not None:
                    # Ensemble already includes plate_number, plate_confidence, last_plate, etc.
                    self.latest_result = det
                else:
                    self.latest_result = {
                        'vehicle_count': vehicle_count,
                        'density_level': density_level,
                        'recommendation': recommendation,
                        'plate_number': lpr_res.get('plate_number', lpr_res.get('plate', 'UNREADABLE')),
                        'plate_confidence': lpr_res.get('plate_confidence', lpr_res.get('confidence', 0.0)),
                        'last_plate': lpr_res.get('plate', 'UNREADABLE'),
                        'boxes': boxes,
                        'violations': violations,
                        'vehicle_types': vehicle_types,
                        'lighting_mode': lighting_mode,
                        'summary': summary,
                        'source': 'stream_fallback'
                    }

                # Push to queue for SSE
                if not self.result_queue.full():
                    self.result_queue.put(self.latest_result)

            except Exception as e:
                logger.error(f"❌ Error during frame processing: {e}")

        cap.release()

stream_processor = StreamProcessor()
