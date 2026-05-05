"""
train.py – Train a CNN flower classifier (7 classes).

Dataset folder layout expected:
    train/
        daisy/       *.jpg / *.png
        dandelion/   ...
        lily/        ...
        orchid/      ...
        rose/        ...
        sunflower/   ...
        tulip/       ...

Usage:
    python train.py --data_dir path/to/train --epochs 30
"""

import argparse
import os

import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

# ── Constants ────────────────────────────────────────────────────────────────
IMG_SIZE    = (224, 224)
BATCH_SIZE  = 32
AUTOTUNE    = tf.data.AUTOTUNE
CLASS_NAMES = ["daisy", "dandelion", "lily", "orchid", "rose", "sunflower", "tulip"]

# ── Argument parsing ─────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="Train flower CNN classifier")
    parser.add_argument("--data_dir", default="train",
                        help="Path to the training dataset root folder")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--model_out", default="model/flower_model.keras",
                        help="Where to save the trained model")
    return parser.parse_args()

# ── Dataset ──────────────────────────────────────────────────────────────────

def build_datasets(data_dir: str):
    """Return (train_ds, val_ds, class_names)."""
    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=0.2,
        subset="training",
        seed=42,
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        label_mode="categorical",
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=0.2,
        subset="validation",
        seed=42,
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        label_mode="categorical",
    )
    class_names = train_ds.class_names

    # Augmentation for training only
    augment = tf.keras.Sequential([
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.15),
        layers.RandomZoom(0.1),
        layers.RandomBrightness(0.1),
    ], name="augmentation")

    train_ds = (
        train_ds
        .map(lambda x, y: (augment(x, training=True), y), num_parallel_calls=AUTOTUNE)
        .prefetch(AUTOTUNE)
    )
    val_ds = val_ds.prefetch(AUTOTUNE)
    return train_ds, val_ds, class_names

# ── Model ────────────────────────────────────────────────────────────────────

def build_model(num_classes: int) -> tf.keras.Model:
    """Transfer-learning with MobileNetV2 backbone."""
    base = tf.keras.applications.MobileNetV2(
        input_shape=(*IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    # Fine-tune top 30 layers of the base
    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False

    inputs  = tf.keras.Input(shape=(*IMG_SIZE, 3))
    x       = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)
    x       = base(x, training=False)
    x       = layers.GlobalAveragePooling2D()(x)
    x       = layers.BatchNormalization()(x)
    x       = layers.Dense(256, activation="relu")(x)
    x       = layers.Dropout(0.4)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = models.Model(inputs, outputs, name="FlowerCNN")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-4),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    if not os.path.isdir(args.data_dir):
        raise FileNotFoundError(
            f"Dataset directory '{args.data_dir}' not found. "
            "Pass --data_dir path/to/train"
        )

    os.makedirs(os.path.dirname(args.model_out) or ".", exist_ok=True)

    print("Building datasets …")
    train_ds, val_ds, class_names = build_datasets(args.data_dir)
    print(f"Classes detected: {class_names}")

    model = build_model(num_classes=len(class_names))
    model.summary()

    callbacks = [
        EarlyStopping(monitor="val_accuracy", patience=7, restore_best_weights=True),
        ModelCheckpoint(args.model_out, save_best_only=True, monitor="val_accuracy"),
        ReduceLROnPlateau(monitor="val_loss", factor=0.3, patience=3, min_lr=1e-6),
    ]

    print(f"\nTraining for up to {args.epochs} epochs …")
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs,
        callbacks=callbacks,
    )

    print(f"\nModel saved to: {args.model_out}")
    # Save class names alongside the model
    names_path = os.path.join(os.path.dirname(args.model_out), "class_names.txt")
    with open(names_path, "w") as fh:
        fh.write("\n".join(class_names))
    print(f"Class names saved to: {names_path}")


if __name__ == "__main__":
    main()
