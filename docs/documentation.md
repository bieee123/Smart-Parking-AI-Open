## Smart Parking Management System - Project Summary

### Project Summary
We have been building an intelligent **Smart Parking and Infrastructure Demand Management System** featuring a modern, real-time dashboard. The project architecture is divided into three main components:

1. **Frontend (React + Vite + Tailwind)**: 
   - Built a comprehensive dashboard featuring several views: an **Analytics Dashboard**, a **Live Camera** monitoring view, a **Parking Map**, a **Simulator Page**, and an **Executive Summary** page.
   - Recently, we finalized the Simulator and Executive Summary pages, hooking them up with real-time data visualizations to track parking demand, revenue, and usage statistics.
2. **Backend (Node.js + Express + PostgreSQL + MongoDB + Redis)**:
   - Developed a robust API to manage users, parking slots, live parking sessions (entry/exit logs), and camera status.
   - Utilized PostgreSQL (via Drizzle ORM) for structured data like users and parking slots, MongoDB for unstructured logs and AI detection events, and Redis for performance caching.
3. **AI Microservice (Python + FastAPI)**:
   - Created a separate AI service designed to handle License Plate Recognition (LPR), Vehicle Type Classification, and Parking Demand Prediction.

---

### Why We Can't Connect the Live CCTV Integration Yet

While the infrastructure is in place to log camera statuses and display a user interface for it, we cannot hook up actual, real-time CCTV feeds at this moment due to the following missing pieces:

1. **No Video Stream Ingestion Pipeline**
   - Live CCTV cameras output continuous video streams (usually RTSP streams). Currently, our system only supports sending *single static images* or base64 data to the AI service for license plate detection (`POST /ai/lpr/recognize`). We do not have a streaming server or a frame-extraction pipeline to continuously pull frames from a live video feed and send them to the AI service.
2. **AI Models are in "Mock Mode"**
   - The Python AI microservice is currently built to run in "mock mode". While the endpoints exist, we haven't trained and deployed the actual ONNX ML models (`lpr_model.onnx`, `vehicle_model.onnx`) required to run computer vision over real camera footage.
3. **Frontend Video Player is a Placeholder**
   - On the `LiveCamera.jsx` page, the video feed area is strictly a UI placeholder. Web browsers cannot play raw RTSP streams directly; we would need to implement an intermediate streaming server (like WebRTC or HLS) and a dedicated video player library in React to render the live footage.

### Next Steps for CCTV:
To make the CCTV work, we would need to introduce a streaming media server (like MediaMTX or a Node-Media-Server) to convert RTSP feeds into a web-friendly format, train our ML models, and build a background worker script that continuously samples frames from the streams and routes them to our AI microservice.

---

## 🧪 Testing Process

To fully test the Smart Parking Management System locally, follow these steps:

### 1. Automated Full-Stack Start
The simplest way to start the entire system (Frontend and Backend) is to use the provided auto-run script at the project root:
- **Windows (CMD):** `auto-run.bat`
- **Windows (PowerShell):** `.\auto-run.ps1`
- **Linux/Mac:** `./auto-run.sh`

This script will automatically install dependencies, set up environment variables, run database migrations, and start both the Node.js backend and React frontend.

### 2. Testing the Backend & APIs
- Navigate to `http://localhost:8000/api/system/health` in your browser or via Postman to verify the Node.js server is up and connected to PostgreSQL, MongoDB, and Redis.
- Use tools like Postman or Insomnia to hit the core API routes (e.g., `GET /api/parking/slots`, `GET /api/camera/status`) to ensure JSON data is returned successfully.
- You can access the database GUI by running `npm run db:studio` inside the `backend/` directory to inspect PostgreSQL records visually.

### 3. Testing the AI Service
Since the AI service is a standalone Python FastAPI microservice, it must be started separately:
1. Open a new terminal and navigate to the `ai-service/` directory.
2. Install dependencies: `pip install -r requirements.txt`
3. Run the server: `uvicorn app.main:app --host 0.0.0.0 --port 9000 --reload`
4. Access the Swagger UI documentation at `http://localhost:9000/docs`.
5. From the Swagger UI, you can manually test the mock endpoints:
   - `POST /ai/lpr/recognize` by uploading a sample license plate image.
   - `POST /ai/vehicle/classify` by uploading a car image.
   - `POST /ai/predict/demand` to see the simulated demand prediction JSON output.

### 4. Testing the Frontend UI
- Once the frontend is running (via the auto-run script or `npm run dev` in the `frontend/` folder), navigate to `http://localhost:5173`.
- **Dashboard**: Verify that live metrics, revenue, and active parking sessions load correctly from the backend.
- **Simulator Page**: Interact with the simulator controls. Add/remove vehicles from slots and verify that the changes reflect immediately in the UI and are stored correctly in the backend logs.
- **Executive Summary**: Review the charts and data tables to ensure the analytics logic correctly aggregates the backend log data.
- **Map & Camera Pages**: Navigate to the Map and Camera pages to verify the layout and placeholders render without errors.
