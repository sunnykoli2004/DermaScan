"""
ml_model.py
-----------
Loads the TFLite model once at startup and exposes a single predict() function.

Model facts (confirmed by inspection):
  - Input  : [1, 224, 224, 3]  float32  (normalised to 0-1)
  - Output : [1, 1]            float32  (sigmoid — binary classifier)
  - Labels : 0 → Benign  |  1 → Malignant  (threshold = 0.5)
"""

import os
import io
import logging
from typing import Tuple

import numpy as np
from PIL import Image


logger = logging.getLogger(__name__)

# —- Constants —-
import os

# 1. Dynamically locate the Backend directory
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_FILENAME = os.environ.get("TFLITE_MODEL_PATH", "tiny_model.tflite")

# 2. Build the explicit absolute system path
MODEL_PATH: str   = os.path.join(CURRENT_DIR, MODEL_FILENAME)
INPUT_SIZE: int   = 224          # Model expects 224 x 224 pixels
THRESHOLD: float  = 0.5          # sigmoid >= 0.5 -> Malignant
LABELS: list[str] = ["Benign", "Malignant"]

# ── Load interpreter once (module-level singleton) ────────────────────────────


try:
    # This will run smoothly on Render (Linux Cloud Environment)
    from tflite_runtime.interpreter import Interpreter
    logger.info("Using lightweight tflite_runtime Interpreter for Cloud Inference")
except ImportError:
    # This is your safe fallback for local Windows testing
    from tensorflow.lite.python.interpreter import Interpreter
    logger.info("tflite_runtime not found. Falling back to local TensorFlow Interpreter wrapper")

try:
    # Initialize your singleton interpreter object cleanly using the imported class
    _interpreter = Interpreter(model_path=MODEL_PATH)
    _interpreter.allocate_tensors()

    _input_details = _interpreter.get_input_details()
    _output_details = _interpreter.get_output_details()

    logger.info(
        "TFLite model loaded - input shape: %s, output shape: %s",
        _input_details[0]["shape"],
        _output_details[0]["shape"],
    )
except Exception as exc:
    _interpreter = None
    logger.error("TFLite model failed to load: %s", exc)


# ── Public API ────────────────────────────────────────────────────────────────

def predict_from_bytes(image_bytes: bytes) -> Tuple[str, float, float]:
    """
    Run the TFLite model on raw image bytes.

    Parameters
    ----------
    image_bytes : bytes
        Raw bytes of the uploaded image (any PIL-compatible format).

    Returns
    -------
    prediction  : str    — "Benign" or "Malignant"
    confidence  : float  — 0.0–100.0 percentage  (e.g. 94.7)
    raw_score   : float  — raw sigmoid value      (e.g. 0.053)
    """
    if _interpreter is None:
        raise RuntimeError("ML model is not loaded. Check TFLITE_MODEL_PATH and logs.")

    # 1. Decode and pre-process the image
    tensor = _preprocess(image_bytes)

    # 2. Feed into interpreter
    _interpreter.set_tensor(_input_details[0]["index"], tensor)
    _interpreter.invoke()

    # 3. Read sigmoid output
    raw_score: float = float(_interpreter.get_tensor(_output_details[0]["index"])[0][0])

    # 4. Threshold → label
    prediction: str  = LABELS[int(raw_score >= THRESHOLD)]

    # 5. Confidence: distance from decision boundary, mapped to 50-100%
    #    e.g. raw=0.05 → confidence 97.5%  (benign, very sure)
    #         raw=0.95 → confidence 97.5%  (malignant, very sure)
    #         raw=0.50 → confidence 50.0%  (uncertain)
    if raw_score >= THRESHOLD:
        confidence = raw_score * 100.0          # 50→100 for malignant
    else:
        confidence = (1.0 - raw_score) * 100.0  # 50→100 for benign

    logger.info(
        "Prediction: %s | confidence: %.2f%% | raw_score: %.6f",
        prediction, confidence, raw_score,
    )
    return prediction, round(confidence, 2), round(raw_score, 6)


# ── Private helpers ───────────────────────────────────────────────────────────

def _preprocess(image_bytes: bytes) -> np.ndarray:
    """
    Decode → resize to 224×224 → normalise to [0, 1] → add batch dim.
    Returns shape (1, 224, 224, 3) float32.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((INPUT_SIZE, INPUT_SIZE), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0        # normalise
    return np.expand_dims(arr, axis=0)                   # (1, 224, 224, 3)