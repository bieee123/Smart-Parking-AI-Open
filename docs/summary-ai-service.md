# Smart Parking AI Service — Deep System Analysis

## 1. High-Level System Overview
The **Smart Parking AI Service** is a high-performance Python microservice built using **FastAPI**. It serves as the computer vision "brain" of the Smart Parking system, responsible for real-time video stream analysis, vehicle detection, license plate recognition (LPR), and parking violation detection.

The architecture is designed to be **modular** and **multi-model**, using an ensemble approach to combine detections from specialized neural networks. It communicates with a Node.js/PostgreSQL/MongoDB backend for data persistence and real-time broadcasting to user dashboards.

## 2. Folder & Module Breakdown
- **`/app/main.py`**: Entry point. Sets up FastAPI, middleware, and includes routers.
- **`/app/routers/`**: API layer.
    - `traffic.py`: Core endpoint for real-time stream analysis and image uploads.
    - `video.py`: Handles file-based video processing (batch/async).
    - `lpr.py`: Standalone license plate recognition.
- **`/app/services/`**: Logic layer.
    - `ensemble_engine.py`: Orchestrator that merges results from multiple models and lighting modes.
    - `inference_engine.py`: Low-level wrapper for **Ultralytics YOLO (ONNX)**. Handles model loading, pre-processing, and NMS.
    - `stream_processor.py`: Multi-threaded video stream handler (OpenCV + yt-dlp).
    - `lpr_engine.py`: Specialized logic for plate detection and OCR pipeline.
- **`/models/`**: Storage for `.onnx` model weights.
- **`/camera_worker.py`**: A standalone background script for continuous CCTV monitoring and backend syncing.

## 3. Complete AI Pipeline Flow (Scenario-Based)

### **Scenario A: Vehicle Close-up Upload (LPR & Classification)**
*Goal: Identify license plate and specific vehicle type for enforcement.*
1. **Preprocessing**: Image is normalized to 640x640 with letterbox padding.
2. **Detection**: Dual-model scan using `vehicle_model.onnx` (Type) and `lpr_model.onnx` (Plate area).
3. **Multi-Object Logic**: System detects **all** vehicles in frame (e.g., Car + Motorbike in one photo).
4. **LPR Pipeline**:
    - **Crop**: Extracts the detected plate region.
    - **Enhance**: 3-pass cleaning (Raw, CLAHE, Otsu Thresholding).
    - **OCR**: EasyOCR reads text; validated via Indonesian Plate Regex.
5. **Output**: Returns vehicle count, classification per object, and OCR text for the best-detected plate.

### **Scenario B: Parking Area Upload (Top-View Occupancy)**
*Goal: Analyze parking density and detect layout violations.*
1. **Top-View Detection**: Uses models trained for aerial/angled views of vehicle roofs.
2. **Density Assessment**:
    - **Low**: < 7 vehicles (Smooth).
    - **Medium**: 8 - 15 vehicles (Building up).
    - **High**: > 15 vehicles (Congested/Full).
3. **Violation Engine**: `illegal_model.onnx` scans for vehicles in prohibited zones (aisles/driveways).
4. **Night Mode Sync**: 
    - Measures average pixel brightness via `get_brightness()`.
    - If dark, system prepares for **BDD100K** enhancement model (Training in Progress).

### **Scenario C: Real-Time Video Stream (CCTV/IP Cam)**
*Goal: Continuous monitoring with minimal server load.*
1. **Frame Sampling**: `StreamProcessor` captures **1 frame every 0.5 - 3 seconds** (configurable).
2. **Real-Time Ensemble**: Each sampled frame undergoes the full Ensemble analysis.
3. **SSE Broadcast**: Detections are pushed immediately to the frontend via **Server-Sent Events**.
4. **Data Persistence**: Aggregated results (count & violations) are synced to MongoDB every 10 seconds for analytics history.

### **Summary of Multi-Context Logic:**
- **Near-Field Context**: Priorities **LPR & Vehicle Type**.
- **Far-Field Context**: Priorities **Density & Violations**.
- **Low-Light Context**: Priorities **BDD100K Enhancement**.

## 4. Model Inventory
| Model Name | Format | Task | Source/Framework |
| :--- | :--- | :--- | :--- |
| `vehicle_model.onnx` | ONNX | Vehicle Classification | YOLOv8n |
| `lpr_model.onnx` | ONNX | Plate Detection | YOLOv8n |
| `illegal_model.onnx` | ONNX | Violation Detection | YOLOv8n (Custom) |
| `crowd_detection_model.onnx` | ONNX | Traffic Congestion (Disabled) | YOLOv8 (Vehicle Density) |
| `easyocr` | PyTorch | Optical Character Recognition | Pre-trained EasyOCR |

## 5. Detection Pipeline Analysis
- **Framework**: Uses **Ultralytics YOLO** as the primary backend for ONNX inference.
- **Normalization**: All bounding boxes are converted to normalized coordinates `[x, y, w, h]` (0.0 to 1.0) before being sent to the frontend.
- **Efficiency**: Image size is locked to **640px**. `inference_engine.py` handles the padding logic to maintain aspect ratio.
- **Multi-Lighting Support**: `EnsembleEngine` calculates frame brightness to determine if "Night Mode" adjustments are needed (though current logic mostly reuses the vehicle model).

## 6. Parking Analytics Analysis
- **Logic**: Currently uses a **Detection-Based** approach via `illegal_model.onnx`.
- **Strengths**: Can detect generic "illegal parking" violations anywhere in the frame.
- **Weaknesses**: Lacks **Polygon-based Slot Definitions**. It doesn't know *where* specific slot A1 or A2 is located in physical space; it only detects the state of objects.
- **Occupancy**: Calculated based on the total vehicle count relative to hardcoded thresholds (e.g., >15 is "High Density").

## 7. OCR / ANPR Analysis
- **Flow**: Plate detection -> Multi-pass enhancement -> OCR.
- **Multi-Pass Strategy**:
    - **Pass 1**: Raw Color.
    - **Pass 2**: CLAHE (Contrast Enhancement).
    - **Pass 3**: Otsu Thresholding (Binarization).
- **Filtering**: Uses Regex `^[A-Z]{1,2}\s*\d{1,4}\s*[A-Z]{0,3}$` to validate Indonesian-style license plates.
- **Performance**: OCR is the slowest part of the pipeline. It is run only on the "Best Plate" (highest confidence) per frame.

## 8. Tracking Analysis
- **Current State**: The system is primarily **Frame-by-Frame**.
- **Instability**: Without a temporal tracker (like ByteTrack or DeepSORT), IDs aren't persistent. If a car is obscured for one frame, it might be counted as a "new" car in the next.
- **Missing**: No cross-camera re-identification (Re-ID).

## 9. Backend & API Architecture
- **Framework**: FastAPI (Asynchronous).
- **Communication**: REST for commands, SSE for live data, and HTTP POST for syncing to the Node.js backend.
- **Concurrency**: Uses `ThreadPoolExecutor` for parallel model inference in the ensemble engine.

## 10. Performance & Scalability Analysis
- **Bottlenecks**:
    1. **EasyOCR CPU usage**: Can drop FPS to <2 if many plates are processed.
    2. **Sequential Inference**: Running three YOLO models in a row adds latency.
- **Scalability**: The `StreamProcessor` uses threads, which is fine for 1-5 cameras, but for 20+ cameras, a **GPU-accelerated Multiprocessing** or **NVIDIA DeepStream** approach would be required.

## 11. Technical Debt Analysis
- **Error Handling**: Heavy reliance on broad `try-except Exception` blocks, which can hide specific hardware or model failures.
- **Mock Fallbacks**: `traffic.py` contains hardcoded mock data generation. While useful for UI testing, it can mask real AI failures in production logs.
- **Disabled Traffic Congestion Model**: The `crowd_detection_model.onnx` (intended for high-density vehicle detection) is currently hardcoded to skip inference due to class ID collisions with the standard vehicle model.
- **Model Pathing**: Paths are semi-hardcoded relative to the file structure.

## 12. Production Readiness Analysis
- **Demo**: ✅ **Ready**. High visual fidelity and stable SSE streaming.
- **Production**: ⚠️ **Caution**. Needs better error recovery, actual polygon-based slot management, and performance optimization for OCR.
- **Multi-Camera**: ⚠️ **Limited**. Currently scales linearly with CPU/GPU. Needs better resource management for >10 cameras.

## 13. Missing Components
1. **Polygon Slot Manager**: Interface to define "Slot A1" coordinates.
2. **Temporal Tracking**: To prevent "flickering" vehicle counts.
3. **Multi-LPR Support**: Current system only processes the "Best Plate" per frame; needs to support OCR for all detected vehicles simultaneously.
4. **Database Caching for OCR**: Store plate results per ID to avoid re-processing the same plate in every frame.
5. **GPU Auto-switching**: Better handling of CUDA vs CPU runtime selection.

## 14. Final Understanding Summary
The system is a **robust, feature-rich prototype** that excels at visual representation and multi-model analysis. It uses industry-standard tools (YOLOv8, ONNX, FastAPI) and has a clean, decoupled architecture. 

**Biggest Risks:** 
- **OCR Latency**: Could make the live dashboard feel "laggy" if not handled asynchronously.
- **Lack of Spatial Awareness**: The system detects *objects*, but doesn't yet understand *parking spaces* as distinct geometric entities.

**First Priority for Improvement:**
1. Implement a persistent tracker (ByteTrack).
2. Create a "Slot Definition" layer (Polygon ROI) to map detections to specific parking bays.
