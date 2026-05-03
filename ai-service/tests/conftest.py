"""Shared pytest fixtures for all AI service tests."""

import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


@pytest.fixture(scope="session")
def ai_service_root():
    """Return the ai-service root directory path."""
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture(scope="session")
def required_directories(ai_service_root):
    """List of directories that must exist for the architecture to be valid."""
    return [
        "models",
        "training",
        "app",
        "tests",
        "app/models",
        "app/utils",
        "app/services",
        "app/routers",
    ]


@pytest.fixture
def valid_prediction_request():
    """A valid prediction request payload."""
    return {
        "current_hour": 14,
        "horizon": 5,
        "history": {
            "parking_occupancy": [0.70, 0.75, 0.72],
            "traffic_volume": [120, 130, 125],
        },
    }


@pytest.fixture
def invalid_prediction_requests():
    """Invalid payloads for error testing."""
    return [
        {},  # Empty
        {"current_hour": 25},  # Hour out of range
        {"current_hour": -1},  # Negative hour
        {"current_hour": "14"},  # Wrong type
        {"horizon": 5},  # Missing current_hour
    ]
