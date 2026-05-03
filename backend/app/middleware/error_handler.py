"""Global exception handlers — unified error response format."""

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic / FastAPI validation errors in unified format."""
    errors = exc.errors()
    messages = []
    for err in errors:
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        msg = err.get("msg", "")
        messages.append(f"{loc}: {msg}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "; ".join(messages),
            "error_code": "VALIDATION_ERROR",
        },
    )


async def integrity_error_handler(request: Request, exc: IntegrityError):
    """Handle SQLAlchemy integrity errors (FK violations, unique constraints)."""
    orig = exc.orig
    msg = str(orig) if orig else "Database integrity violation"
    error_code = "INTEGRITY_ERROR"

    # Detect unique violation from postgres
    if "duplicate key" in msg.lower() or "unique" in msg.lower():
        error_code = "DUPLICATE_ENTRY"

    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "success": False,
            "message": msg,
            "error_code": error_code,
        },
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all for unexpected errors."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "An unexpected error occurred",
            "error_code": "INTERNAL_ERROR",
        },
    )
