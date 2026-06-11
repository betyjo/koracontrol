"""Isolated face matching (dlib/face_recognition can raise SystemExit in-process)."""
from __future__ import annotations

import base64
import json
import subprocess
import sys
from typing import Any


_WORKER_SCRIPT = r"""
import base64
import io
import json
import sys

import face_recognition
import numpy as np
from PIL import Image, UnidentifiedImageError


def detect_face(image_array):
    # Try to detect a face. Returns encoding list or empty list.
    return face_recognition.face_encodings(image_array)


def main() -> None:
    payload = json.load(sys.stdin)
    image_data = base64.b64decode(payload["image"])

    try:
        pil_image = Image.open(io.BytesIO(image_data)).convert("RGB")
    except (UnidentifiedImageError, Exception):
        print(json.dumps({"ok": False, "code": "bad_image"}))
        return

    # Convert directly to numpy array — no re-resize, no re-compress.
    # The Java client already resizes to 640px max and JPEG-compresses.
    uploaded_image = np.array(pil_image)

    # Attempt 1: detect face at original resolution
    uploaded_encodings = detect_face(uploaded_image)

    # Attempt 2: upscale 2x if no face found (helps HOG detector on small frames)
    if not uploaded_encodings:
        h, w = uploaded_image.shape[:2]
        pil_upscaled = pil_image.resize((w * 2, h * 2), Image.LANCZOS)
        uploaded_encodings = detect_face(np.array(pil_upscaled))

    # Attempt 3: try CNN model as last resort (more accurate but slower)
    if not uploaded_encodings:
        try:
            uploaded_encodings = face_recognition.face_encodings(
                uploaded_image, model="cnn"
            )
        except Exception:
            pass  # CNN model may not be available (needs CUDA-enabled dlib)

    if not uploaded_encodings:
        print(json.dumps({"ok": False, "code": "no_face"}))
        return

    uploaded_encoding = uploaded_encodings[0]

    for candidate in payload.get("candidates", []):
        encoding = candidate.get("encoding")
        if not encoding or len(encoding) != 128:
            continue
        stored = np.array(encoding, dtype=np.float64)
        if face_recognition.compare_faces(
            [stored], uploaded_encoding, tolerance=0.6
        )[0]:
            print(
                json.dumps(
                    {
                        "ok": True,
                        "user_id": candidate["user_id"],
                        "username": candidate["username"],
                        "role": candidate["role"],
                    }
                )
            )
            return

    print(json.dumps({"ok": False, "code": "not_recognized"}))


if __name__ == "__main__":
    main()
"""


def check_dependencies() -> str | None:
    """Return an error message if biometric dependencies are missing."""
    try:
        import face_recognition_models  # noqa: F401
    except Exception:
        return (
            "face_recognition_models is not installed. "
            "Run: pip install -r requirements.txt"
        )
    try:
        import face_recognition  # noqa: F401
    except Exception:
        return "face_recognition is not installed. Run: pip install -r requirements.txt"
    return None


def match_face(image_bytes: bytes, candidates: list[dict[str, Any]]) -> dict[str, Any]:
    """Run face match in a child process. Never raises SystemExit to the caller."""
    missing = check_dependencies()
    if missing:
        return {"ok": False, "code": "worker_failed", "detail": missing}
    payload = {
        "image": base64.b64encode(image_bytes).decode("ascii"),
        "candidates": candidates,
    }

    try:
        completed = subprocess.run(
            [sys.executable, "-c", _WORKER_SCRIPT],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "code": "timeout"}

    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()
        return {"ok": False, "code": "worker_failed", "detail": detail[:500]}

    stdout = (completed.stdout or "").strip()
    if not stdout:
        return {"ok": False, "code": "worker_failed", "detail": "Empty worker output"}

    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return {"ok": False, "code": "worker_failed", "detail": stdout[:500]}
