"""Clean JSON response builder for FastAPI endpoints."""
from fastapi.responses import JSONResponse
from typing import Any, Optional


def success_response(data: Any, status_code: int = 200) -> JSONResponse:
    """Build a standardized success JSON response.

    Format:
    {
        "success": true,
        "data": <payload>
    }
    """
    return JSONResponse(
        status_code=status_code,
        content={"success": True, "data": data},
    )


def error_response(message: str, status_code: int = 400, details: Optional[dict] = None) -> JSONResponse:
    """Build a standardized error JSON response.

    Format:
    {
        "success": false,
        "error": <message>,
        "details": <optional dict>
    }
    """
    body: dict[str, Any] = {"success": False, "error": message}
    if details is not None:
        body["details"] = details
    return JSONResponse(status_code=status_code, content=body)


def build_plate_response(plate: str, confidence: float) -> JSONResponse:
    """Convenience: return license plate recognition result."""
    return success_response({"plate": plate, "confidence": round(confidence, 4)})


def build_vehicle_response(vtype: str, confidence: float) -> JSONResponse:
    """Convenience: return vehicle classification result."""
    return success_response({"type": vtype, "confidence": round(confidence, 4)})


def build_demand_response(prediction: list[float], hours_ahead: int) -> JSONResponse:
    """Convenience: return demand prediction result."""
    return success_response({
        "prediction": [round(v, 4) for v in prediction],
        "hours_ahead": hours_ahead,
    })
