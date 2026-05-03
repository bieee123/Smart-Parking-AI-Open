import cv2
import requests
import time

AI_URL = "http://localhost:9000/ai/traffic/analyze"
BACKEND_URL = "http://localhost:8000/api/live/broadcast"

# Live CCTV stream from ATCS Dishub Medan
CCTV_URL = "https://atcsdishub.medan.go.id/stream/L2AHMADYANIPULAUPINANG/stream.m3u8"

def start_stream(video_source=0):
    cap = cv2.VideoCapture(video_source)
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: 
            print("Failed to read stream. Attempting to reconnect...")
            time.sleep(5)
            cap = cv2.VideoCapture(video_source) # Reconnect logic
            continue
            
        # Encode frame as JPEG
        _, img_encoded = cv2.imencode('.jpg', frame)
        files = {'image': ('frame.jpg', img_encoded.tobytes(), 'image/jpeg')}
        
        try:
            # 1. Send frame to YOLOv8 AI Service
            res_ai = requests.post(AI_URL, files=files).json()
            
            # 2. Forward analysis results (Vehicle count & recommendations) to Node.js
            traffic_data = res_ai.get("data", {})
            requests.post(BACKEND_URL, json=traffic_data)
            print(f"Sent: {traffic_data['vehicle_count']} vehicles - Status: {traffic_data['density_level']}")
            
        except Exception as e:
            print("Failed to process frame:", e)
            
        # Wait 3 seconds between frames to prevent overloading the ATCS server and our CPU
        time.sleep(3)

if __name__ == "__main__":
    start_stream(CCTV_URL)
