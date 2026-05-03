# 🧠 Smart Parking AI Service

AI microservice for the Smart Parking System. Provides License Plate Recognition (LPR), Vehicle Type Classification, and Parking Demand Prediction via REST API.

---

## 📁 Project Structure

```
ai-service/
├── app/
│   ├── main.py                 # FastAPI application entry point
│   ├── config.py               # Configuration (.env loader)
│   ├── routers/
│   │   ├── lpr.py              # POST /ai/lpr/recognize
│   │   ├── vehicle.py          # POST /ai/vehicle/classify
│   │   ├── predict.py          # POST /ai/predict/demand
│   │   └── health.py           # GET  /ai/health
│   ├── services/
│   │   ├── lpr_engine.py       # License Plate Recognition engine (ONNX/mock)
│   │   ├── vehicle_engine.py   # Vehicle Classification engine (ONNX/mock)
│   │   └── model_predictor.py  # Demand Prediction engine (sklearn/mock)
│   └── utils/
│       ├── image_tools.py      # Image decoding (base64/bytes → cv2)
│       ├── response_builder.py # Standardized JSON response wrapper
│       └── schemas.py          # Pydantic request/response models
├── models/                     # Place trained model files here
│   ├── lpr_model.onnx
│   ├── vehicle_model.onnx
│   └── prediction_model.pkl
├── requirements.txt
├── .env
└── README.md
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd ai-service
pip install -r requirements.txt
```

### 2. Configure Environment

Edit `.env` if needed (defaults work out of the box):

```env
LPR_MODEL_PATH=models/lpr_model.onnx
VEHICLE_MODEL_PATH=models/vehicle_model.onnx
PREDICT_MODEL_PATH=models/prediction_model.pkl
PORT=9000
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:8000,http://localhost:5173
```

> **Note:** The service runs in **mock mode** automatically when model files are not present. All endpoints are fully functional without real ML models.

### 3. Run the Service

```bash
uvicorn app.main:app --host 0.0.0.0 --port 9000 --reload
```

The API will be available at **http://localhost:9000**

- **Swagger docs:** http://localhost:9000/docs
- **ReDoc:** http://localhost:9000/redoc

---

## 📡 API Endpoints

### 1. Health Check

```
GET /ai/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "models_loaded": true,
    "engines": {
      "lpr": "loaded",
      "vehicle": "loaded",
      "predictor": "loaded"
    }
  }
}
```

### 2. License Plate Recognition

```
POST /ai/lpr/recognize
Content-Type: multipart/form-data

image: <file>
```

Or via base64:
```
POST /ai/lpr/recognize
Content-Type: application/x-www-form-urlencoded

image_b64=data:image/jpeg;base64,/9j/4AAQSkZJRg...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plate": "B 1234 XYZ",
    "confidence": 0.9234
  }
}
```

### 3. Vehicle Type Classification

```
POST /ai/vehicle/classify
Content-Type: multipart/form-data

image: <file>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "car",
    "confidence": 0.8845
  }
}
```

### 4. Parking Demand Prediction

```
POST /ai/predict/demand
Content-Type: application/json

{
  "hour": 1,
  "horizon": 3
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prediction": [0.12, 0.10, 0.08],
    "hours_ahead": 3
  }
}
```

---

## 🧪 Testing with cURL

### Health Check
```bash
curl http://localhost:9000/ai/health
```

### LPR (with file)
```bash
curl -X POST http://localhost:9000/ai/lpr/recognize \
  -F "image=@sample_plate.jpg"
```

### Vehicle Classification
```bash
curl -X POST http://localhost:9000/ai/vehicle/classify \
  -F "image=@car_photo.jpg"
```

### Demand Prediction
```bash
curl -X POST http://localhost:9000/ai/predict/demand \
  -H "Content-Type: application/json" \
  -d '{"hour": 8, "horizon": 6}'
```

---

## 🔗 Integration with Node.js Backend

The Node.js backend communicates with this AI service via HTTP REST:

```javascript
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:9000/ai';

// License Plate Recognition
async function recognizePlate(imageBuffer) {
  const formData = new FormData();
  formData.append('image', imageBuffer, 'plate.jpg');

  const res = await fetch(`${AI_SERVICE_URL}/lpr/recognize`, {
    method: 'POST',
    body: formData,
  });
  const json = await res.json();
  return json.data; // { plate, confidence }
}

// Vehicle Classification
async function classifyVehicle(imageBuffer) {
  const formData = new FormData();
  formData.append('image', imageBuffer, 'vehicle.jpg');

  const res = await fetch(`${AI_SERVICE_URL}/vehicle/classify`, {
    method: 'POST',
    body: formData,
  });
  const json = await res.json();
  return json.data; // { type, confidence }
}

// Demand Prediction
async function predictDemand(hour, horizon = 3) {
  const res = await fetch(`${AI_SERVICE_URL}/predict/demand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hour, horizon }),
  });
  const json = await res.json();
  return json.data; // { prediction: [...], hours_ahead: N }
}
```

---

## 🤖 Replacing Mock Models with Real ONNX Models

1. Train your models and export them:
   - **LPR:** → `models/lpr_model.onnx`
   - **Vehicle classifier:** → `models/vehicle_model.onnx`
   - **Demand predictor:** → `models/prediction_model.pkl` (sklearn joblib)

2. Place them in the `models/` directory.

3. Restart the service — it will automatically detect and load real models.

4. Update the `_decode_onnx_output()` methods in `lpr_engine.py` and `vehicle_engine.py` to match your actual model output tensor shapes.

---

## ⚙️ Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `9000` | Service port |
| `HOST` | `0.0.0.0` | Bind address |
| `LPR_MODEL_PATH` | `models/lpr_model.onnx` | Path to LPR ONNX model |
| `VEHICLE_MODEL_PATH` | `models/vehicle_model.onnx` | Path to vehicle classifier ONNX model |
| `PREDICT_MODEL_PATH` | `models/prediction_model.pkl` | Path to sklearn prediction model |
| `CORS_ORIGINS` | `http://localhost:8000,http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `LPR_CONFIDENCE_THRESHOLD` | `0.5` | Minimum confidence for LPR results |
| `VEHICLE_CONFIDENCE_THRESHOLD` | `0.5` | Minimum confidence for vehicle classification |
