"""End-to-end ensemble pipeline validation after RC fix."""
import cv2, os
from dotenv import load_dotenv
load_dotenv(override=True)

frame = cv2.imread('test_vehicle_debug.jpg')
print('Frame:', frame.shape)

from app.services.inference_engine import InferenceEngine
ie = InferenceEngine()
from app.services.ensemble_engine import EnsembleEngine
ens = EnsembleEngine(ie)

result = ens.analyze_frame(frame, camera_id='DEBUG_TEST')

print('=== ENSEMBLE RESULT ===')
print('vehicle_count:   ', result['vehicle_count'])
print('density_level:   ', result['density_level'])
print('boxes count:     ', len(result['boxes']))
print('plates count:    ', len(result['plates']))
print('plate_number:    ', result['plate_number'])
print('occupancy:       ', result['occupancy_summary'])
print('source:          ', result['source'])
print('inference_ms:    ', result['inference_ms'])
print('lighting_mode:   ', result['lighting_mode'])
print('vehicle_types:   ', result['vehicle_types'])
print('violations:      ', len(result['violations']))
print('is_mock:         ', result.get('is_mock', False))
print()
print('=== BOXES (first 3) ===')
for i, b in enumerate(result['boxes'][:3]):
    print('  Box', i, ':', b)

print()
print('=== DETECTION RESULT ===')
if result['vehicle_count'] > 0:
    print('PASS: Vehicles detected -', result['vehicle_count'])
else:
    print('FAIL: Still zero detections')
