"""
app.py – Flask web application for flower image classification.

Run:
    python app.py

Then open http://localhost:5000 in your browser.

The app accepts:
  • An image uploaded from the user's device
  • A photo captured directly from the device camera (via the browser)
"""

import io
import os

import numpy as np
from flask import Flask, jsonify, render_template, request
from PIL import Image
import tensorflow as tf

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_PATH      = os.path.join("model", "flower_model.keras")
CLASS_NAMES_PATH = os.path.join("model", "class_names.txt")
IMG_SIZE        = (224, 224)
MAX_UPLOAD_MB   = 16

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

# ── Load model & class names ──────────────────────────────────────────────────

def load_resources():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Trained model not found at '{MODEL_PATH}'. "
            "Please run `python train.py` first."
        )
    model = tf.keras.models.load_model(MODEL_PATH)

    if os.path.exists(CLASS_NAMES_PATH):
        with open(CLASS_NAMES_PATH) as fh:
            class_names = [line.strip() for line in fh if line.strip()]
    else:
        # Fallback – default flower classes
        class_names = ["daisy", "dandelion", "lily", "orchid",
                       "rose", "sunflower", "tulip"]
    return model, class_names


try:
    model, CLASS_NAMES = load_resources()
    print(f"[OK] Model loaded. Classes: {CLASS_NAMES}")
except FileNotFoundError as exc:
    model = None
    CLASS_NAMES = ["daisy", "dandelion", "lily", "orchid",
                   "rose", "sunflower", "tulip"]
    print(f"[WARN] {exc}")

# ── Helpers ───────────────────────────────────────────────────────────────────

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "bmp", "webp", "gif"}

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Convert raw bytes → model input tensor (1, 224, 224, 3)."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(IMG_SIZE, Image.LANCZOS)
    arr = np.array(img, dtype=np.float32)
    arr = np.expand_dims(arr, axis=0)          # batch dim
    return arr


def predict(image_bytes: bytes) -> dict:
    """Return top-5 predictions as a list of {label, confidence} dicts."""
    if model is None:
        return {"error": "Model not loaded. Run `python train.py` first."}

    tensor  = preprocess_image(image_bytes)
    probs   = model.predict(tensor, verbose=0)[0]          # shape (num_classes,)
    top5_idx = np.argsort(probs)[::-1][:5]

    predictions = [
        {"label": CLASS_NAMES[i].replace("_", " ").title(),
         "confidence": round(float(probs[i]) * 100, 2)}
        for i in top5_idx
    ]
    return {
        "predictions": predictions,
        "top_label":   predictions[0]["label"],
        "top_confidence": predictions[0]["confidence"],
    }

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", classes=CLASS_NAMES)


@app.route("/predict", methods=["POST"])
def predict_route():
    """Accepts multipart form-data with key 'image'."""
    if "image" not in request.files:
        return jsonify({"error": "No image provided."}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"error": "Empty filename."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"Unsupported file type. Allowed: {ALLOWED_EXTENSIONS}"}), 400

    image_bytes = file.read()
    if not image_bytes:
        return jsonify({"error": "File is empty."}), 400

    result = predict(image_bytes)
    return jsonify(result)


@app.route("/predict_camera", methods=["POST"])
def predict_camera_route():
    """Accepts raw image bytes sent as application/octet-stream or
    multipart form-data with key 'image' (blob from canvas)."""
    if request.content_type and "multipart" in request.content_type:
        if "image" not in request.files:
            return jsonify({"error": "No image in form data."}), 400
        image_bytes = request.files["image"].read()
    else:
        image_bytes = request.get_data()

    if not image_bytes:
        return jsonify({"error": "No image data received."}), 400

    result = predict(image_bytes)
    return jsonify(result)


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None,
        "classes": CLASS_NAMES,
    })


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
