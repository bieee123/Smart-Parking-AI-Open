import sys
print("Python executable:", sys.executable)
try:
    import fastapi
    print("FastAPI: OK")
    import ultralytics
    print("Ultralytics: OK")
    import torch
    print("Torch: OK")
    print("CUDA available:", torch.cuda.is_available())
except Exception as e:
    print("ERROR:", e)
