import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.prediction_model import PredictionModel

def test():
    print("Testing PredictionModel loading...")
    pm = PredictionModel()
    print(f"Model loaded: {pm.model is not None}")
    print(f"Model Type: {pm.metadata.get('model_type')}")
    print(f"Trained At: {pm.metadata.get('trained_at')}")
    
    if pm.model:
        pred = pm.predict(hour=14, horizon=3)
        print(f"Sample Prediction (14:00 + 3h): {pred}")
    else:
        print("Model file not found, using baseline.")

if __name__ == "__main__":
    test()
