/* ═══════════════════════════════════════════════════════════════════════════
   Flower Classifier – app.js
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ── Flower emoji map ─────────────────────────────────────────────────────────
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

// ── Dark / Light theme ────────────────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem("theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(saved);
})();

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.getElementById("themeIcon");
  if (icon) icon.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("theme", theme);
}

document.getElementById("themeToggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  const isUpload = tab === "upload";
  document.getElementById("tab-upload").classList.toggle("active", isUpload);
  document.getElementById("tab-camera").classList.toggle("active", !isUpload);
  document.getElementById("tab-upload").setAttribute("aria-selected", isUpload);
  document.getElementById("tab-camera").setAttribute("aria-selected", !isUpload);
  document.getElementById("panel-upload").classList.toggle("hidden", !isUpload);
  document.getElementById("panel-camera").classList.toggle("hidden", isUpload);
  if (isUpload) stopCamera();
  hideResult();
}

// ── Upload panel ──────────────────────────────────────────────────────────────
let uploadFile = null;

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById("dropZone").classList.add("drag-over");
}
function handleDragLeave() {
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
    showError("Please select a valid image file (JPG, PNG, BMP, WEBP).");
    return;
  }
  uploadFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById("uploadPreview").src = ev.target.result;
    document.getElementById("uploadPreviewWrap").hidden = false;
    document.getElementById("dropZone").style.display = "none";
    document.getElementById("classifyUploadBtn").disabled = false;
    hideResult();
  };
  reader.readAsDataURL(file);
}

function clearUpload() {
  uploadFile = null;
  document.getElementById("fileInput").value = "";
  document.getElementById("uploadPreviewWrap").hidden = true;
  document.getElementById("dropZone").style.display = "";
  document.getElementById("classifyUploadBtn").disabled = true;
  hideResult();
}

async function classifyUpload() {
  if (!uploadFile) return;
  const fd = new FormData();
  fd.append("image", uploadFile);
  await runPrediction("/predict", fd);
}

// ── Camera panel ──────────────────────────────────────────────────────────────
let stream       = null;
let capturedBlob = null;

async function startCamera() {
  const errorEl = document.getElementById("cameraError");
  errorEl.hidden = true;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (_) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (err2) {
      errorEl.textContent = "Camera access denied or not available: " + err2.message;
      errorEl.hidden = false;
      return;
    }
  }

  const video = document.getElementById("cameraFeed");
  video.srcObject = stream;
  video.classList.add("active");
  document.getElementById("cameraPlaceholder").style.display = "none";
  document.getElementById("viewfinder").hidden = false;
  document.getElementById("startCameraBtn").hidden = true;
  document.getElementById("captureBtn").disabled = false;
  hideResult();
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  const video = document.getElementById("cameraFeed");
  video.srcObject = null;
  video.classList.remove("active");
  document.getElementById("cameraPlaceholder").style.display = "";
  document.getElementById("viewfinder").hidden = true;
  document.getElementById("startCameraBtn").hidden = false;
  document.getElementById("captureBtn").disabled = true;
  document.getElementById("retakeBtn").hidden = true;
  document.getElementById("classifyCameraBtn").hidden = true;

  const img = document.getElementById("capturedImg");
  img.src = "";
  img.classList.remove("visible");
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
    img.classList.add("visible");
    video.classList.remove("active");
    document.getElementById("viewfinder").hidden = true;
    document.getElementById("captureBtn").disabled = true;
    document.getElementById("retakeBtn").hidden = false;
    document.getElementById("classifyCameraBtn").hidden = false;
    hideResult();
  }, "image/jpeg", 0.92);
}

function retakePhoto() {
  capturedBlob = null;
  const img = document.getElementById("capturedImg");
  img.src = "";
  img.classList.remove("visible");
  document.getElementById("cameraFeed").classList.add("active");
  document.getElementById("viewfinder").hidden = false;
  document.getElementById("captureBtn").disabled = false;
  document.getElementById("retakeBtn").hidden = true;
  document.getElementById("classifyCameraBtn").hidden = true;
  hideResult();
}

async function classifyCamera() {
  if (!capturedBlob) return;
  const fd = new FormData();
  fd.append("image", capturedBlob, "capture.jpg");
  await runPrediction("/predict_camera", fd);
}

// ── Prediction flow ───────────────────────────────────────────────────────────

/**
 * UI state machine:
 *   idle → loading → (success | error)
 *
 * showSpinner only controls the spinner; it does NOT touch resultCard/errorCard.
 * renderResult and showError each fully own their respective state visibility.
 */

async function runPrediction(endpoint, formData) {
  // Show result panel in loading state
  const panel = document.getElementById("resultPanel");
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });

  document.getElementById("loadingState").hidden = false;
  document.getElementById("resultCard").hidden   = true;
  document.getElementById("errorCard").hidden    = true;

  try {
    const resp = await fetch(endpoint, { method: "POST", body: formData });
    const data = await resp.json();
    document.getElementById("loadingState").hidden = true;

    if (data.error) {
      showError(data.error);
    } else {
      renderResult(data);
    }
  } catch (err) {
    document.getElementById("loadingState").hidden = true;
    showError("Network error — please check your connection and try again.");
    console.error(err);
  }
}

function renderResult(data) {
  // ── Winner banner ──
  document.getElementById("resultEmoji").textContent  = flowerEmoji(data.top_label);
  document.getElementById("resultLabel").textContent  = data.top_label;
  document.getElementById("confidencePct").textContent = data.top_confidence.toFixed(1) + "%";

  const progress = document.getElementById("confidenceProgress");
  progress.setAttribute("aria-valuenow", Math.round(data.top_confidence));
  progress.setAttribute("aria-label", `${data.top_label} — ${data.top_confidence.toFixed(1)}% confidence`);

  // Show card BEFORE animating so transitions fire
  document.getElementById("resultCard").hidden = false;
  document.getElementById("errorCard").hidden  = true;

  // Animate confidence bar after a microtask
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.getElementById("confidenceBar").style.width = data.top_confidence + "%";
  }));

  // ── Predictions list ──
  const ul = document.getElementById("top5List");
  ul.innerHTML = "";
  data.predictions.forEach((p, idx) => {
    const li = document.createElement("li");
    li.className = "pred-item";
    li.innerHTML = `
      <span class="pred-name">
        <span class="pred-rank" aria-hidden="true">${idx + 1}</span>
        ${escapeHtml(p.label)}
      </span>
      <span class="pred-pct">${p.confidence.toFixed(1)}%</span>
      <div class="pred-bar-wrap" role="progressbar"
           aria-valuenow="${Math.round(p.confidence)}"
           aria-valuemin="0" aria-valuemax="100"
           aria-label="${escapeHtml(p.label)} ${p.confidence.toFixed(1)}%">
        <div class="pred-bar" data-pct="${p.confidence}"></div>
      </div>`;
    ul.appendChild(li);
  });

  // Animate bars
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ul.querySelectorAll(".pred-bar").forEach(bar => {
      bar.style.width = bar.dataset.pct + "%";
    });
  }));
}

function showError(msg) {
  document.getElementById("resultPanel").hidden = false;
  document.getElementById("loadingState").hidden = true;
  document.getElementById("resultCard").hidden   = true;
  document.getElementById("errorCard").hidden    = false;
  document.getElementById("errorMsg").textContent = msg;
}

function hideResult() {
  document.getElementById("resultPanel").hidden  = true;
  document.getElementById("loadingState").hidden = true;
  document.getElementById("resultCard").hidden   = true;
  document.getElementById("errorCard").hidden    = true;
  document.getElementById("confidenceBar").style.width = "0%";
}

function resetAll() {
  clearUpload();
  hideResult();
}

// ── Utility ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}