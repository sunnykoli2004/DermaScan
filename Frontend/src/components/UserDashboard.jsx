import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

// ✅ import.meta.env — Vite replaces this statically at build time.
// process.env.VITE_* does NOT work in Vite apps (that's Node.js/CRA syntax).
const API_BASE = import.meta.env.VITE_API_BASE || "https://skincancerdetector-vwlq.onrender.com";

const BADGE_STYLES = {
  Benign:    { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", ring: "#10b981" },
  Malignant: { pill: "bg-rose-100    text-rose-700    border-rose-200",    dot: "bg-rose-500",    ring: "#f43f5e" },
  Uncertain: { pill: "bg-amber-100   text-amber-700   border-amber-200",   dot: "bg-amber-500",   ring: "#f59e0b" },
  _default:  { pill: "bg-slate-100   text-slate-600   border-slate-200",   dot: "bg-slate-400",   ring: "#94a3b8" },
};
const getBadge = (p) => BADGE_STYLES[p] ?? BADGE_STYLES._default;

const NAV_ITEMS = [
  {
    id: "home", label: "Home",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  },
  {
    id: "scan", label: "Scan",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" strokeWidth={2}/></svg>,
  },
  {
    id: "history", label: "History",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  },
  {
    id: "doctor", label: "Doctors",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  },
  {
    id: "profile", label: "Profile",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
  },
];

// ─── Date helpers — correctly handle RDS UTC timestamps on all browsers ───────
function formatDate(iso) {
  if (!iso) return "";
  let ts = String(iso).replace(" ", "T");
  if (!ts.endsWith("Z") && !ts.includes("+")) ts += "Z";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatTime(iso) {
  if (!iso) return "";
  let ts = String(iso).replace(" ", "T");
  if (!ts.endsWith("Z") && !ts.includes("+")) ts += "Z";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function getStoredEmail() { return localStorage.getItem("userEmail") ?? ""; }
function getStoredName()  { return localStorage.getItem("userName")  ?? ""; }

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE RING
// ─────────────────────────────────────────────────────────────────────────────
function ConfidenceRing({ value = 0, color = "#10b981", size = 130 }) {
  const R      = (size / 2) - 10;
  const C      = 2 * Math.PI * R;
  const target = C - (value / 100) * C;
  const [offset, setOffset] = useState(C);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOffset(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="#e2e8f0" strokeWidth="9"/>
        <circle
          cx={size/2} cy={size/2} r={R}
          fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-black text-slate-800 leading-none tabular-nums">
          {Number(value).toFixed(1)}%
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Confidence</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD MODAL
// ─────────────────────────────────────────────────────────────────────────────
function UploadModal({ mode, onClose, onSuccess }) {
  const [file,        setFile]        = useState(null);
  const [preview,     setPreview]     = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [result,      setResult]      = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const inputRef  = useRef();
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // ── Camera initialisation ────────────────────────────────────────────────
  //
  // Root causes of "camera freezes / fails to open" across iOS Safari &
  // Android Chrome, and how we fix each one:
  //
  // BUG 1 — await video.play() before loadedmetadata fires
  //   Calling play() before the browser has decoded the stream metadata causes
  //   a "play() request was interrupted" DOMException on iOS Safari and a
  //   silent freeze on some Android WebViews.
  //   FIX: attach a 'loadedmetadata' listener (+ 'canplay' fallback) and only
  //   call play() inside that handler.
  //
  // BUG 2 — Hard-coded constraint { facingMode: "environment" } rejection
  //   On laptops and some Android phones the browser throws NotFoundError or
  //   OverconstrainedError when "environment" is given as an exact constraint.
  //   FIX: cascade through 3 constraint sets — ideal rear → exact rear → any.
  //
  // BUG 3 — webkit-playsinline missing
  //   Older iOS Safari (< 15) requires the non-standard webkit-playsinline
  //   attribute to play video inline. React does not pass it via JSX props,
  //   so we set it imperatively on the DOM element.
  //   FIX: video.setAttribute("webkit-playsinline", "true") before play().
  //
  // BUG 4 — stale stream on retry
  //   If the user dismisses the modal and reopens it, the old MediaStream
  //   tracks are still active and getUserMedia may queue behind them.
  //   FIX: stop all tracks from the previous stream before requesting a new one.

  const startCamera = async () => {
    setUploadError(null);
    setIsStreaming(false);

    // FIX 4 — always clean up any leftover stream from a previous attempt
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // FIX 2 — constraint cascade
    //   [0] ideal rear camera at HD — best for phones
    //   [1] exact environment facing — older Android fallback
    //   [2] any camera — laptop webcam or last resort
    const constraintCascade = [
      { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { audio: false, video: { facingMode: "environment" } },
      { audio: false, video: true },
    ];

    let stream    = null;
    let lastError = null;

    for (const constraints of constraintCascade) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break; // got a stream — stop trying
      } catch (err) {
        lastError = err;
      }
    }

    if (!stream) {
      // Provide a meaningful message for the three most common failure modes
      let msg = "Camera unavailable. Please check your browser permissions.";
      if (lastError?.name === "NotAllowedError")  msg = "Camera permission denied. Tap the 🔒 icon in your browser address bar and allow camera access, then try again.";
      if (lastError?.name === "NotFoundError")    msg = "No camera was found on this device.";
      if (lastError?.name === "NotReadableError") msg = "Camera is in use by another app. Close it and try again.";
      setUploadError(msg);
      return;
    }

    // Component may have unmounted while we were awaiting getUserMedia
    if (!videoRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;

    // FIX 3 — set webkit-playsinline imperatively for old iOS Safari
    video.setAttribute("webkit-playsinline", "true");
    video.setAttribute("playsinline",        "true");
    video.muted   = true;
    video.srcObject = stream;

    // FIX 1 — wait for 'loadedmetadata' before calling play()
    //   'canplay' is a belt-and-suspenders fallback for Android WebViews that
    //   emit 'canplay' instead of (or before) 'loadedmetadata'.
    const onReady = () => {
      // Remove both listeners so onReady only fires once
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("canplay",        onReady);

      const playPromise = video.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsStreaming(true))
          .catch((e) => {
            // Autoplay was blocked by the browser (common on some desktops).
            // The stream IS attached — video will appear on the next user gesture.
            // We still mark streaming true so the shutter button becomes visible.
            console.warn("Camera autoplay blocked:", e.message);
            setIsStreaming(true);
          });
      } else {
        // Very old WebKit returns undefined (no promise) — treat as success
        setIsStreaming(true);
      }
    };

    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("canplay",        onReady);
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Auto-start camera when the modal opens in camera mode; stop on unmount
  useEffect(() => {
    if (mode === "camera" && !preview && !result) startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, preview, result]);

  // ── Photo capture with ML pre-processing ────────────────────────────────
  //
  // Three enhancements applied to every captured frame before sending to
  // the TFLite model:
  //
  //  1. CENTER CROP — extract a perfect square from the middle of the video
  //     frame at 85 % of the shortest dimension. This removes the letterbox
  //     bars while keeping the clinically relevant centre region.
  //
  //  2. AUTO-ENHANCE — canvas filter:
  //       brightness(1.15)  lift shadows, reveal lesion texture
  //       contrast(1.15)    sharpen lesion boundaries
  //       saturate(1.10)    boost colour differentiation for the model
  //
  //  3. HIGH-QUALITY JPEG — export at 0.98 quality (98%) to preserve
  //     fine detail that JPEG compression would otherwise destroy.

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");

    // 1. CENTER CROP — square at 85 % of the shorter dimension
    const shortSide = Math.min(video.videoWidth, video.videoHeight);
    const cropSize  = Math.floor(shortSide * 0.85);
    const startX    = Math.floor((video.videoWidth  - cropSize) / 2);
    const startY    = Math.floor((video.videoHeight - cropSize) / 2);

    canvas.width  = cropSize;
    canvas.height = cropSize;

    // 2. AUTO-ENHANCE — apply filter before drawing
    ctx.filter = "brightness(1.15) contrast(1.15) saturate(1.10)";
    ctx.drawImage(video, startX, startY, cropSize, cropSize, 0, 0, cropSize, cropSize);
    ctx.filter = "none"; // reset so any subsequent draws are unaffected

    // 3. HIGH-QUALITY JPEG EXPORT at 98 %
    canvas.toBlob(
      (blob) => {
        if (!blob) { setUploadError("Failed to capture image. Please try again."); return; }
        const f = new File([blob], "dermascan-capture.jpg", { type: "image/jpeg" });
        setFile(f);
        setPreview(URL.createObjectURL(f));
        stopCamera();
      },
      "image/jpeg",
      0.98,
    );
  };

  // ── Gallery file picker ──────────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setUploadError("Only image files are accepted (JPG, PNG, WEBP).");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setUploadError(null);
    setResult(null);
  };

  const retakePhoto = () => { setFile(null); setPreview(null); setUploadError(null); };

  // ── Upload → backend → ML prediction ────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return;

    const email = getStoredEmail();
    if (!email) { setUploadError("Session expired — please sign in again."); return; }

    setUploading(true);
    setProgress(0);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file",  file);
    formData.append("email", email);

    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        onUploadProgress: (e) => { if (e.total) setProgress(Math.round((e.loaded * 100) / e.total)); },
      });
      const scan = res.data.scan;
      setResult(scan);
      onSuccess(scan);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string")  setUploadError(detail);
      else if (Array.isArray(detail))  setUploadError(detail.map((d) => d.msg).join(" · "));
      else                             setUploadError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      setProgress(100);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!uploading ? onClose : undefined}/>

      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-200"/>
        </div>

        <div className="px-6 pb-7 pt-4 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              {result
                ? "Analysis Complete"
                : mode === "camera" && !preview
                ? "Capture Image"
                : "Review & Upload"}
            </h3>
            {!uploading && (
              <button onClick={onClose} className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* ════ CAMERA VIEWFINDER ════ */}
          {!result && mode === "camera" && !preview && (
            <div className="flex flex-col items-center">
              {/* Video box */}
              <div className="w-full aspect-[4/5] bg-black rounded-2xl overflow-hidden relative shadow-inner">

                {/*
                  IMPORTANT VIDEO ATTRIBUTES for cross-browser reliability:
                  • autoPlay      — starts playing as soon as a stream is attached
                  • playsInline   — prevents iOS Safari from going fullscreen
                  • muted         — required for autoplay to work in most browsers
                  All three must be present. We also set webkit-playsinline and
                  playsinline imperatively in startCamera() for older iOS builds.
                */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Loading spinner shown while stream is initialising */}
                {!isStreaming && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 bg-black">
                    <svg className="animate-spin w-9 h-9 mb-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span className="text-sm font-semibold">Opening camera…</span>
                  </div>
                )}

                {/* Targeting crosshair overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 relative">
                    <div className="w-7 h-7 border-t-4 border-l-4 border-emerald-400 absolute top-0 left-0 rounded-tl-xl"/>
                    <div className="w-7 h-7 border-t-4 border-r-4 border-emerald-400 absolute top-0 right-0 rounded-tr-xl"/>
                    <div className="w-7 h-7 border-b-4 border-l-4 border-emerald-400 absolute bottom-0 left-0 rounded-bl-xl"/>
                    <div className="w-7 h-7 border-b-4 border-r-4 border-emerald-400 absolute bottom-0 right-0 rounded-br-xl"/>
                    {/* Centre dot */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/70"/>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hidden canvas — used only for capture+processing, never displayed */}
              <canvas ref={canvasRef} className="hidden"/>

              {/* Capture guide */}
              <div className="w-full bg-sky-50 border border-sky-100 rounded-xl p-3 mt-4 mb-5">
                <h4 className="text-xs font-black text-sky-800 uppercase tracking-widest mb-2">Capture Guide</h4>
                <ul className="text-xs text-sky-700 space-y-1.5 font-medium">
                  <li className="flex gap-2"><span>1.</span>Centre the lesion inside the green brackets.</li>
                  <li className="flex gap-2"><span>2.</span>Ensure bright, natural lighting — avoid shadows.</li>
                  <li className="flex gap-2"><span>3.</span>Hold the camera 4–6 inches away and stay still.</li>
                </ul>
              </div>

              {/* Shutter button — only visible once the stream is live */}
              {isStreaming && (
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full bg-white border-4 border-slate-200 shadow-xl flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all ring-4 ring-sky-500/20"
                  aria-label="Capture photo"
                >
                  <div className="w-11 h-11 rounded-full bg-sky-500"/>
                </button>
              )}

              {/* Camera error shown inside the camera panel */}
              {uploadError && !isStreaming && (
                <div className="w-full mt-4 flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
                  <svg className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <div>
                    <p className="font-semibold leading-tight">{uploadError}</p>
                    <button
                      onClick={() => { setUploadError(null); startCamera(); }}
                      className="mt-2 text-xs font-bold text-rose-600 underline underline-offset-2"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ UPLOAD FILE PICKER / PREVIEW ════ */}
          {!result && (mode === "upload" || preview) && (
            <>
              <div
                role="button" tabIndex={0}
                onClick={() => !preview ? inputRef.current?.click() : null}
                onKeyDown={(e) => e.key === "Enter" && !preview && inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                className={`relative border-2 border-dashed rounded-2xl text-center overflow-hidden transition-colors mb-4 ${
                  preview
                    ? "border-transparent bg-slate-50 aspect-square"
                    : "border-sky-300 p-8 cursor-pointer hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                }`}
              >
                {preview ? (
                  <>
                    <img src={preview} alt="Preview" className="w-full h-full object-cover"/>
                    {!uploading && (
                      <button
                        onClick={retakePhoto}
                        className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 shadow-sm border border-slate-200 hover:bg-white flex items-center gap-1.5 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Remove
                      </button>
                    )}
                  </>
                ) : (
                  <div className="py-4">
                    <div className="w-16 h-16 rounded-2xl bg-sky-100 flex items-center justify-center mx-auto mb-4 text-sky-600">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                    </div>
                    <p className="text-base font-bold text-slate-800 mb-1">Upload from Gallery</p>
                    <p className="text-xs text-slate-500 font-medium max-w-[200px] mx-auto">Drag & drop or click to browse files.</p>
                  </div>
                )}
              </div>

              {/* Reset value so re-selecting the same file triggers onChange */}
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/bmp"
                className="hidden"
                onChange={(e) => { handleFile(e.target.files?.[0] ?? null); e.target.value = null; }}
              />

              {/* Progress bar */}
              {uploading && (
                <div className="mb-5 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <div className="flex justify-between text-xs text-slate-600 mb-2 font-bold">
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      AI is analysing…
                    </span>
                    <span className="text-sky-600">{progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error banner — note: fixed broken SVG path from previous version */}
              {uploadError && (
                <div className="mb-5 flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700 shadow-sm">
                  <svg className="w-5 h-5 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <span className="font-semibold leading-tight">{uploadError}</span>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`w-full py-3.5 rounded-xl font-black text-base transition-all duration-200 ${
                  file && !uploading
                    ? "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] shadow-lg shadow-slate-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {uploading ? "Processing…" : "Run AI Analysis"}
              </button>
            </>
          )}

          {/* ════ SUCCESS RESULT ════ */}
          {result && (
            <div className="flex flex-col items-center gap-5">
              <div
                className="w-full rounded-2xl overflow-hidden shadow-inner bg-slate-50 flex items-center justify-center"
                style={{ maxHeight: 200 }}
              >
                <img
                  src={result.image_url}
                  alt="Analysed scan"
                  className="w-full object-contain"
                  style={{ maxHeight: 200 }}
                  onError={(e) => { if (preview && e.currentTarget.src !== preview) e.currentTarget.src = preview; }}
                />
              </div>

              <div className={`inline-flex items-center gap-2 px-5 py-1.5 rounded-full border text-sm font-black tracking-wide ${getBadge(result.prediction).pill}`}>
                <span className={`w-2 h-2 rounded-full ${getBadge(result.prediction).dot}`}/>
                {result.prediction}
              </div>

              <ConfidenceRing value={result.confidence} color={getBadge(result.prediction).ring} size={130}/>

              <p className="text-xs text-slate-400">
                Raw score:{" "}
                <span className="font-mono font-semibold text-slate-600">
                  {Number(result.raw_score ?? 0).toFixed(6)}
                </span>
              </p>

              <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
                <span className="font-bold">⚠️ Educational use only.</span>{" "}
                This AI result is not a clinical diagnosis. Always consult a qualified dermatologist.
              </div>

              <button
                onClick={onClose}
                className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black text-base hover:bg-slate-800 active:scale-[0.98] transition-all shadow-lg"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART THUMBNAIL
// ─────────────────────────────────────────────────────────────────────────────
function SmartThumbnail({ url, prediction, confidence, createdAt, scanId }) {
  const [hasError, setHasError] = useState(false);

  if (!url || hasError) {
    const isBenign  = prediction?.toLowerCase() === "benign";
    const bgClass   = isBenign
      ? "bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600"
      : "bg-gradient-to-br from-rose-400 via-red-500 to-rose-600";
    const dateStr   = formatDate(createdAt) || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const timeStr   = formatTime(createdAt) || new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const confNum   = isNaN(parseFloat(String(confidence || "0").replace("%", "")))
      ? "0.0"
      : parseFloat(String(confidence).replace("%", "")).toFixed(1);

    return (
      <div className={`w-full h-full rounded-xl flex flex-col items-center justify-center ${bgClass} relative overflow-hidden shadow-inner p-3`}>
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
          <div className="flex flex-col text-left">
            <span className="text-[9px] font-bold text-white/90 uppercase drop-shadow-sm">{dateStr}</span>
            <span className="text-[8px] font-medium text-white/70">{timeStr}</span>
          </div>
          <div className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg border border-white/30">
            <span className="text-sm font-black text-white">{confNum}%</span>
          </div>
        </div>
        <div className="relative flex items-center justify-center mb-1 mt-6">
          <div className="absolute inset-0 bg-white/40 rounded-full animate-ping"/>
          <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-md border border-white/40 shadow-lg relative z-10">
            {isBenign
              ? <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              : <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            }
          </div>
        </div>
        <span className="text-[13px] font-black text-white uppercase tracking-widest drop-shadow-md relative z-10 mt-1">{prediction || "Unknown"}</span>
        <span className="text-[7px] font-bold text-white/80 uppercase tracking-widest mt-1 relative z-10 bg-black/20 px-2 py-0.5 rounded-full border border-black/10">
          ID: {scanId ? `SCN-${scanId}` : "ENCRYPTED"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Skin Scan"
      className="w-full h-full object-cover rounded-xl shadow-inner group-hover:scale-105 transition-transform duration-500"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY GRID
// ─────────────────────────────────────────────────────────────────────────────
function HistoryGrid({ history, loading, error, onRetry }) {
  const [flippedCardId, setFlippedCardId] = useState(null);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm animate-pulse">
            <div className="aspect-square bg-slate-200"/>
            <div className="p-2.5 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-3/4"/>
              <div className="h-3 bg-slate-100 rounded w-1/2"/>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-rose-700 mb-1">Could not load scan history</p>
        <p className="text-xs text-rose-500 mb-4">{error}</p>
        {onRetry && (
          <button onClick={onRetry} className="text-xs font-bold text-rose-600 border border-rose-300 px-4 py-2 rounded-lg hover:bg-rose-100 transition-colors">
            ↻ Try Again
          </button>
        )}
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-sky-50 flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            <circle cx="12" cy="13" r="3" strokeWidth={2}/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-0.5">No scans yet</p>
        <p className="text-xs text-slate-400">Upload your first image to get an AI analysis.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {history.map((scan) => (
        <div
          key={scan.id}
          className="group relative h-[340px] w-full [perspective:1000px] cursor-pointer"
          onClick={() => setFlippedCardId(flippedCardId === scan.id ? null : scan.id)}
        >
          <div className={`relative w-full h-full transition-transform duration-700 ease-in-out [transform-style:preserve-3d] shadow-lg rounded-3xl ${
            flippedCardId === scan.id ? "[transform:rotateY(180deg)]" : ""
          }`}>

            {/* Front face */}
            <div className={`absolute inset-0 w-full h-full [backface-visibility:hidden] rounded-3xl p-6 text-white overflow-hidden flex flex-col justify-between ${
              scan.prediction?.toLowerCase() === "benign"
                ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                : "bg-gradient-to-br from-rose-500 to-red-600"
            }`}>
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -right-[10%] w-[80%] h-[80%] rounded-full bg-white/30 blur-2xl group-hover:scale-[2] transition-transform duration-1000 ease-out"/>
              </div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[11px] opacity-90 font-bold uppercase tracking-wider">{formatDate(scan.created_at)}</p>
                    <p className="text-[10px] opacity-80 mt-0.5 font-medium">{formatTime(scan.created_at)}</p>
                  </div>
                  <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black tracking-wider border border-white/40">
                    {scan.confidence ? parseFloat(String(scan.confidence).replace(/[^0-9.]/g, "")).toFixed(1) : "0.0"}%
                  </span>
                </div>
                <div className="text-center my-auto">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md relative border-2 border-white/50 shadow-lg">
                    <div className="absolute inset-0 rounded-full border-4 border-white animate-ping opacity-60"/>
                    {scan.prediction?.toLowerCase() === "benign"
                      ? <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                      : <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    }
                  </div>
                  <h3 className="text-2xl font-black tracking-widest uppercase drop-shadow-lg">{scan.prediction}</h3>
                  <p className="text-[10px] opacity-90 font-bold mt-2 uppercase tracking-widest bg-black/20 inline-block px-3 py-1 rounded-md border border-white/10">
                    TAP TO VIEW REPORT
                  </p>
                </div>
              </div>
              {scan.image_url && (
                <img
                  src={scan.image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-10 pointer-events-none group-hover:opacity-30 transition-opacity duration-700"
                />
              )}
            </div>

            {/* Back face */}
            <div className={`absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-3xl p-6 text-white overflow-hidden flex flex-col justify-between ${
              scan.prediction?.toLowerCase() === "benign" ? "bg-emerald-600" : "bg-red-600"
            }`}>
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <h4 className="font-bold tracking-widest uppercase text-sm">Analysis Report</h4>
                </div>
                <div
                  className="bg-black/20 rounded-2xl p-4 flex-1 text-sm leading-relaxed overflow-y-auto cursor-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {scan.prediction?.toLowerCase() === "benign" ? (
                    <div className="pb-2">
                      <p className="font-bold text-emerald-200 mb-2">Recommendation:</p>
                      <ul className="list-disc pl-4 space-y-2 opacity-90 text-xs">
                        <li>Continue applying SPF 50+ daily.</li>
                        <li>Avoid excessive sun exposure.</li>
                        <li>Monitor for any changes in size, shape, or color.</li>
                      </ul>
                    </div>
                  ) : (
                    <div className="pb-2">
                      <p className="font-bold text-red-200 mb-2">High Priority:</p>
                      <p className="text-xs opacity-90 mb-3">The AI detected potential malignant patterns.</p>
                      <p className="text-xs font-bold bg-red-900/50 p-4 rounded-xl border border-red-400/30">
                        Please schedule an appointment with a certified dermatologist immediately.<br/><br/>
                        👉 Navigate to the Doctors tab to find specialists near you.
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] opacity-60 text-center mt-3 uppercase tracking-wider font-bold">Tap again to flip back</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export default function UserDashboard({ user, onLogout }) {
  const [activeTab,      setActiveTab]      = useState("home");
  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError,   setHistoryError]   = useState(null);
  const [uploadModal,    setUploadModal]    = useState(null);

  const email       = user?.email ?? getStoredEmail();
  const displayName = user?.name  ?? getStoredName() ?? email.split("@")[0] ?? "User";

  useEffect(() => {
    if (user?.email) localStorage.setItem("userEmail", user.email);
    if (user?.name)  localStorage.setItem("userName",  user.name);
  }, [user?.email, user?.name]);

  const fetchHistory = useCallback(async () => {
    const storedEmail = getStoredEmail();
    if (!storedEmail) { setHistoryLoading(false); return; }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await axios.get(`${API_BASE}/history/${encodeURIComponent(storedEmail)}`);
      setHistory(res.data.scans ?? []);
    } catch (err) {
      setHistoryError(err.response?.data?.detail ?? "Could not load scan history. Check your connection.");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleLogout = () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("isAuthenticated");
    if (typeof onLogout === "function") onLogout();
  };

  const handleScanSuccess = (newScan) => setHistory((prev) => [newScan, ...prev]);

  const renderContent = () => {
    switch (activeTab) {
      case "home":    return <HomeTab displayName={displayName} onScan={() => setUploadModal("upload")} onCamera={() => setUploadModal("camera")} history={history} historyLoading={historyLoading} historyError={historyError} onRetry={fetchHistory}/>;
      case "scan":    return <ScanTab onCamera={() => setUploadModal("camera")} onUpload={() => setUploadModal("upload")}/>;
      case "history": return <HistoryTab history={history} loading={historyLoading} error={historyError} onRetry={fetchHistory}/>;
      case "doctor":  return <DoctorTab/>;
      case "profile": return <ProfileTab displayName={displayName} email={email} scanCount={history.length} onLogout={handleLogout}/>;
      default:        return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-60 lg:w-64 bg-white border-r border-slate-200 shadow-sm shrink-0">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <div className="font-black text-slate-800 text-sm">DermaScan</div>
              <div className="text-xs text-slate-400 font-light -mt-0.5">AI Portal</div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 bg-sky-50 rounded-xl px-3 py-2.5">
            <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-white text-xs font-black shrink-0">
              {(displayName[0] ?? "U").toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">{displayName}</div>
              <div className="text-xs text-slate-400 truncate">{email}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === item.id
                  ? "bg-sky-600 text-white shadow-md shadow-sky-200"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              {item.icon}{item.label}
            </button>
          ))}
        </nav>

        <div className="px-4 pb-4">
          <div className="bg-gradient-to-br from-sky-600 to-sky-700 rounded-xl p-4 text-white">
            <div className="text-xs font-bold mb-1">Need Help?</div>
            <p className="text-xs text-sky-200 mb-3">Contact our support team for any assistance.</p>
            <button className="w-full bg-white text-sky-700 text-xs font-bold py-2 rounded-lg hover:bg-sky-50 transition-colors">
              Get Support
            </button>
          </div>
        </div>

        <div className="px-4 pb-5 border-t border-slate-100 pt-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3.5 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
              </svg>
            </div>
            <span className="font-black text-slate-800 text-sm">DermaScan</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 text-xs font-black">
            {(displayName[0] ?? "U").toUpperCase()}
          </div>
        </header>

        {/* Desktop page title bar */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 shrink-0">
          <div className="text-xl font-bold text-slate-800 capitalize">{activeTab}</div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{renderContent()}</main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-lg z-30 safe-bottom">
          <div className="flex">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                  activeTab === item.id ? "text-sky-600" : "text-slate-400"
                }`}
              >
                <div className={`p-1 rounded-lg transition-all ${activeTab === item.id ? "bg-sky-100" : ""}`}>
                  {item.icon}
                </div>
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {uploadModal && (
        <UploadModal
          mode={uploadModal}
          onClose={() => setUploadModal(null)}
          onSuccess={handleScanSuccess}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB VIEWS
// ─────────────────────────────────────────────────────────────────────────────

function HomeTab({ displayName, onScan, onCamera, history, historyLoading, historyError, onRetry }) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800">Hello, {displayName.split(" ")[0]} 👋</h1>
        <p className="text-slate-500 text-sm mt-0.5">Ready to monitor your skin health today?</p>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={onCamera} className="flex flex-col items-start gap-3 bg-sky-600 text-white p-4 sm:p-5 rounded-2xl shadow-lg shadow-sky-200 hover:bg-sky-700 active:scale-[0.98] transition-all text-left">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" strokeWidth={2}/></svg>
          </div>
          <div>
            <div className="font-black text-sm">Open Camera</div>
            <div className="text-xs text-sky-200 mt-0.5">Capture live photo</div>
          </div>
        </button>
        <button onClick={onScan} className="flex flex-col items-start gap-3 bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-sky-300 active:scale-[0.98] transition-all text-left">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <div>
            <div className="font-black text-sm text-slate-800">Upload File</div>
            <div className="text-xs text-slate-400 mt-0.5">From your gallery</div>
          </div>
        </button>
      </div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-700 text-sm">Recent Scans</h2>
          <span className="text-xs text-sky-600 font-semibold">{history.length} total</span>
        </div>
        <HistoryGrid history={history.slice(0, 3)} loading={historyLoading} error={historyError} onRetry={onRetry}/>
      </div>
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex gap-3 items-start">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <div>
          <div className="text-xs font-bold text-emerald-800 mb-0.5">Daily Tip</div>
          <p className="text-xs text-emerald-700">Use the ABCDE method: Asymmetry, Border changes, Color variation, Diameter &gt; 6 mm, and Evolution.</p>
        </div>
      </div>
    </div>
  );
}

function ScanTab({ onCamera, onUpload }) {
  return (
    <div className="px-4 sm:px-6 py-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-black text-slate-800 mb-1">New Scan</h2>
      <p className="text-slate-500 text-sm mb-8">Choose how you want to capture or upload your skin image.</p>
      <div className="space-y-4">
        <button onClick={onCamera} className="w-full flex items-center gap-4 p-5 bg-sky-600 text-white rounded-2xl shadow-lg shadow-sky-200 hover:bg-sky-700 transition-all active:scale-[0.99]">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" strokeWidth={2}/></svg>
          </div>
          <div className="text-left flex-1">
            <div className="font-black">Open Camera</div>
            <div className="text-sm text-sky-200">Live capture with your device camera</div>
          </div>
          <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </button>
        <button onClick={onUpload} className="w-full flex items-center gap-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-sky-300 transition-all active:scale-[0.99]">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <div className="text-left flex-1">
            <div className="font-black text-slate-800">Upload from Gallery</div>
            <div className="text-sm text-slate-400">JPG, PNG, WEBP — up to 10 MB</div>
          </div>
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs text-amber-800 leading-relaxed">
          <span className="font-bold">📸 Photo Tips:</span> Good lighting, steady hand, centre the area of concern. Avoid shadows for best accuracy.
        </p>
      </div>
    </div>
  );
}

function HistoryTab({ history, loading, error, onRetry }) {
  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Scan History</h2>
          <p className="text-slate-500 text-sm">
            {loading ? "Loading…" : `${history.length} total scan${history.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {!loading && (
          <button onClick={onRetry} className="text-xs text-sky-600 font-semibold border border-sky-200 px-3 py-1.5 rounded-lg hover:bg-sky-50 transition-colors">
            ↻ Refresh
          </button>
        )}
      </div>
      <HistoryGrid history={history} loading={loading} error={error} onRetry={onRetry}/>
    </div>
  );
}

function DoctorTab() {
  const [searchInput, setSearchInput] = useState("");
  const [mapQuery,    setMapQuery]    = useState("dermatologist in Pune");

  const handleSearch = () => {
    if (searchInput.trim()) setMapQuery(`dermatologist in ${searchInput}`);
  };

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Find a Dermatologist</h2>
      <p className="text-slate-500 text-sm mb-8 font-medium">Locate certified skin specialists in your city.</p>
      <div className="flex gap-3 mb-6">
        <div className="flex-1 flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm focus-within:border-sky-500 focus-within:ring-4 ring-sky-500/20 transition-all">
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            className="flex-1 text-base font-semibold text-slate-800 placeholder-slate-400 outline-none bg-transparent"
            placeholder="Enter your city (e.g. Mumbai, Jalgaon)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-slate-800 transition-colors shadow-lg active:scale-95 shrink-0"
        >
          Search
        </button>
      </div>
      <div className="bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 shadow-inner mb-8" style={{ height: 400 }}>
        <iframe
          title="Dermatologist Search Map"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
        />
      </div>
      <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex gap-3 items-center">
        <span className="text-xl">📍</span>
        <p className="text-xs text-sky-800 font-medium">
          Click the red pins in the map to see clinic names, ratings, and phone numbers from Google.
        </p>
      </div>
    </div>
  );
}

function Animated3DMedicalIcon() {
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center opacity-40 pointer-events-none" style={{ perspective: "800px" }}>
      <style>{`
        @keyframes spinY { 0%{transform:rotateY(0deg) rotateX(15deg)} 100%{transform:rotateY(360deg) rotateX(15deg)} }
        .hologram-cross{position:relative;width:90px;height:90px;transform-style:preserve-3d;animation:spinY 8s linear infinite}
        .hologram-part{position:absolute;background:rgba(255,255,255,0.2);border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 15px rgba(255,255,255,0.6),inset 0 0 15px rgba(255,255,255,0.6);border-radius:6px}
        .v-front{width:26px;height:90px;left:32px;top:0;transform:translateZ(13px)}
        .v-back{width:26px;height:90px;left:32px;top:0;transform:translateZ(-13px)}
        .h-front{width:90px;height:26px;left:0;top:32px;transform:translateZ(13px)}
        .h-back{width:90px;height:26px;left:0;top:32px;transform:translateZ(-13px)}
      `}</style>
      <div className="hologram-cross">
        <div className="hologram-part v-front"/><div className="hologram-part v-back"/>
        <div className="hologram-part h-front"/><div className="hologram-part h-back"/>
      </div>
    </div>
  );
}

function ProfileTab({ displayName, email, scanCount, onLogout }) {
  const [feedbackState, setFeedbackState] = useState("idle");

  const submitFeedback = (type) => {
    console.log(`Feedback submitted: ${type}`);
    setFeedbackState("success");
    setTimeout(() => setFeedbackState("idle"), 3000);
  };

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto space-y-6">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Profile</h2>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden text-center relative">
        <div className="h-36 relative bg-gradient-to-r from-sky-400 to-indigo-500 overflow-hidden">
          <Animated3DMedicalIcon/>
        </div>
        <div className="relative px-6 pb-8">
          <div className="w-24 h-24 mx-auto rounded-full bg-white border-4 border-white shadow-md flex items-center justify-center text-indigo-600 text-4xl font-black -mt-12 mb-4 relative z-10">
            {(displayName[0] ?? "U").toUpperCase()}
          </div>
          <h3 className="text-2xl font-black text-slate-800">{displayName}</h3>
          <p className="text-slate-500 font-medium">{email || "No email provided"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" strokeWidth={2}/></svg>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{scanCount}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Scans</div>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
          </div>
          <div>
            <div className="text-xl font-black text-slate-800">v2.4.1</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">App Version</div>
          </div>
        </div>
      </div>

      <div className="pt-2 pb-10 space-y-3">
        {feedbackState === "idle" && (
          <button
            onClick={() => setFeedbackState("modal")}
            className="w-full py-4 bg-white text-slate-700 font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm shadow-sm flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Give App Feedback
          </button>
        )}
        {feedbackState === "modal" && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-center text-sm font-bold text-slate-700 mb-4">How is your experience with DermaScan?</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => submitFeedback("sad")}     className="text-3xl hover:scale-110 transition-transform">😞</button>
              <button onClick={() => submitFeedback("neutral")} className="text-3xl hover:scale-110 transition-transform">😐</button>
              <button onClick={() => submitFeedback("happy")}   className="text-3xl hover:scale-110 transition-transform">🤩</button>
            </div>
          </div>
        )}
        {feedbackState === "success" && (
          <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl border border-emerald-100 text-center text-sm font-bold">
            Thank you for your feedback! ✨
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full py-4 bg-rose-50 text-rose-600 font-bold rounded-2xl border border-rose-200 hover:bg-rose-100 transition-colors text-sm shadow-sm flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          Sign Out Securely
        </button>
      </div>
    </div>
  );
}