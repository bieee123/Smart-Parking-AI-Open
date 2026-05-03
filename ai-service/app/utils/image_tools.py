"""Image processing utilities."""
import base64
import io
import cv2
import numpy as np
from PIL import Image


ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def base64_to_cv2(b64_string: str) -> np.ndarray:
    """Decode a base64-encoded image to a cv2 (BGR) numpy array.

    Supports both raw base64 strings and data-URI prefixes
    (e.g. 'data:image/png;base64,...').
    """
    # Strip data-URI prefix if present
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]

    raw_bytes = base64.b64decode(b64_string)

    # Decode with PIL first — handles many formats reliably
    pil_image = Image.open(io.BytesIO(raw_bytes))

    # Convert to RGB if needed (e.g. RGBA, P, L modes)
    if pil_image.mode != "RGB":
        pil_image = pil_image.convert("RGB")

    # PIL (RGB) → cv2 (BGR)
    rgb_array = np.array(pil_image)
    bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
    return bgr_array


def hex_to_cv2(hex_string: str) -> np.ndarray:
    """Decode a hex-encoded image to a cv2 (BGR) numpy array."""
    raw_bytes = bytes.fromhex(hex_string)
    nparr = np.frombuffer(raw_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode hex image")
    return img


def bytes_to_cv2(raw_bytes: bytes) -> np.ndarray:
    """Decode raw image bytes (JPEG/PNG/etc.) to a cv2 (BGR) numpy array."""
    nparr = np.frombuffer(raw_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image bytes")
    return img


def validate_image_size(img: np.ndarray, min_dim: int = 32, max_dim: int = 4096) -> bool:
    """Validate image dimensions are within acceptable range."""
    h, w = img.shape[:2]
    return min(h, w) >= min_dim and max(h, w) <= max_dim


def resize_to_max_edge(img: np.ndarray, max_edge: int = 1024) -> np.ndarray:
    """Resize image so the largest edge is at most max_edge, preserving aspect ratio."""
    h, w = img.shape[:2]
    if max(h, w) <= max_edge:
        return img
    scale = max_edge / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
