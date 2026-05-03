"""Comprehensive validation test suite for AI Microservice."""
import sys
import io
import base64
import json
import time
import requests
from PIL import Image

BASE = "http://localhost:9000"
PASSED = 0
FAILED = 0
RESULTS = []

def report(name, status, detail=""):
    global PASSED, FAILED
    icon = "✅ PASS" if status else "❌ FAIL"
    if status:
        PASSED += 1
    else:
        FAILED += 1
    RESULTS.append((name, icon, detail))
    print(f"  {icon}  {name}" + (f" — {detail}" if detail and not status else ""))

def make_image(color, size=(128, 64), fmt="PNG"):
    """Create a test image and return (bytes, base64_string)."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    raw = buf.getvalue()
    b64 = base64.b64encode(raw).decode()
    return raw, b64

# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  AI MICROSERVICE — FULL VALIDATION TEST SUITE")
print("=" * 60)

# ────────────────────────────────────────────────────────────
print("\n── 1. Health Check ─────────────────────────────────")
try:
    r = requests.get(f"{BASE}/ai/health", timeout=5)
    report("GET /ai/health → 200", r.status_code == 200, f"Got {r.status_code}")
    data = r.json()
    report("Response has 'success' field", "success" in data)
    report("Response has 'data' field", "data" in data)
    report("data.status == 'ok'", data.get("data", {}).get("status") == "ok")
    report("data.models_loaded is bool", isinstance(data.get("data", {}).get("models_loaded"), bool))
    report("Engines info present", "engines" in data.get("data", {}))
except Exception as e:
    report("GET /ai/health", False, str(e))

# ────────────────────────────────────────────────────────────
print("\n── 2. LPR — License Plate Recognition ──────────────")

# Test 2a: Multipart file upload
raw_img, b64_img = make_image((255, 0, 0), (128, 64), "JPEG")
try:
    r = requests.post(f"{BASE}/ai/lpr/recognize",
                      files={"image": ("test.jpg", raw_img, "image/jpeg")},
                      timeout=5)
    report("LPR: multipart upload → 200", r.status_code == 200, f"Got {r.status_code}")
    d = r.json().get("data", {})
    report("LPR: has 'plate' field", "plate" in d, f"plate={d.get('plate')}")
    report("LPR: has 'confidence' field", "confidence" in d, f"conf={d.get('confidence')}")
    report("LPR: confidence is float", isinstance(d.get("confidence"), (int, float)))
    report("LPR: confidence in [0,1]", 0 <= d.get("confidence", -1) <= 1)
except Exception as e:
    report("LPR: multipart upload", False, str(e))

# Test 2b: Base64 upload
try:
    r = requests.post(f"{BASE}/ai/lpr/recognize",
                      data={"image_b64": b64_img},
                      timeout=5)
    report("LPR: base64 upload → 200", r.status_code == 200, f"Got {r.status_code}")
    d = r.json().get("data", {})
    report("LPR: base64 returns plate", "plate" in d)
    report("LPR: base64 returns confidence", "confidence" in d)
except Exception as e:
    report("LPR: base64 upload", False, str(e))

# Test 2c: Deterministic — same image → same result
try:
    r1 = requests.post(f"{BASE}/ai/lpr/recognize", data={"image_b64": b64_img}, timeout=5)
    r2 = requests.post(f"{BASE}/ai/lpr/recognize", data={"image_b64": b64_img}, timeout=5)
    p1 = r1.json()["data"]["plate"]
    p2 = r2.json()["data"]["plate"]
    report("LPR: deterministic (same img → same plate)", p1 == p2, f"{p1} vs {p2}")
    c1 = r1.json()["data"]["confidence"]
    c2 = r2.json()["data"]["confidence"]
    report("LPR: deterministic (same img → same confidence)", c1 == c2, f"{c1} vs {c2}")
except Exception as e:
    report("LPR: determinism", False, str(e))

# Test 2d: Different image → different result
try:
    _, b64_img2 = make_image((0, 255, 0), (256, 128), "PNG")
    r1 = requests.post(f"{BASE}/ai/lpr/recognize", data={"image_b64": b64_img}, timeout=5)
    r2 = requests.post(f"{BASE}/ai/lpr/recognize", data={"image_b64": b64_img2}, timeout=5)
    p1 = r1.json()["data"]["plate"]
    p2 = r2.json()["data"]["plate"]
    report("LPR: different img → different plate", p1 != p2, f"{p1} vs {p2}")
except Exception as e:
    report("LPR: different image", False, str(e))

# Test 2e: Missing payload
try:
    r = requests.post(f"{BASE}/ai/lpr/recognize", timeout=5)
    report("LPR: missing payload → 400", r.status_code == 400, f"Got {r.status_code}")
except Exception as e:
    report("LPR: missing payload → 400", False, str(e))

# ────────────────────────────────────────────────────────────
print("\n── 3. Vehicle Classification ───────────────────────")

# Test 3a: Multipart
raw_img, b64_img = make_image((0, 0, 255), (128, 64), "JPEG")
try:
    r = requests.post(f"{BASE}/ai/vehicle/classify",
                      files={"image": ("test.jpg", raw_img, "image/jpeg")},
                      timeout=5)
    report("Vehicle: multipart → 200", r.status_code == 200, f"Got {r.status_code}")
    d = r.json().get("data", {})
    report("Vehicle: has 'type' field", "type" in d, f"type={d.get('type')}")
    report("Vehicle: has 'confidence'", "confidence" in d, f"conf={d.get('confidence')}")
    report("Vehicle: type is valid", d.get("type") in ["car", "motorcycle", "truck"],
           f"type={d.get('type')}")
except Exception as e:
    report("Vehicle: multipart", False, str(e))

# Test 3b: Base64
try:
    r = requests.post(f"{BASE}/ai/vehicle/classify",
                      data={"image_b64": b64_img}, timeout=5)
    report("Vehicle: base64 → 200", r.status_code == 200, f"Got {r.status_code}")
    d = r.json().get("data", {})
    report("Vehicle: base64 returns type", "type" in d)
except Exception as e:
    report("Vehicle: base64", False, str(e))

# Test 3c: Determinism
try:
    r1 = requests.post(f"{BASE}/ai/vehicle/classify", data={"image_b64": b64_img}, timeout=5)
    r2 = requests.post(f"{BASE}/ai/vehicle/classify", data={"image_b64": b64_img}, timeout=5)
    t1 = r1.json()["data"]["type"]
    t2 = r2.json()["data"]["type"]
    report("Vehicle: deterministic", t1 == t2, f"{t1} vs {t2}")
except Exception as e:
    report("Vehicle: determinism", False, str(e))

# Test 3d: Missing payload
try:
    r = requests.post(f"{BASE}/ai/vehicle/classify", timeout=5)
    report("Vehicle: missing payload → 400", r.status_code == 400, f"Got {r.status_code}")
except Exception as e:
    report("Vehicle: missing payload → 400", False, str(e))

# ────────────────────────────────────────────────────────────
print("\n── 4. Demand Prediction ────────────────────────────")

# Test 4a: Single hour
try:
    r = requests.post(f"{BASE}/ai/predict/demand",
                      json={"hour": 8, "horizon": 1}, timeout=5)
    report("Predict: horizon=1 → 200", r.status_code == 200, f"Got {r.status_code}")
    d = r.json().get("data", {})
    report("Predict: has 'prediction' list", "prediction" in d)
    report("Predict: returns 1 value", len(d.get("prediction", [])) == 1)
    report("Predict: values in [0,1]", all(0 <= v <= 1 for v in d.get("prediction", [])))
except Exception as e:
    report("Predict: horizon=1", False, str(e))

# Test 4b: 5 hours
try:
    r = requests.post(f"{BASE}/ai/predict/demand",
                      json={"hour": 10, "horizon": 5}, timeout=5)
    d = r.json().get("data", {})
    report("Predict: horizon=5 → 5 values", len(d.get("prediction", [])) == 5,
           f"Got {len(d.get('prediction', []))}")
except Exception as e:
    report("Predict: horizon=5", False, str(e))

# Test 4c: 24 hours
try:
    r = requests.post(f"{BASE}/ai/predict/demand",
                      json={"hour": 0, "horizon": 24}, timeout=5)
    d = r.json().get("data", {})
    report("Predict: horizon=24 → 24 values", len(d.get("prediction", [])) == 24,
           f"Got {len(d.get('prediction', []))}")
    report("Predict: all in [0,1]", all(0 <= v <= 1 for v in d.get("prediction", [])))
except Exception as e:
    report("Predict: horizon=24", False, str(e))

# Test 4d: Invalid hour
try:
    r = requests.post(f"{BASE}/ai/predict/demand",
                      json={"hour": 25, "horizon": 3}, timeout=5)
    report("Predict: invalid hour → 422", r.status_code == 422, f"Got {r.status_code}")
except Exception as e:
    report("Predict: invalid hour → 422", False, str(e))

# Test 4e: Midnight edge case
try:
    r = requests.post(f"{BASE}/ai/predict/demand",
                      json={"hour": 0, "horizon": 3}, timeout=5)
    report("Predict: hour=0 works", r.status_code == 200, f"Got {r.status_code}")
except Exception as e:
    report("Predict: hour=0", False, str(e))

# Test 4f: Peak hour
try:
    r = requests.post(f"{BASE}/ai/predict/demand",
                      json={"hour": 14, "horizon": 3}, timeout=5)
    d = r.json().get("data", {})
    report("Predict: hour=14 (peak)", r.status_code == 200)
    preds = d.get("prediction", [])
    report("Predict: peak hours reasonable", all(0.5 <= v <= 1.0 for v in preds),
           f"values={preds}")
except Exception as e:
    report("Predict: peak hour", False, str(e))

# ────────────────────────────────────────────────────────────
print("\n── 5. CORS & Server Config ─────────────────────────")

# Test CORS preflight
try:
    r = requests.options(f"{BASE}/ai/health",
                         headers={"Origin": "http://localhost:5173",
                                  "Access-Control-Request-Method": "GET"},
                         timeout=5)
    cors_header = r.headers.get("Access-Control-Allow-Origin", "")
    report("CORS: Allow-Origin header present", "localhost:5173" in cors_header or "*" in cors_header,
           f"Got: {cors_header}")
except Exception as e:
    report("CORS: preflight check", False, str(e))

# Test server port
try:
    r = requests.get(f"{BASE}/", timeout=5)
    report(f"Server responds on port 9000", r.status_code == 200)
except Exception as e:
    report("Server port 9000", False, str(e))

# ────────────────────────────────────────────────────────────
print("\n── 6. Multi-Request Stability ──────────────────────")

try:
    start = time.time()
    results = []
    for i in range(10):
        _, b64 = make_image((i * 25, i * 25, i * 25), (100, 50))
        r1 = requests.post(f"{BASE}/ai/lpr/recognize", data={"image_b64": b64}, timeout=5)
        r2 = requests.post(f"{BASE}/ai/vehicle/classify", data={"image_b64": b64}, timeout=5)
        r3 = requests.post(f"{BASE}/ai/predict/demand", json={"hour": i % 24, "horizon": 3}, timeout=5)
        results.append(r1.status_code == 200 and r2.status_code == 200 and r3.status_code == 200)
    elapsed = time.time() - start
    all_ok = all(results)
    report(f"Multi-request: 10 rounds (30 calls) all 200", all_ok,
           f"{sum(results)}/10 rounds passed in {elapsed:.2f}s")
except Exception as e:
    report("Multi-request stability", False, str(e))

# ────────────────────────────────────────────────────────────
print("\n── 7. Root Endpoint ────────────────────────────────")
try:
    r = requests.get(f"{BASE}/", timeout=5)
    d = r.json()
    report("GET / → 200", r.status_code == 200)
    report("Root has 'service' field", "service" in d)
    report("Root has 'endpoints' field", "endpoints" in d)
except Exception as e:
    report("Root endpoint", False, str(e))

# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print(f"  RESULTS: {PASSED} PASSED | {FAILED} FAILED | {PASSED + FAILED} TOTAL")
print("=" * 60)

# Detailed result table
print("\n📋 DETAILED RESULTS:")
print(f"{'No.':<4} {'Test Name':<45} {'Status':<10} {'Detail'}")
print("-" * 90)
for i, (name, status, detail) in enumerate(RESULTS, 1):
    print(f"{i:<4} {name:<45} {status:<10} {detail}")

print(f"\n{'='*60}")
confidence = round((PASSED / (PASSED + FAILED)) * 100) if (PASSED + FAILED) > 0 else 0
print(f"  Confidence Score: {confidence}%")
print(f"{'='*60}\n")

sys.exit(0 if FAILED == 0 else 1)
