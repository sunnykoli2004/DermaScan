import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE;
// Maps every prediction label the backend can return to a Tailwind colour set.
// _default is the safe fallback for any unexpected label.
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

// ─────────────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// Single source of truth for the authenticated user's email/name.
// Reads from localStorage so the session survives hard refreshes.
function getStoredEmail() { return localStorage.getItem("userEmail") ?? ""; }
function getStoredName()  { return localStorage.getItem("userName")  ?? ""; }

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE RING
// Animated SVG arc gauge. Transitions from 0 → value on first render.
// ─────────────────────────────────────────────────────────────────────────────
function ConfidenceRing({ value = 0, color = "#10b981", size = 130 }) {
  const R      = (size / 2) - 10;
  const C      = 2 * Math.PI * R;
  const target = C - (value / 100) * C;
  const [offset, setOffset] = useState(C); // start "empty"

  useEffect(() => {
    // rAF so the browser paints the initial state before animating
    const id = requestAnimationFrame(() => setOffset(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="#e2e8f0" strokeWidth="9"/>
        {/* Progress arc */}
        <circle
          cx={size/2} cy={size/2} r={R}
          fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-black text-slate-800 leading-none tabular-nums">
          {Number(value).toFixed(1)}%
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
          Confidence
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD MODAL
// Two internal states controlled by the `result` variable:
//   State A (result === null) — file picker + upload button
//   State B (result !== null) — persistent success panel with ring gauge
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD MODAL (With Live Camera & Guidelines)
// ─────────────────────────────────────────────────────────────────────────────
function UploadModal({ mode, onClose, onSuccess }) {
  const [file,        setFile]        = useState(null);
  const [preview,     setPreview]     = useState(null);  // local blob URL
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [result,      setResult]      = useState(null);  // real scan object from API
  const [uploadError, setUploadError] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const inputRef  = useRef();
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // ── Camera Management ──────────────────────────────────────────────────
  const startCamera = async () => {
    setUploadError(null);
    try {
      // Prefer the back camera on mobile phones
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsStreaming(true);
    } catch (err) {
      setUploadError("Camera access denied or unavailable. Please check your browser permissions.");
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Auto-start camera if opened in camera mode, stop on close/unmount
  useEffect(() => {
    if (mode === "camera" && !preview && !result) {
      startCamera();
    }
    return () => stopCamera();
  }, [mode, preview, result, stopCamera]);

  // ── Capture Photo ──────────────────────────────────────────────────────
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the current video frame onto the canvas
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to a File object
    canvas.toBlob((blob) => {
      const capturedFile = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
      setFile(capturedFile);
      setPreview(URL.createObjectURL(capturedFile));
      stopCamera();
    }, "image/jpeg", 0.95);
  };

  // ── File Selection (Gallery) ──────────────────────────────────────────
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

  const retakePhoto = () => {
    setFile(null);
    setPreview(null);
    setUploadError(null);
  };

  // ── Upload + Prediction ───────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return;

    const email = getStoredEmail();
    if (!email) {
      setUploadError("Session expired — please sign in again.");
      return;
    }

    setUploading(true);
    setProgress(0);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file",  file);
    formData.append("email", email);

    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      const scan = res.data.scan;
      setResult(scan);
      onSuccess(scan);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        setUploadError(detail);
      } else if (Array.isArray(detail)) {
        setUploadError(detail.map((d) => d.msg).join(" · "));
      } else {
        setUploadError("Upload failed. Check your connection and try again.");
      }
    } finally {
      setUploading(false);
      setProgress(100);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={!uploading ? onClose : undefined}
      />

      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-200"/>
        </div>

        <div className="px-6 pb-7 pt-4 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              {result ? "Analysis Complete" : mode === "camera" && !preview ? "Capture Image" : "Review & Upload"}
            </h3>
            {!uploading && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* ════ STATE A — Camera Viewfinder ════ */}
          {!result && mode === "camera" && !preview && (
            <div className="flex flex-col items-center">
              {/* Live Video Box */}
              <div className="w-full aspect-[4/5] bg-black rounded-2xl overflow-hidden relative shadow-inner">
                {isStreaming ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <svg className="animate-spin w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    <span className="text-sm font-semibold">Accessing Camera...</span>
                  </div>
                )}

                {/* Targeting Overlay (Crosshairs) */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-white/50 rounded-2xl flex items-center justify-center relative">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-emerald-400 absolute top-0 left-0 rounded-tl-xl"></div>
                    <div className="w-6 h-6 border-t-4 border-r-4 border-emerald-400 absolute top-0 right-0 rounded-tr-xl"></div>
                    <div className="w-6 h-6 border-b-4 border-l-4 border-emerald-400 absolute bottom-0 left-0 rounded-bl-xl"></div>
                    <div className="w-6 h-6 border-b-4 border-r-4 border-emerald-400 absolute bottom-0 right-0 rounded-br-xl"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-400/80 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Hidden canvas for capturing */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Guidelines */}
              <div className="w-full bg-sky-50 border border-sky-100 rounded-xl p-3 mt-4 mb-5">
                <h4 className="text-xs font-black text-sky-800 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Capture Guide
                </h4>
                <ul className="text-xs text-sky-700 space-y-1.5 font-medium">
                  <li className="flex gap-2"><span>1.</span> Center the lesion inside the brackets.</li>
                  <li className="flex gap-2"><span>2.</span> Ensure bright, natural lighting.</li>
                  <li className="flex gap-2"><span>3.</span> Hold the camera 4-6 inches away.</li>
                </ul>
              </div>

              {/* Shutter Button */}
              {isStreaming && (
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full bg-white border-4 border-slate-200 shadow-xl flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all ring-4 ring-sky-500/20"
                >
                  <div className="w-12 h-12 rounded-full bg-sky-500"></div>
                </button>
              )}
            </div>
          )}

          {/* ════ STATE B — Upload File Picker or Image Preview ════ */}
          {!result && (mode === "upload" || preview) && (
            <>
              {/* Drop zone / Preview box */}
              <div
                role="button" tabIndex={0}
                onClick={() => !preview ? inputRef.current?.click() : null}
                onKeyDown={(e) => e.key === "Enter" && !preview && inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                className={`relative border-2 border-dashed rounded-2xl text-center overflow-hidden transition-colors mb-4 ${
                  preview ? "border-transparent bg-slate-50 aspect-square" : "border-sky-300 p-8 cursor-pointer hover:bg-sky-50 focus:ring-2 focus:ring-sky-500"
                }`}
              >
                {preview ? (
                  <>
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    {mode === "camera" && !uploading && (
                      <button onClick={retakePhoto} className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 shadow-sm border border-slate-200 hover:bg-white flex items-center gap-1.5 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                        Retake
                      </button>
                    )}
                    {mode === "upload" && !uploading && (
                      <button onClick={retakePhoto} className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 shadow-sm border border-slate-200 hover:bg-white flex items-center gap-1.5 transition-colors">
                         <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Remove
                      </button>
                    )}
                  </>
                ) : (
                  <div className="py-4">
                    <div className="w-16 h-16 rounded-2xl bg-sky-100 flex items-center justify-center mx-auto mb-4 text-sky-600">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </div>
                    <p className="text-base font-bold text-slate-800 mb-1">Upload from Gallery</p>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[200px] mx-auto">
                      Drag & drop your image or click to browse files.
                    </p>
                  </div>
                )}
              </div>
              
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/bmp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />

              {/* Upload progress bar */}
              {uploading && (
                <div className="mb-5 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <div className="flex justify-between text-xs text-slate-600 mb-2 font-bold">
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      AI is analysing...
                    </span>
                    <span className="text-sky-600">{progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {/* Error banner */}
              {uploadError && (
                <div className="mb-5 flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700 shadow-sm">
                  <svg className="w-5 h-5 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  <span className="font-semibold leading-tight">{uploadError}</span>
                </div>
              )}

              {/* Analyse button */}
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`w-full py-3.5 rounded-xl font-black text-base transition-all duration-200 shadow-sm ${
                  file && !uploading
                    ? "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] shadow-lg shadow-slate-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {uploading ? "Processing..." : "Run AI Analysis"}
              </button>
            </>
          )}

          {/* ════ STATE C — Persistent Success Result ════ */}
          {result && (
            <div className="flex flex-col items-center gap-5">
              <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-inner bg-slate-50 relative p-3">
                {/* We use our beautiful SmartThumbnail here too! */}
                <SmartThumbnail url={result.image_url} prediction={result.prediction} />
                
                <div className={`absolute top-4 right-4 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border shadow-sm backdrop-blur-md bg-white/90 ${getBadge(result.prediction).pill}`}>
                  <span className={`w-2 h-2 rounded-full ${getBadge(result.prediction).dot}`}/>
                  {result.prediction}
                </div>
              </div>

              <ConfidenceRing value={result.confidence} color={getBadge(result.prediction).ring} size={140} />

              {/* Medical disclaimer */}
              <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 leading-relaxed shadow-sm">
                <span className="font-bold uppercase tracking-wider text-[10px] block mb-1">⚠️ Educational Use Only</span>
                This AI result is not a clinical diagnosis. Always consult a qualified dermatologist for any skin concern.
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

// ── SMART THUMBNAIL (Premium AI HUD Fallback) ──────────────────────────────
function SmartThumbnail({ url, prediction, confidence, createdAt, scanId }) {
  const [hasError, setHasError] = useState(false);

  if (!url || hasError) {
    const isBenign = prediction?.toLowerCase() === "benign";
    const bgClass = isBenign 
      ? "bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600" 
      : "bg-gradient-to-br from-rose-400 via-red-500 to-rose-600";
    
    // --- FIX: Timezone correction for AWS RDS (UTC to Local Time) ---
    let dateObj = new Date();
    if (createdAt) {
      // 1. Replace spaces with 'T' if the backend sends a raw SQL datetime
      let timeString = createdAt.replace(' ', 'T');
      // 2. If the backend didn't include a timezone, explicitly tell JavaScript it is UTC by appending 'Z'
      if (!timeString.endsWith('Z') && !timeString.includes('+')) {
        timeString += 'Z';
      }
      dateObj = new Date(timeString);
    }

    const dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const timeStr = dateObj.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' });
    
    const rawConf = String(confidence || "0").replace('%', '');
    const parsedConf = parseFloat(rawConf);
    const confNum = isNaN(parsedConf) ? "0.0" : parsedConf.toFixed(1);

    return (
      <div className={`w-full h-full rounded-xl flex flex-col items-center justify-center ${bgClass} relative overflow-hidden shadow-inner p-3`}>
        <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/20 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-black/20 rounded-full blur-2xl"></div>

        <div className="absolute top-3 left-3 right-3 flex justify-between items-start w-[calc(100%-24px)] z-10">
           <div className="flex flex-col text-left">
              <span className="text-[9px] font-bold text-white/90 uppercase drop-shadow-sm">{dateStr}</span>
              <span className="text-[8px] font-medium text-white/70">{timeStr}</span>
           </div>
           
           <div className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg border border-white/30 flex items-center shadow-md">
              <span className="text-sm font-black text-white tracking-wide drop-shadow-md">{confNum}%</span>
           </div>
        </div>

        <div className="relative flex items-center justify-center mb-1 mt-6">
          <div className="absolute inset-0 bg-white/40 rounded-full animate-ping"></div>
          <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-md border border-white/40 shadow-lg relative z-10">
            {isBenign ? (
              <svg className="w-5 h-5 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              <svg className="w-5 h-5 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            )}
          </div>
        </div>

        <span className="text-[13px] font-black text-white uppercase tracking-widest drop-shadow-md relative z-10 mt-1">
          {prediction || "Unknown"}
        </span>
        <span className="text-[7px] font-bold text-white/80 uppercase tracking-widest mt-1 relative z-10 bg-black/20 px-2 py-0.5 rounded-full backdrop-blur-sm border border-black/10">
          ID: {scanId ? `SCN-${scanId}` : 'ENCRYPTED'}
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
// HISTORY GRID — Requirement 4
// Real S3 image_url thumbnails, real prediction badges, real confidence bars.
// ─────────────────────────────────────────────────────────────────────────────
function HistoryGrid({ history, loading, error, onRetry }) {
    const [flippedCardId, setFlippedCardId] = useState(null);

  // Skeleton loader
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm animate-pulse">
            <div className="aspect-square bg-slate-200"/>
            <div className="p-2.5 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-3/4"/>
              <div className="h-3 bg-slate-100 rounded w-1/2"/>
              <div className="h-2 bg-slate-100 rounded w-full"/>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
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
          <button
            onClick={onRetry}
            className="text-xs font-bold text-rose-600 border border-rose-300 px-4 py-2 rounded-lg hover:bg-rose-100 transition-colors"
          >
            ↻ Try Again
          </button>
        )}
      </div>
    );
  }

  // Empty state
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

  // Real data - Requirement 4
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {history.map((scan) => {
        return (
          <div 
            key={scan.id} 
            className="group relative h-[340px] w-full [perspective:1000px] cursor-pointer"
            onClick={() => setFlippedCardId(flippedCardId === scan.id ? null : scan.id)}
          >
            {/* Inner container that actually rotates */}
            <div className={`relative w-full h-full transition-transform duration-700 ease-in-out [transform-style:preserve-3d] shadow-lg rounded-3xl ${
              flippedCardId === scan.id ? '[transform:rotateY(180deg)]' : ''
            }`}>

              {/* ================= FRONT OF CARD ================= */}
              <div className={`absolute inset-0 w-full h-full [backface-visibility:hidden] rounded-3xl p-6 text-white overflow-hidden flex flex-col justify-between ${
                  scan.prediction?.toLowerCase() === 'benign' 
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600' 
                    : 'bg-gradient-to-br from-rose-500 to-red-600'
                }`}
              >
                {/* Dynamic Glow */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                  <div className="absolute -top-[20%] -right-[10%] w-[80%] h-[80%] rounded-full bg-white/30 blur-2xl group-hover:scale-[2] transition-transform duration-1000 ease-out" />
                  <div className="absolute -bottom-[20%] -left-[20%] w-[80%] h-[80%] rounded-full bg-white/20 blur-xl group-hover:translate-x-12 group-hover:-translate-y-12 transition-transform duration-1000 ease-out" />
                </div>

                {/* Front Text Content */}
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[11px] opacity-90 font-bold uppercase tracking-wider">
                        {new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-[10px] opacity-80 mt-0.5 font-medium">
                        {new Date(scan.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black tracking-wider border border-white/40 shadow-sm">
                      {scan.confidence ? parseFloat(String(scan.confidence).replace(/[^0-9.]/g, '')).toFixed(1) : "0.0"}%
                    </span>
                  </div>

                  <div className="text-center my-auto transition-transform duration-500">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md relative border-2 border-white/50 shadow-lg">
                      <div className="absolute inset-0 rounded-full border-4 border-white animate-ping opacity-60" />
                      {scan.prediction?.toLowerCase() === 'benign' ? (
                        <svg className="w-8 h-8 drop-shadow-md text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                      ) : (
                        <svg className="w-8 h-8 drop-shadow-md text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                      )}
                    </div>
                    <h3 className="text-2xl font-black tracking-widest uppercase drop-shadow-lg">{scan.prediction}</h3>
                    <p className="text-[10px] opacity-90 font-bold mt-2 uppercase tracking-widest bg-black/20 inline-block px-3 py-1 rounded-md border border-white/10">TAP TO VIEW REPORT</p>
                  </div>
                </div>

                {/* S3 Image */}
                {scan.image_url && (
                  <img 
                    src={scan.image_url} 
                    alt="Skin Scan" 
                    className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-10 pointer-events-none group-hover:opacity-30 transition-opacity duration-700"
                  />
                )}
              </div>

              {/* ================= BACK OF CARD ================= */}
              <div className={`absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-3xl p-6 text-white overflow-hidden flex flex-col justify-between ${
                  scan.prediction?.toLowerCase() === 'benign' ? 'bg-emerald-600' : 'bg-red-600'
                }`}
              >
                 <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-4">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                       <h4 className="font-bold tracking-widest uppercase text-sm">Analysis Report</h4>
                    </div>

                    {/* The Scrollable Box with Hidden Scrollbar & Perfect Curves */}
                    <div 
                      className="bg-black/20 rounded-2xl p-4 flex-1 text-sm leading-relaxed overflow-y-auto cursor-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {scan.prediction?.toLowerCase() === 'benign' ? (
                        <div className="pb-2">
                          <p className="font-bold text-emerald-200 mb-2">Recommendation:</p>
                          <ul className="list-disc pl-4 space-y-2 opacity-90 text-xs">
                            <li>Continue applying SPF 50+ daily.</li>
                            <li>Avoid excessive sun exposure.</li>
                            <li>Monitor this area for any changes in size, shape, or color.</li>
                          </ul>
                        </div>
                      ) : (
                        <div className="pb-2">
                          <p className="font-bold text-red-200 mb-2">High Priority:</p>
                          <p className="text-xs opacity-90 mb-3">The AI detected potential malignant patterns.</p>
                          <p className="text-xs font-bold bg-red-900/50 p-4 rounded-xl border border-red-400/30 shadow-sm">
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
        );
      })}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD — Requirements 1, 5
// ─────────────────────────────────────────────────────────────────────────────
export default function UserDashboard({ user, onLogout }) {
  const [activeTab,      setActiveTab]      = useState("home");
  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError,   setHistoryError]   = useState(null);
  const [uploadModal,    setUploadModal]    = useState(null); // "upload"|"camera"|null

  // Requirement 5 — derive display values from the prop first, then
  // localStorage, so nothing crashes or goes blank if user prop is null
  // (e.g. during a hard reload before App.jsx re-hydrates its state).
  const email       = user?.email ?? getStoredEmail();
  const displayName = user?.name  ?? getStoredName()
                      ?? email.split("@")[0]
                      ?? "User";

  // ── Write to localStorage whenever a fresh user prop arrives ──────────
  // Ensures UploadModal & fetchHistory can always read the email even if
  // the user prop is temporarily null on re-renders.
  useEffect(() => {
    if (user?.email) localStorage.setItem("userEmail", user.email);
    if (user?.name)  localStorage.setItem("userName",  user.name);
  }, [user?.email, user?.name]);

  // ── Requirement 1 — live history fetch ───────────────────────────────
  const fetchHistory = useCallback(async () => {
    const storedEmail = getStoredEmail();
    if (!storedEmail) { setHistoryLoading(false); return; }

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      // GET /history/{email}
      // Response: { success, email, total, scans: [...ScanResponse] }
      const res = await axios.get(
        `${API_BASE}/history/${encodeURIComponent(storedEmail)}`
      );
      // Requirement 1 — map res.data.scans, not the root res.data object
      setHistory(res.data.scans ?? []);
    } catch (err) {
      setHistoryError(
        err.response?.data?.detail ??
        "Could not load scan history. Check your connection."
      );
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Requirement 5 — logout clears localStorage then calls parent ──────
  const handleLogout = () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    if (typeof onLogout === "function") onLogout();
  };

  // ── Prepend new scan so the grid updates instantly after upload ────────
  const handleScanSuccess = (newScan) => {
    setHistory((prev) => [newScan, ...prev]);
    // Modal stays open showing State B result; user closes it via Done.
  };

  // ── Tab router ────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return (
          <HomeTab
            displayName={displayName}
            onScan={() => setUploadModal("upload")}
            onCamera={() => setUploadModal("camera")}
            history={history}
            historyLoading={historyLoading}
            historyError={historyError}
            onRetry={fetchHistory}
          />
        );
      case "scan":
        return (
          <ScanTab
            onCamera={() => setUploadModal("camera")}
            onUpload={() => setUploadModal("upload")}
          />
        );
      case "history":
        return (
          <HistoryTab
            history={history}
            loading={historyLoading}
            error={historyError}
            onRetry={fetchHistory}
          />
        );
      case "doctor":  return <DoctorTab/>;
      case "profile":
        return (
          <ProfileTab
            displayName={displayName}
            email={email}
            scanCount={history.length}
            onLogout={handleLogout}
          />
        );
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 lg:w-64 bg-white border-r border-slate-200 shadow-sm shrink-0">
        {/* Logo */}
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

        {/* User badge — safe if user prop is null */}
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

        {/* Nav */}
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
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Support CTA */}
        <div className="px-4 pb-4">
          <div className="bg-gradient-to-br from-sky-600 to-sky-700 rounded-xl p-4 text-white">
            <div className="text-xs font-bold mb-1">Need Help?</div>
            <p className="text-xs text-sky-200 mb-3">Contact our support team for any assistance.</p>
            <button className="w-full bg-white text-sky-700 text-xs font-bold py-2 rounded-lg hover:bg-sky-50 transition-colors">
              Get Support
            </button>
          </div>
        </div>

        {/* Sign Out — Requirement 5: clears localStorage */}
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

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
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

        {/* Scrollable page */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {renderContent()}
        </main>

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

      {/* ── UPLOAD MODAL ────────────────────────────────────────────────── */}
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
        <h1 className="text-2xl font-black text-slate-800">
          Hello, {displayName.split(" ")[0]} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Ready to monitor your skin health today?</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={onCamera}
          className="flex flex-col items-start gap-3 bg-sky-600 text-white p-4 sm:p-5 rounded-2xl shadow-lg shadow-sky-200 hover:bg-sky-700 active:scale-[0.98] transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <circle cx="12" cy="13" r="3" strokeWidth={2}/>
            </svg>
          </div>
          <div>
            <div className="font-black text-sm">Open Camera</div>
            <div className="text-xs text-sky-200 mt-0.5">Capture live photo</div>
          </div>
        </button>

        <button
          onClick={onScan}
          className="flex flex-col items-start gap-3 bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-sky-300 active:scale-[0.98] transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <div>
            <div className="font-black text-sm text-slate-800">Upload File</div>
            <div className="text-xs text-slate-400 mt-0.5">From your gallery</div>
          </div>
        </button>
      </div>

      {/* Recent scans */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-700 text-sm">Recent Scans</h2>
          <span className="text-xs text-sky-600 font-semibold">{history.length} total</span>
        </div>
        <HistoryGrid
          history={history.slice(0, 3)}
          loading={historyLoading}
          error={historyError}
          onRetry={onRetry}
        />
      </div>

      {/* Tip card */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex gap-3 items-start">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div>
          <div className="text-xs font-bold text-emerald-800 mb-0.5">Daily Tip</div>
          <p className="text-xs text-emerald-700">
            Perform monthly self-checks using the ABCDE method. Look for Asymmetry,
            Border changes, Color variation, Diameter &gt; 6 mm, and Evolution.
          </p>
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
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <circle cx="12" cy="13" r="3" strokeWidth={2}/>
            </svg>
          </div>
          <div className="text-left flex-1">
            <div className="font-black">Open Camera</div>
            <div className="text-sm text-sky-200">Use your device's camera for a live capture</div>
          </div>
          <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>

        <button onClick={onUpload} className="w-full flex items-center gap-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-sky-300 transition-all active:scale-[0.99]">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <div className="text-left flex-1">
            <div className="font-black text-slate-800">Upload from Gallery</div>
            <div className="text-sm text-slate-400">JPG, PNG, WEBP — up to 10 MB</div>
          </div>
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs text-amber-800 leading-relaxed">
          <span className="font-bold">📸 Photo Tips:</span> Ensure good lighting, hold steady, and centre
          the area of concern. Avoid shadows and blurring for best AI accuracy.
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
          <button
            onClick={onRetry}
            className="text-xs text-sky-600 font-semibold border border-sky-200 px-3 py-1.5 rounded-lg hover:bg-sky-50 transition-colors"
          >
            ↻ Refresh
          </button>
        )}
      </div>
      <HistoryGrid history={history} loading={loading} error={error} onRetry={onRetry}/>
    </div>
  );
}

// ── DOCTOR TAB (Google Maps Integration) ───────────────────────────────────
// ── DOCTOR TAB (Optimized City Search Map) ────────────────────────────────
function DoctorTab() {
  const [searchInput, setSearchInput] = useState("");
  // Initial search when they first open the tab
  const [mapQuery, setMapQuery] = useState("dermatologist in Pune"); 

  const handleSearch = () => {
    if (searchInput.trim() !== "") {
      // This sends a precise command to the Google engine
      setMapQuery(`dermatologist in ${searchInput}`);
    }
  };

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Find a Dermatologist</h2>
      <p className="text-slate-500 text-sm mb-8 font-medium">Locate certified skin specialists in your city.</p>
      
      {/* ── Search Bar ── */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm focus-within:border-sky-500 focus-within:ring-4 ring-sky-500/20 transition-all">
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input 
            className="flex-1 text-base font-semibold text-slate-800 placeholder-slate-400 outline-none bg-transparent" 
            placeholder="Enter your city (e.g. Mumbai, Jalgaon)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button 
          onClick={handleSearch} 
          className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-slate-800 transition-colors shadow-lg active:scale-95 shrink-0"
        >
          Search
        </button>
      </div>

      {/* ── Real Google Maps Search Embed ── */}
      <div className="bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 shadow-inner mb-8 relative" style={{ height: 400 }}>
        <iframe
          title="Dermatologist Search Map"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          // This URL structure is the official way to embed a search query without an API key
          src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&ie=UTF8&iwloc=&output=embed`}
        ></iframe>
      </div>

      {/* ── Note for User ── */}
      <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex gap-3 items-center">
        <span className="text-xl">📍</span>
        <p className="text-xs text-sky-800 font-medium">
          Click on the red pins in the map above to see clinic names, ratings, and phone numbers directly from Google.
        </p>
      </div>
    </div>
  );
}

// ── 3D ANIMATED MEDICAL INSTRUMENT (Pure CSS Hologram) ─────────────────────
function Animated3DMedicalIcon() {
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center opacity-40 pointer-events-none" style={{ perspective: '800px' }}>
      <style>{`
        @keyframes spinY {
          0% { transform: rotateY(0deg) rotateX(15deg); }
          100% { transform: rotateY(360deg) rotateX(15deg); }
        }
        .hologram-cross {
          position: relative;
          width: 90px;
          height: 90px;
          transform-style: preserve-3d;
          animation: spinY 8s linear infinite;
        }
        .hologram-part {
          position: absolute;
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid rgba(255, 255, 255, 0.8);
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.6), inset 0 0 15px rgba(255, 255, 255, 0.6);
          border-radius: 6px;
          backdrop-filter: blur(2px);
        }
        /* Vertical & Horizontal Bars to create the 3D Cross */
        .v-front { width: 26px; height: 90px; left: 32px; top: 0; transform: translateZ(13px); }
        .v-back  { width: 26px; height: 90px; left: 32px; top: 0; transform: translateZ(-13px); }
        .h-front { width: 90px; height: 26px; left: 0; top: 32px; transform: translateZ(13px); }
        .h-back  { width: 90px; height: 26px; left: 0; top: 32px; transform: translateZ(-13px); }
      `}</style>
      
      <div className="hologram-cross">
        <div className="hologram-part v-front"></div>
        <div className="hologram-part v-back"></div>
        <div className="hologram-part h-front"></div>
        <div className="hologram-part h-back"></div>
      </div>
    </div>
  );
}

// ── PROFILE TAB (Patient-Focused Dashboard + Feedback) ─────────────────────────
function ProfileTab({ displayName, email, scanCount, onLogout }) {
  const [feedbackState, setFeedbackState] = useState("idle");

  const submitFeedback = (type) => {
    // In production, this sends an axios.post to your FastAPI backend
    console.log(`Feedback submitted: ${type}`);
    setFeedbackState("success");
    setTimeout(() => setFeedbackState("idle"), 3000);
  };

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto space-y-6 relative">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Profile</h2>

      {/* 1. Main User Identity Card with 3D Medical Header */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden text-center relative">
        <div className="h-36 relative bg-gradient-to-r from-sky-400 to-indigo-500 overflow-hidden">
          <div className="absolute inset-0 bg-white/10 animate-pulse mix-blend-overlay"></div>
          <Animated3DMedicalIcon />
        </div>
        <div className="relative px-6 pb-8">
          <div className="w-24 h-24 mx-auto rounded-full bg-white border-4 border-white shadow-md flex items-center justify-center text-indigo-600 text-4xl font-black -mt-12 mb-4 relative z-10">
            {(displayName[0] ?? "U").toUpperCase()}
          </div>
          <h3 className="text-2xl font-black text-slate-800">{displayName}</h3>
          <p className="text-slate-500 font-medium">{email || "No email provided"}</p>
        </div>
      </div>

      {/* 2. Quick Info Widgets */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow cursor-default">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" strokeWidth={2}/></svg>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{scanCount}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Scans</div>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow cursor-default">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </div>
          <div>
            <div className="text-xl font-black text-slate-800">v2.4.1</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">App Version</div>
          </div>
        </div>
      </div>

      {/* 3. Motivation & Precautions Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-black text-slate-800 mb-5 flex items-center gap-2">
            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Skin Health & Precautions
          </h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0 text-lg">☀️</div>
              <div>
                <h4 className="font-bold text-slate-700 text-sm">Daily Sun Protection</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Apply a broad-spectrum SPF 30+ sunscreen every day, even when it's cloudy. Reapply every 2 hours when outdoors.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shrink-0 text-lg">🔍</div>
              <div>
                <h4 className="font-bold text-slate-700 text-sm">Monthly Self-Exams</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Use the ABCDE rule to check moles: Asymmetry, Border irregularity, Color changes, Diameter &gt;6mm, and Evolution over time.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-500 shrink-0 text-lg">💧</div>
              <div>
                <h4 className="font-bold text-slate-700 text-sm">Stay Hydrated</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Drink plenty of water and use moisturizers to maintain your skin's natural barrier and elasticity.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-5 border-t border-emerald-100">
          <p className="text-sm font-semibold text-emerald-800 text-center italic">
            "Taking care of your skin today is an investment in your health tomorrow."
          </p>
        </div>
      </div>

      {/* 4. Action Buttons & Feedback */}
      <div className="pt-2 pb-10 space-y-3">
        {/* Feedback Section */}
        {feedbackState === "idle" && (
          <button onClick={() => setFeedbackState("modal")} className="w-full py-4 bg-white text-slate-700 font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm shadow-sm flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Give App Feedback
          </button>
        )}

        {feedbackState === "modal" && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm animate-fade-in">
            <p className="text-center text-sm font-bold text-slate-700 mb-4">How is your experience with DermaScan?</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => submitFeedback('sad')} className="text-3xl hover:scale-110 transition-transform">😞</button>
              <button onClick={() => submitFeedback('neutral')} className="text-3xl hover:scale-110 transition-transform">😐</button>
              <button onClick={() => submitFeedback('happy')} className="text-3xl hover:scale-110 transition-transform">🤩</button>
            </div>
          </div>
        )}

        {feedbackState === "success" && (
          <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl border border-emerald-100 text-center text-sm font-bold animate-fade-in">
            Thank you for your feedback! ✨
          </div>
        )}

        {/* Sign Out */}
        <button onClick={onLogout} className="w-full py-4 bg-rose-50 text-rose-600 font-bold rounded-2xl border border-rose-200 hover:bg-rose-100 transition-colors text-sm shadow-sm flex items-center justify-center gap-2 active:scale-[0.99]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          Sign Out Securely
        </button>
      </div>
    </div>
  );
}