"""
ml_model.py
-----------
Loads the TFLite model once at startup and exposes a single predict() function.

Model facts (confirmed by tensor inspection):
  Input  : [1, 224, 224, 3]  float32   (RGB, normalised to 0–1)
  Output : [1, 1]            float32   (sigmoid — binary classifier)
  Labels : score < 0.5 → Benign  |  score >= 0.5 → Malignant

──────────────────────────────────────────────────────────────────────────────
WHY tflite-runtime WAS REMOVED
──────────────────────────────────────────────────────────────────────────────
Google discontinued tflite-runtime as a standalone PyPI package after
TensorFlow 2.14. It ships NO wheel for Python 3.11 or 3.12, so any cloud
host running a modern runtime (Render default = Python 3.12) gets a silent
install failure → _interpreter stays None → every prediction raises:
  "ML model is not loaded. Check TFLITE_MODEL_PATH and logs."

The official replacement is ai-edge-litert, which:
  • Has the identical Interpreter API  (drop-in, zero code changes needed)
  • Ships wheels for Python 3.9 – 3.12 on Linux x86_64, macOS, Windows
  • Is maintained by Google's Edge AI team (released 2024)
  pip install ai-edge-litert

──────────────────────────────────────────────────────────────────────────────
MODEL FILE ON RENDER
──────────────────────────────────────────────────────────────────────────────
Render clones your GitHub repo, so tiny_model.tflite MUST be committed.
If the file is in .gitignore (common for large binaries), this module will
automatically download it from your S3 bucket on first boot as a fallback.
Add the env var  TFLITE_S3_KEY=tiny_model.tflite  to your Render service
to enable this behaviour.
"""

from __future__ import annotations

import io
import logging
import os
from typing import TYPE_CHECKING, Tuple

import boto3
import numpy as np
from PIL import Image

# TYPE_CHECKING block suppresses the yellow "unresolved import" underline in
# VS Code / Pylance for packages that have no bundled type stubs.
# At runtime the actual import happens in the try/except block below.
if TYPE_CHECKING:
    from ai_edge_litert.interpreter import Interpreter as _InterpreterType  # noqa: F401

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

# Absolute path: always resolves relative to this file's directory,
# regardless of where uvicorn is launched from.
_HERE         = os.path.dirname(os.path.abspath(__file__))
MODEL_FILENAME = os.environ.get("TFLITE_MODEL_PATH", "tiny_model.tflite")
MODEL_PATH     = os.path.join(_HERE, MODEL_FILENAME)

# Optional: S3 key to download the model if it is missing from the filesystem.
# Set TFLITE_S3_KEY in your Render environment variables.
# Leave blank to disable S3 fallback.
TFLITE_S3_KEY: str = os.environ.get("TFLITE_S3_KEY", "")
S3_BUCKET:     str = os.environ.get("S3_BUCKET", "")
AWS_REGION:    str = os.environ.get("AWS_REGION", "ap-southeast-2")

INPUT_SIZE: int    = 224
THRESHOLD:  float  = 0.5
LABELS:     list   = ["Benign", "Malignant"]

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Ensure the model file exists (S3 fallback for cloud deployments)
# ─────────────────────────────────────────────────────────────────────────────

def _download_model_from_s3() -> bool:
    """
    Download the TFLite model from S3 to MODEL_PATH.
    Called only when the file is missing AND TFLITE_S3_KEY is configured.
    Returns True on success, False on failure.
    """
    if not TFLITE_S3_KEY or not S3_BUCKET:
        logger.warning(
            "Model file not found at '%s' and TFLITE_S3_KEY / S3_BUCKET are "
            "not set. Cannot download from S3. "
            "Commit tiny_model.tflite to your GitHub repo so Render can access it.",
            MODEL_PATH,
        )
        return False

    logger.info(
        "Model file not found locally. Downloading s3://%s/%s → %s",
        S3_BUCKET, TFLITE_S3_KEY, MODEL_PATH,
    )
    try:
        s3 = boto3.client("s3", region_name=AWS_REGION)
        s3.download_file(S3_BUCKET, TFLITE_S3_KEY, MODEL_PATH)
        size_mb = os.path.getsize(MODEL_PATH) / (1024 * 1024)
        logger.info("Model downloaded successfully (%.2f MB).", size_mb)
        return True
    except Exception as exc:
        logger.error("S3 model download failed: %s", exc)
        return False


if not os.path.isfile(MODEL_PATH):
    logger.warning("Model not found at '%s'. Attempting S3 download…", MODEL_PATH)
    _download_model_from_s3()

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Import the Interpreter (ai-edge-litert → tensorflow fallback)
# ─────────────────────────────────────────────────────────────────────────────
# Import priority:
#   1. ai-edge-litert   — Google's official replacement for tflite-runtime.
#                         Works on Python 3.9–3.12 / Linux / macOS / Windows.
#                         Install: pip install ai-edge-litert
#
#   2. tensorflow.lite  — Full TensorFlow. Works everywhere but ~500 MB install.
#                         Use only as a last resort (may exceed Render free-tier RAM).
#
# NOTE: tflite-runtime is intentionally NOT in this chain.
#       It has no Python 3.11/3.12 wheel and will always fail on modern hosts.

_Interpreter = None  # will hold the class, not an instance

try:
    from ai_edge_litert.interpreter import Interpreter as _Interpreter  # type: ignore[assignment]
    logger.info("Loaded Interpreter from ai_edge_litert (recommended).")
except ImportError as _e1:
    logger.warning("ai_edge_litert not available (%s). Trying full TensorFlow…", _e1)
    try:
        from tensorflow.lite.python.interpreter import Interpreter as _Interpreter  # type: ignore[assignment]
        logger.info("Loaded Interpreter from tensorflow.lite (fallback).")
    except ImportError as _e2:
        logger.error(
            "CRITICAL — No TFLite Interpreter available!\n"
            "  ai_edge_litert error : %s\n"
            "  tensorflow error     : %s\n"
            "  Fix: add 'ai-edge-litert' to requirements.txt",
            _e1, _e2,
        )

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Instantiate the singleton interpreter
# ─────────────────────────────────────────────────────────────────────────────

_interpreter     = None
_input_details   = None
_output_details  = None

logger.info("Resolved MODEL_PATH : %s", MODEL_PATH)
logger.info(
    "Files in backend directory : %s",
    os.listdir(_HERE) if os.path.isdir(_HERE) else "directory not found",
)

if _Interpreter is not None:
    if not os.path.isfile(MODEL_PATH):
        logger.error(
            "Model file still missing at '%s' after S3 attempt. "
            "Predictions will fail. "
            "Action required: commit tiny_model.tflite to your repo "
            "or set TFLITE_S3_KEY in Render environment variables.",
            MODEL_PATH,
        )
    else:
        try:
            _interpreter = _Interpreter(model_path=MODEL_PATH)
            _interpreter.allocate_tensors()
            _input_details  = _interpreter.get_input_details()
            _output_details = _interpreter.get_output_details()
            logger.info(
                "TFLite model ready — input %s  output %s",
                _input_details[0]["shape"],
                _output_details[0]["shape"],
            )
        except Exception as exc:
            logger.error("Failed to initialise TFLite interpreter: %s", exc)
            _interpreter = None
else:
    logger.error(
        "No Interpreter class loaded. Install ai-edge-litert: "
        "pip install ai-edge-litert"
    )

# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def predict_from_bytes(image_bytes: bytes) -> Tuple[str, float, float]:
    """
    Run the TFLite model on raw image bytes.

    Parameters
    ----------
    image_bytes : bytes
        Raw bytes of the uploaded image (any PIL-compatible format).

    Returns
    -------
    prediction : str   — "Benign" or "Malignant"
    confidence : float — 50.0–100.0 percentage  (e.g. 94.73)
    raw_score  : float — raw sigmoid value       (e.g. 0.052700)
    """
    if _interpreter is None:
        raise RuntimeError(
            "ML model is not loaded. "
            "Check that ai-edge-litert is installed and tiny_model.tflite "
            "is present in the backend directory (or set TFLITE_S3_KEY)."
        )

    # Pre-process: decode → resize 224×224 → normalise [0,1] → batch dim
    tensor = _preprocess(image_bytes)

    # Inference
    _interpreter.set_tensor(_input_details[0]["index"], tensor)
    _interpreter.invoke()

    # Read output
    raw_score: float = float(
        _interpreter.get_tensor(_output_details[0]["index"])[0][0]
    )

    # Threshold → label
    prediction: str = LABELS[int(raw_score >= THRESHOLD)]

    # Confidence: maps the sigmoid output to 50–100% range so 0.5 (uncertain)
    # gives 50% and 0.99 (very sure) gives 99%.
    confidence: float = (
        raw_score * 100.0 if raw_score >= THRESHOLD
        else (1.0 - raw_score) * 100.0
    )

    logger.info(
        "Prediction: %-10s | confidence: %6.2f%% | raw_score: %.6f",
        prediction, confidence, raw_score,
    )
    return prediction, round(confidence, 2), round(raw_score, 6)


# ─────────────────────────────────────────────────────────────────────────────
# PRIVATE HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _preprocess(image_bytes: bytes) -> np.ndarray:
    """
    Decode → RGB → resize 224×224 → normalise to [0,1] → add batch dim.
    Returns ndarray of shape (1, 224, 224, 3) dtype float32.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((INPUT_SIZE, INPUT_SIZE), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)  # (1, 224, 224, 3)