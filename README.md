# 🌸 Flower Image Classifier

A **7-class flower classifier** powered by a CNN (MobileNetV2) and served through a professional **Flask** web interface. Users can upload an image from their device **or** take a live photo with their camera — and get instant predictions with confidence scores.

---

## Supported Flower Classes

| Daisy | Dandelion | Lily | Orchid | Rose | Sunflower | Tulip |
|:-----:|:---------:|:----:|:------:|:----:|:---------:|:-----:|
| 🌼 | 🌻 | 🌷 | 🌺 | 🌹 | 🌻 | 🌷 |

---

## Project Structure

```
computer-vision/
├── train.py              # CNN training script
├── app.py                # Flask web application
├── requirements.txt      # Python dependencies
├── model/
│   ├── flower_model.keras  # (generated after training)
│   └── class_names.txt     # (generated after training)
├── templates/
│   └── index.html        # Main UI page
└── static/
    ├── css/style.css
    └── js/app.js
```

---

## Setup & Usage

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Prepare your dataset

Arrange your training images in the following folder structure:

```
train/
├── daisy/
├── dandelion/
├── lily/
├── orchid/
├── rose/
├── sunflower/
└── tulip/
```

### 3. Train the model

```bash
python train.py --data_dir path/to/train --epochs 30
```

The trained model is saved to `model/flower_model.keras` and class names to `model/class_names.txt`.

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--data_dir` | `train` | Path to training dataset |
| `--epochs` | `30` | Maximum training epochs |
| `--model_out` | `model/flower_model.keras` | Output model path |

Training uses **MobileNetV2** (pre-trained on ImageNet) with:
- Data augmentation (flip, rotate, zoom, brightness)
- Fine-tuning of the top 30 layers
- Early stopping + learning-rate scheduler

### 4. Run the web app

```bash
python app.py
```

Open **http://localhost:5000** in your browser.

---

## Web Interface Features

| Feature | Description |
|---------|-------------|
| 📁 **Upload** | Drag-and-drop or browse to select a local image |
| 📷 **Camera** | Live webcam feed — capture a photo and classify it instantly |
| 📊 **Results** | Animated confidence bar + top-5 predictions list |
| 📱 **Responsive** | Works on desktop and mobile browsers |

---

## Tech Stack

- **Model**: TensorFlow / Keras — MobileNetV2 backbone
- **Backend**: Flask (Python)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (no framework required)
- **Camera**: WebRTC `getUserMedia` API (works in all modern browsers)

---

## Notes

- The app accepts JPG, PNG, BMP, and WEBP images up to 16 MB.
- Camera access requires HTTPS in production (localhost is exempt).
- To deploy publicly, use **gunicorn** behind **nginx** with an SSL certificate.
