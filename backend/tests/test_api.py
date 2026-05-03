"""
Comprehensive tests for all Smart Parking API endpoints.

Usage:
    # Make sure the FastAPI server is running:
    #   cd backend
    #   uvicorn app.main:app --reload --port 8000
    #
    # Then run:
    #   pytest tests/test_api.py -v

Prerequisites:
    - PostgreSQL running on localhost:5432
    - Redis running on localhost:6379
    - Database seeded with admin user (run: python seed.py)
"""

import os
import sys
import pytest
import httpx

# Add backend root to path so imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.db.database import Base, engine, SessionLocal

BASE_URL = "http://localhost:8000/api"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# ── Use TestClient for fast, no-network tests ───────────────────────
client = TestClient(app)

# Token cache
_token = None


def get_auth_token():
    """Login once and cache the JWT token."""
    global _token
    if _token:
        return _token

    resp = client.post(f"{BASE_URL}/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    _token = resp.json()["data"]["token"]
    return _token


def auth_headers():
    return {"Authorization": f"Bearer {get_auth_token()}"}


# ═══════════════════════════════════════════════════════════════════
# 1. AUTH TESTS
# ═══════════════════════════════════════════════════════════════════
class TestAuth:
    def test_login_success(self):
        resp = client.post(f"{BASE_URL}/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "token" in data["data"]
        assert data["data"]["username"] == ADMIN_USERNAME

    def test_login_wrong_password(self):
        resp = client.post(f"{BASE_URL}/auth/login", json={"username": ADMIN_USERNAME, "password": "wrong"})
        assert resp.status_code == 401
        data = resp.json()
        assert data["success"] is False
        assert data["error_code"] == "INVALID_CREDENTIALS"

    def test_login_nonexistent_user(self):
        resp = client.post(f"{BASE_URL}/auth/login", json={"username": "ghost", "password": "x"})
        assert resp.status_code == 401
        assert resp.json()["error_code"] == "INVALID_CREDENTIALS"

    def test_get_me(self):
        resp = client.get(f"{BASE_URL}/auth/me", headers=auth_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["username"] == ADMIN_USERNAME

    def test_get_me_no_token(self):
        resp = client.get(f"{BASE_URL}/auth/me")
        assert resp.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════════
# 2. SLOT CRUD TESTS
# ═══════════════════════════════════════════════════════════════════
class TestSlots:
    _created_id = None

    def test_list_slots(self):
        resp = client.get(f"{BASE_URL}/slots")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)
        assert len(data["data"]) > 0

    def test_get_slot_by_id(self):
        resp = client.get(f"{BASE_URL}/slots")
        slot_id = resp.json()["data"][0]["id"]
        resp = client.get(f"{BASE_URL}/slots/{slot_id}")
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == slot_id

    def test_get_slot_not_found(self):
        resp = client.get(f"{BASE_URL}/slots/999999")
        assert resp.status_code == 404
        assert resp.json()["error_code"] == "SLOT_NOT_FOUND"

    def test_create_slot(self):
        resp = client.post(
            f"{BASE_URL}/slots",
            headers=auth_headers(),
            json={"slot_number": "TEST-001", "floor": 1, "zone": "T", "status": "available", "slot_type": "regular"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["slot_number"] == "TEST-001"
        TestSlots._created_id = data["data"]["id"]

    def test_create_slot_duplicate(self):
        resp = client.post(
            f"{BASE_URL}/slots",
            headers=auth_headers(),
            json={"slot_number": "TEST-001", "floor": 1, "zone": "T"},
        )
        assert resp.status_code == 409
        assert resp.json()["error_code"] == "DUPLICATE_SLOT"

    def test_update_slot(self):
        sid = TestSlots._created_id
        resp = client.put(
            f"{BASE_URL}/slots/{sid}",
            headers=auth_headers(),
            json={"status": "reserved"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "reserved"

    def test_delete_slot(self):
        sid = TestSlots._created_id
        resp = client.delete(f"{BASE_URL}/slots/{sid}", headers=auth_headers())
        assert resp.status_code == 200
        assert resp.json()["success"] is True


# ═══════════════════════════════════════════════════════════════════
# 3. LOG TESTS
# ═══════════════════════════════════════════════════════════════════
class TestLogs:
    _log_id = None

    def test_create_log_vehicle_enter(self):
        # Get first available slot
        slots_resp = client.get(f"{BASE_URL}/slots")
        slot_id = slots_resp.json()["data"][0]["id"]

        resp = client.post(
            f"{BASE_URL}/logs",
            headers=auth_headers(),
            json={"slot_id": slot_id, "event": "vehicle_enter", "license_plate": "ABC-1234"},
        )
        assert resp.status_code == 200, f"Failed: {resp.json()}"
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["event"] == "vehicle_enter"
        TestLogs._log_id = data["data"]["id"]

        # Verify slot is now occupied
        slot_resp = client.get(f"{BASE_URL}/slots/{slot_id}")
        assert slot_resp.json()["data"]["status"] == "occupied"

    def test_create_log_slot_not_found(self):
        resp = client.post(
            f"{BASE_URL}/logs",
            headers=auth_headers(),
            json={"slot_id": 999999, "event": "vehicle_enter"},
        )
        assert resp.status_code == 404

    def test_list_logs(self):
        resp = client.get(f"{BASE_URL}/logs", headers=auth_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "logs" in data["data"]
        assert "total" in data["data"]

    def test_list_logs_with_filters(self):
        resp = client.get(f"{BASE_URL}/logs?event=vehicle_enter&page=1&page_size=5", headers=auth_headers())
        assert resp.status_code == 200
        data = resp.json()
        for log in data["data"]["logs"]:
            assert log["event"] == "vehicle_enter"

    def test_recent_logs(self):
        resp = client.get(f"{BASE_URL}/logs/recent")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "logs" in data["data"]
        assert data["data"]["count"] <= 20


# ═══════════════════════════════════════════════════════════════════
# 4. DASHBOARD TESTS
# ═══════════════════════════════════════════════════════════════════
class TestDashboard:
    def test_summary(self):
        resp = client.get(f"{BASE_URL}/dashboard/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        d = data["data"]
        assert "total_slots" in d
        assert "available" in d
        assert "occupied" in d
        assert "reserved" in d
        assert "blocked" in d
        assert "today_logs" in d

    def test_slots_map(self):
        resp = client.get(f"{BASE_URL}/dashboard/slots-map")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)
        if len(data["data"]) > 0:
            entry = data["data"][0]
            assert "id" in entry
            assert "slot_number" in entry
            assert "status" in entry


# ═══════════════════════════════════════════════════════════════════
# 5. ERROR HANDLING TESTS
# ═══════════════════════════════════════════════════════════════════
class TestErrors:
    def test_422_validation_bad_login(self):
        resp = client.post(f"{BASE_URL}/auth/login", json={"username": "", "password": ""})
        assert resp.status_code == 422
        data = resp.json()
        assert data["success"] is False
        assert data["error_code"] == "VALIDATION_ERROR"

    def test_404_unknown_route(self):
        resp = client.get("/api/nonexistent")
        assert resp.status_code == 404

    def test_unauthorized_create_slot(self):
        resp = client.post(f"{BASE_URL}/slots", json={"slot_number": "X-1"})
        assert resp.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════════
# 6. CACHING TESTS (verify cache invalidation on mutation)
# ═══════════════════════════════════════════════════════════════════
class TestCaching:
    def test_slots_cache_invalidation(self):
        """Create → list → delete → list should reflect change."""
        # Create
        resp = client.post(
            f"{BASE_URL}/slots",
            headers=auth_headers(),
            json={"slot_number": "CACHE-TEST", "floor": 1, "zone": "C"},
        )
        assert resp.status_code == 200
        new_id = resp.json()["data"]["id"]

        # List and verify it appears
        resp = client.get(f"{BASE_URL}/slots")
        ids = [s["id"] for s in resp.json()["data"]]
        assert new_id in ids

        # Delete
        resp = client.delete(f"{BASE_URL}/slots/{new_id}", headers=auth_headers())
        assert resp.status_code == 200

        # List again — should be gone
        resp = client.get(f"{BASE_URL}/slots")
        ids = [s["id"] for s in resp.json()["data"]]
        assert new_id not in ids
