from ultralytics import YOLO
import logging
import cv2
import numpy as np

logger = logging.getLogger(__name__)

class TrafficAnalyzer:
    def __init__(self):
        # Load the standard YOLOv8 nano model for vehicle detection
        # This will be downloaded automatically on the first run
        self.model = YOLO("yolov8n.pt")
        # COCO class IDs: 2=car, 3=motorcycle, 5=bus, 7=truck
        self.target_classes = [2, 3, 5, 7] 

    def analyze_frame(self, image_bytes):
        # Decode the image bytes
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            logger.error("Failed to decode image.")
            return {"vehicle_count": 0, "density_level": "low", "recommendation": "Invalid image", "boxes": []}

        # 1. Run YOLOv8 inference
        results = self.model.predict(source=img, classes=self.target_classes, verbose=False)
        
        # 2. Count detected vehicles (Crowdedness metric)
        vehicle_count = len(results[0].boxes)
        
        # 3. Determine density level and AI recommendation
        density_level = "low"
        recommendation = "Traffic is smooth. No special action required."
        
        if vehicle_count > 15:
            density_level = "high"
            recommendation = "WARNING: Heavy traffic detected. Recommendation: Open backup gate (Gate B) or redirect incoming vehicles to off-street parking areas."
        elif vehicle_count > 7:
            density_level = "medium"
            recommendation = "Traffic is building up. Please monitor the main entrance closely."
            
        return {
            "vehicle_count": vehicle_count,
            "density_level": density_level,
            "recommendation": recommendation,
            "boxes": results[0].boxes.data.tolist() # Bounding box coordinates
        }

traffic_analyzer = TrafficAnalyzer()
