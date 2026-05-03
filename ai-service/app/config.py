"""AI Service configuration."""
import os
from dotenv import load_dotenv

load_dotenv()

# Server
PORT = int(os.getenv("PORT", 9000))
HOST = os.getenv("HOST", "0.0.0.0")

# Model paths
LPR_MODEL_PATH = os.getenv("LPR_MODEL_PATH", "models/lpr_model.onnx")
VEHICLE_MODEL_PATH = os.getenv("VEHICLE_MODEL_PATH", "models/vehicle_model.onnx")
PREDICT_MODEL_PATH = os.getenv("PREDICT_MODEL_PATH", "models/prediction_model.pkl")

# CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:8000,http://localhost:5173").split(",")

# Inference settings
LPR_CONFIDENCE_THRESHOLD = float(os.getenv("LPR_CONFIDENCE_THRESHOLD", "0.5"))
VEHICLE_CONFIDENCE_THRESHOLD = float(os.getenv("VEHICLE_CONFIDENCE_THRESHOLD", "0.5"))
