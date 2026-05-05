/* ─── app.js – Flower Classifier UI ──────────────────────────────────────── */

"use strict";

// ── Flower emoji map ────────────────────────────────────────────────────────
const FLOWER_EMOJI = {
  daisy:     "🌼",
  dandelion: "🍀",
  lily:      "🌸",
  orchid:    "🌺",
  rose:      "🌹",
  sunflower: "🌻",
  tulip:     "🌷",
};

function flowerEmoji(label) {
  const key = label.toLowerCase().replace(/\s+/g, "_");
  return FLOWER_EMOJI[key] || "🌸";
}

// ── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById("tab-upload").classList.toggle("active",  tab === "upload");
  document.getElementById("tab-camera").classList.toggle("active",  tab === "camera");
  document.getElementById("panel-upload").classList.toggle("hidden", tab !== "upload");
  document.getElementById("panel-camera").classList.toggle("hidden", tab !== "camera");

  if (tab !== "camera") stopCamera();
  resetResult();
}

// ── Upload panel ─────────────────────────────────────────────────────────────
let uploadFile = null;

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById("dropZone").classList.add("drag-over");
}
function handleDragLeave(e) {
  document.getElementById("dropZone").classList.remove("drag-over");
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById("dropZone").classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) loadUploadFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) loadUploadFile(file);
}

function loadUploadFile(file) {
  if (!file.type.startsWith("image/")) {
    showError("Please select a valid image file.");
    return;
  }
  uploadFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const prev = document.getElementById("uploadPreview");
    prev.src = ev.target.result;
    document.getElementById("uploadPreviewWrap").hidden = false;
    document.getElementById("dropZone").style.display = "none";
    document.getElementById("classifyUploadBtn").disabled = false;
    resetResult();
  };
  reader.readAsDataURL(file);
}

function clearUpload() {
  uploadFile = null;
  document.getElementById("fileInput").value = "";
  document.getElementById("uploadPreviewWrap").hidden = true;
  document.getElementById("dropZone").style.display = "";
  document.getElementById("classifyUploadBtn").disabled = true;
  resetResult();
}

async function classifyUpload() {
  if (!uploadFile) return;
  const fd = new FormData();
  fd.append("image", uploadFile);
  await runPrediction("/predict", fd);
}

// ── Camera panel ─────────────────────────────────────────────────────────────
let stream     = null;
let capturedBlob = null;

async function startCamera() {
  const errorEl = document.getElementById("cameraError");
  errorEl.classList.add("hidden");

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (err) {
    // Try without facingMode constraint (desktop fallback)
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (err2) {
      errorEl.textContent = "Camera access denied or not available: " + err2.message;
      errorEl.classList.remove("hidden");
      return;
    }
  }

  const video = document.getElementById("cameraFeed");
  video.srcObject = stream;
  video.style.display = "block";

  document.getElementById("startCameraBtn").hidden = true;
  document.getElementById("captureBtn").disabled = false;

  resetResult();
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  const video = document.getElementById("cameraFeed");
  video.srcObject = null;

  // Reset camera UI to initial state
  document.getElementById("startCameraBtn").hidden = false;
  document.getElementById("captureBtn").disabled = true;
  document.getElementById("retakeBtn").hidden = true;
  document.getElementById("classifyCameraBtn").hidden = true;

  const img = document.getElementById("capturedImg");
  img.src = "";
  img.classList.add("hidden");
  capturedBlob = null;
}

function capturePhoto() {
  const video  = document.getElementById("cameraFeed");
  const canvas = document.getElementById("cameraCanvas");

  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    capturedBlob = blob;

    const img = document.getElementById("capturedImg");
    img.src = URL.createObjectURL(blob);
    img.classList.remove("hidden");

    // Pause the stream (keep it alive for retake)
    video.style.display = "none";

    document.getElementById("captureBtn").disabled  = true;
    document.getElementById("retakeBtn").hidden     = false;
    document.getElementById("classifyCameraBtn").hidden = false;
    resetResult();
  }, "image/jpeg", 0.92);
}

function retakePhoto() {
  capturedBlob = null;
  const img   = document.getElementById("capturedImg");
  img.src = "";
  img.classList.add("hidden");

  const video = document.getElementById("cameraFeed");
  video.style.display = "block";

  document.getElementById("captureBtn").disabled  = false;
  document.getElementById("retakeBtn").hidden     = true;
  document.getElementById("classifyCameraBtn").hidden = true;
  resetResult();
}

async function classifyCamera() {
  if (!capturedBlob) return;
  const fd = new FormData();
  fd.append("image", capturedBlob, "capture.jpg");
  await runPrediction("/predict_camera", fd);
}

// ── API & Result rendering ────────────────────────────────────────────────────
async function runPrediction(endpoint, formData) {
  showSpinner(true);
  document.getElementById("resultPanel").classList.remove("hidden");

  try {
    const resp = await fetch(endpoint, { method: "POST", body: formData });
    const data = await resp.json();

    if (data.error) {
      showError(data.error);
      return;
    }
    renderResult(data);
  } catch (err) {
    showError("Network error: " + err.message);
  } finally {
    showSpinner(false);
  }
}

function renderResult(data) {
  // Top prediction
  document.getElementById("resultLabel").textContent = data.top_label;
  document.getElementById("resultEmoji").textContent = flowerEmoji(data.top_label);
  document.getElementById("confidenceText").textContent =
      `Confidence: ${data.top_confidence.toFixed(1)}%`;

  document.getElementById("resultCard").hidden = false;
  document.getElementById("errorCard").hidden  = true;

  // Animate confidence bar (defer for CSS transition)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById("confidenceBar").style.width = data.top_confidence + "%";
    });
  });

  // Top-5 list
  const ul = document.getElementById("top5List");
  ul.innerHTML = "";
  data.predictions.forEach((p) => {
    const li = document.createElement("li");
    li.className = "top5-item";
    li.innerHTML = `
      <span class="top5-name">${p.label}</span>
      <div class="top5-bar-wrap">
        <div class="top5-bar" data-pct="${p.confidence}"></div>
      </div>
      <span class="top5-pct">${p.confidence.toFixed(1)}%</span>
    `;
    ul.appendChild(li);
  });

  // Animate top-5 bars
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ul.querySelectorAll(".top5-bar").forEach(bar => {
        bar.style.width = bar.dataset.pct + "%";
      });
    });
  });
}

function showError(msg) {
  document.getElementById("resultPanel").classList.remove("hidden");
  document.getElementById("resultCard").hidden = true;
  document.getElementById("errorCard").hidden  = false;
  document.getElementById("errorMsg").textContent = msg;
}

function showSpinner(show) {
  document.getElementById("spinner").hidden    = !show;
  document.getElementById("resultCard").hidden  = true;
  document.getElementById("errorCard").hidden   = true;
}

function resetResult() {
  document.getElementById("resultPanel").classList.add("hidden");
  document.getElementById("resultCard").hidden = true;
  document.getElementById("errorCard").hidden  = true;
  document.getElementById("spinner").hidden    = true;
  document.getElementById("confidenceBar").style.width = "0%";
}

function resetAll() {
  clearUpload();
  resetResult();
}
