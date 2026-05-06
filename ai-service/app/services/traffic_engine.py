from app.services.inference_engine import inference_engine
from app.services.ensemble_engine import EnsembleEngine
import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)

# B1: Global instance of the high-performance EnsembleEngine
_ensemble = EnsembleEngine(inference_engine)

class TrafficAnalyzer:
    """Wrapper for backward compatibility, now powered by EnsembleEngine."""
    
    def analyze_frame(self, image_bytes: bytes):
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return {"vehicle_count": 0, "density_level": "low", "recommendation": "Invalid image", "boxes": []}
            
            # Use the new normalized ensemble pipeline
            return _ensemble.analyze_frame(img)
        except Exception as e:
            logger.error(f"[TrafficAnalyzer] Error: {e}")
            return {
                "vehicle_count": 0, 
                "density_level": "unknown", 
                "recommendation": "System error", 
                "boxes": [],
                "summary": "Analisis gagal."
            }

traffic_analyzer = TrafficAnalyzer()
