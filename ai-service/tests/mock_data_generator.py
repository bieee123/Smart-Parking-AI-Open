"""
Mock Data Generator — Smart Parking Demand Prediction Tests.

Generates realistic test data for:
  - Prediction input payloads
  - Historical occupancy series
  - Traffic volume series
  - Full pipeline test fixtures

Usage:
    from tests.mock_data_generator import MockDataGenerator
    gen = MockDataGenerator()
    gen.generate_occupancy_history(hours=48)
    gen.generate_prediction_request()
"""

import random
import json
from datetime import datetime, timedelta, timezone


class MockDataGenerator:
    """Generates mock parking data for testing the prediction pipeline."""

    # Realistic hourly occupancy profile (0-1 rate)
    BASE_PROFILE = {
        0: 0.15, 1: 0.12, 2: 0.10, 3: 0.08, 4: 0.10, 5: 0.15,
        6: 0.25, 7: 0.40, 8: 0.55, 9: 0.65,
        10: 0.75, 11: 0.82, 12: 0.88, 13: 0.90, 14: 0.92, 15: 0.88,
        16: 0.82, 17: 0.75, 18: 0.65, 19: 0.50,
        20: 0.40, 21: 0.32, 22: 0.25, 23: 0.18,
    }

    AREA_IDS = [
        "a1111111-1111-1111-1111-111111111111",
        "a2222222-2222-2222-2222-222222222222",
        "a3333333-3333-3333-3333-333333333333",
    ]

    def __init__(self, seed=None):
        if seed is not None:
            random.seed(seed)

    def generate_occupancy_history(self, hours=48, area_id=None):
        """
        Generate hourly occupancy history.

        Returns:
            List of dicts: [{"timestamp": "...", "occupancy_rate": 0.75, ...}]
        """
        area = area_id or random.choice(self.AREA_IDS)
        now = datetime.now(timezone.utc)
        data = []

        for i in range(hours, 0, -1):
            ts = now - timedelta(hours=i)
            hour = ts.hour
            base = self.BASE_PROFILE[hour]
            variation = random.uniform(-0.05, 0.05)
            rate = max(0.0, min(1.0, base + variation))

            data.append({
                "timestamp": ts.isoformat(),
                "area_id": area,
                "occupancy_rate": round(rate, 4),
                "occupied_slots": int(rate * 200),
                "total_slots": 200,
            })

        return data

    def generate_traffic_history(self, hours=48, area_id=None):
        """
        Generate hourly traffic volume history.

        Returns:
            List of dicts: [{"timestamp": "...", "volume": 120, ...}]
        """
        area = area_id or random.choice(self.AREA_IDS)
        now = datetime.now(timezone.utc)
        data = []

        for i in range(hours, 0, -1):
            ts = now - timedelta(hours=i)
            hour = ts.hour
            # Traffic roughly follows occupancy but noisier
            base_traffic = self.BASE_PROFILE[hour] * 300
            variation = random.uniform(-30, 30)
            volume = max(0, int(base_traffic + variation))

            data.append({
                "timestamp": ts.isoformat(),
                "area_id": area,
                "volume": volume,
                "vehicles_entering": int(volume * random.uniform(0.55, 0.65)),
                "vehicles_leaving": int(volume * random.uniform(0.35, 0.45)),
            })

        return data

    def generate_prediction_request(self, horizon=None):
        """
        Generate a valid prediction request payload.

        Returns:
            Dict matching API input schema.
        """
        if horizon is None:
            horizon = random.choice([3, 5, 12, 24])

        current_hour = random.randint(0, 23)
        occupancy_history = [round(v["occupancy_rate"], 4) for v in self.generate_occupancy_history(hours=6)]

        return {
            "current_hour": current_hour,
            "horizon": horizon,
            "history": {
                "parking_occupancy": occupancy_history,
                "traffic_volume": [v["volume"] for v in self.generate_traffic_history(hours=6)],
                "weather": random.choice(["sunny", "rainy", "cloudy", "snowy"]),
                "events": random.choice([[], ["concert"], ["sports_game"], ["conference"]]),
            },
        }

    def generate_prediction_response(self, horizon=None):
        """
        Generate a mock prediction response (as if from the model).

        Returns:
            Dict matching API output schema.
        """
        if horizon is None:
            horizon = random.choice([3, 5, 12, 24])

        current_hour = random.randint(0, 23)
        predictions = []

        for i in range(1, horizon + 1):
            future_hour = (current_hour + i) % 24
            base = self.BASE_PROFILE[future_hour]
            variation = random.uniform(-0.03, 0.03)
            predictions.append(round(max(0.0, min(1.0, base + variation)), 4))

        return {
            "success": True,
            "prediction": predictions,
            "hours_ahead": horizon,
            "confidence": round(random.uniform(0.65, 0.90), 2),
            "version": "0.1.0",
            "model_type": "placeholder-baseline",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def generate_violation_data(self, count=20):
        """Generate mock violation records."""
        violations = []
        types = ["illegal_parking", "blocking", "improper_parking", "overtime", "disabled_abuse"]

        for _ in range(count):
            violations.append({
                "area_id": random.choice(self.AREA_IDS),
                "violation_type": random.choice(types),
                "severity": random.choice(["low", "medium", "high"]),
                "severity_score": round(random.uniform(0.1, 0.95), 2),
                "timestamp": (datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 168))).isoformat(),
            })

        return sorted(violations, key=lambda x: x["severity_score"], reverse=True)

    def generate_bottleneck_data(self, count=5):
        """Generate mock bottleneck records."""
        bottlenecks = []
        types = ["congestion", "overload", "spillback", "entry_queue", "exit_block"]
        statuses = ["active", "mitigating", "resolved"]

        for _ in range(count):
            severity = round(random.uniform(0.3, 0.95), 2)
            bottlenecks.append({
                "area_id": random.choice(self.AREA_IDS),
                "bottleneck_type": random.choice(types),
                "severity_score": severity,
                "affected_slots": random.randint(5, 50),
                "occupancy_rate": round(severity * 0.9 + random.uniform(0, 0.1), 4),
                "resolution_status": random.choice(statuses),
                "timestamp": (datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 48))).isoformat(),
            })

        return sorted(bottlenecks, key=lambda x: x["severity_score"], reverse=True)

    def generate_full_test_dataset(self):
        """Generate complete test dataset for the analytics pipeline."""
        return {
            "occupancy_history": self.generate_occupancy_history(hours=168),  # 1 week
            "traffic_history": self.generate_traffic_history(hours=168),
            "violations": self.generate_violation_data(count=50),
            "bottlenecks": self.generate_bottleneck_data(count=10),
            "prediction_requests": [self.generate_prediction_request() for _ in range(10)],
            "prediction_responses": [self.generate_prediction_response() for _ in range(10)],
        }

    def to_json(self, data, filepath=None):
        """Serialize data to JSON string or file."""
        json_str = json.dumps(data, indent=2)
        if filepath:
            with open(filepath, "w") as f:
                f.write(json_str)
        return json_str


# ── Quick generation script ──────────────────────────────────────────────────

if __name__ == "__main__":
    gen = MockDataGenerator(seed=42)

    print("Generating mock test dataset...")
    dataset = gen.generate_full_test_dataset()

    print(f"\nDataset summary:")
    print(f"  Occupancy history:  {len(dataset['occupancy_history'])} records")
    print(f"  Traffic history:    {len(dataset['traffic_history'])} records")
    print(f"  Violations:         {len(dataset['violations'])} records")
    print(f"  Bottlenecks:        {len(dataset['bottlenecks'])} records")
    print(f"  Prediction requests:  {len(dataset['prediction_requests'])} records")
    print(f"  Prediction responses: {len(dataset['prediction_responses'])} records")

    # Save to file
    output_path = "tests/data/mock_test_dataset.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    gen.to_json(dataset, output_path)
    print(f"\nSaved to {output_path}")
