import React, { useState, useEffect } from "react";
import axios from "axios";

// ── ENVIRONMENT VARIABLES ─────────────────────────────────────────────────────
// Vite STATICALLY replaces import.meta.env.VITE_* at build time by scanning
// source files. The previous Function("return import.meta.env") trick broke
// this static analysis so Vite never injected the values — causing the Google
// button to disappear in production while working fine in dev.
const API_BASE         = import.meta.env.VITE_API_BASE         || "https://skincancerdetector-vwlq.onrender.com";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const PRECAUTIONS = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5" strokeWidth="2"/>
        <path strokeLinecap="round" strokeWidth="2" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    ),
    title: "UV Protection",
    desc: "Apply broad-spectrum SPF 30+ sunscreen daily, even on cloudy days. Reapply every 2 hours during outdoor exposure.",
    color: "bg-amber-50 text-amber-600 border-amber-100",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>
    ),
    title: "Monthly Self-Checks",
    desc: "Examine your skin head-to-toe once a month. Look for new growths, spots, bumps, patches, or sores using the ABCDE method.",
    color: "bg-sky-50 text-sky-600 border-sky-100",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
      </svg>
    ),
    title: "Annual Screenings",
    desc: "Schedule a professional skin exam with a dermatologist every year, especially if you have a family history of melanoma.",
    color: "bg-emerald-50 text-emerald-600 border-emerald-100",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
      </svg>
    ),
    title: "Avoid Tanning Beds",
    desc: "Indoor UV tanning beds increase melanoma risk by 75%. Opt for self-tanning products if you want a bronzed look.",
    color: "bg-rose-50 text-rose-600 border-rose-100",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
      </svg>
    ),
    title: "Know the ABCDEs",
    desc: "Asymmetry, Border irregularity, Color variation, Diameter > 6mm, and Evolving appearance are key warning signs to report.",
    color: "bg-violet-50 text-violet-600 border-violet-100",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m8-9h1M3 12H2m15.364-6.364l.707.707M5.636 18.364l-.707.707M18.364 18.364l.707-.707M5.636 5.636l-.707-.707"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 7a5 5 0 100 10A5 5 0 0012 7z"/>
      </svg>
    ),
    title: "Protective Clothing",
    desc: "Wear wide-brimmed hats, UV-blocking sunglasses, and tightly-woven long-sleeved shirts when outdoors between 10am–4pm.",
    color: "bg-teal-50 text-teal-600 border-teal-100",
  },
];

// ── AuthScreen ────────────────────────────────────────────────────────────────
function AuthScreen({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({ fullName: "", email: "", password: "" });
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [gsiLoaded, setGsiLoaded] = useState(false);

  // Load the Google Identity Services script once
  useEffect(() => {
    if (document.getElementById("google-gsi-client")) { setGsiLoaded(true); return; }
    const script = document.createElement("script");
    script.id      = "google-gsi-client";
    script.src     = "https://accounts.google.com/gsi/client";
    script.async   = true;
    script.defer   = true;
    script.onload  = () => setGsiLoaded(true);
    script.onerror = () => setError("Failed to load Google Authentication library.");
    document.body.appendChild(script);
  }, []);

  // Render the GSI button after the script loads
  useEffect(() => {
    if (!gsiLoaded || !GOOGLE_CLIENT_ID) return;
    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
      });
      const target = document.getElementById("google-login-target");
      if (target) {
        window.google.accounts.id.renderButton(target, {
          theme: "filled_blue",
          size:  "large",
          shape: "pill",
          width: target.offsetWidth || 280,
          text:  isSignUp ? "signup_with" : "signin_with",
        });
      }
    } catch (e) {
      console.error("Failed to render Google login button:", e);
    }
  }, [gsiLoaded, isSignUp]);

  const handleGoogleCredentialResponse = async (response) => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE}/auth/google`, {
        credential: response.credential,
      });
      if (res.data.success) {
        onLoginSuccess({
          email: res.data.email,
          name:  res.data.name || res.data.email.split("@")[0],
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Google Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const endpoint = isSignUp ? `${API_BASE}/register` : `${API_BASE}/login`;
    try {
      const res = await axios.post(endpoint, {
        email:    formData.email,
        password: formData.password,
      });
      if (res.data.success) {
        onLoginSuccess({
          email: res.data.email,
          name:  isSignUp
            ? formData.fullName
            : (res.data.name || res.data.email.split("@")[0]),
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto p-6 bg-white rounded-xl shadow-xl border border-gray-100">
      <h2 className="text-2xl font-black text-center text-slate-800 mb-6 tracking-tight">
        {isSignUp ? "Create DermaScan Account" : "Sign In to DermaScan"}
      </h2>

      {error && (
        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm font-semibold flex items-start gap-2">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          {error}
        </div>
      )}

      {/* Google Sign-In button */}
      <div className="flex justify-center mb-6 w-full drop-shadow-sm hover:drop-shadow transition-all">
        {GOOGLE_CLIENT_ID ? (
          <div id="google-login-target" className="w-full flex justify-center min-h-[44px]"/>
        ) : (
          <div className="text-xs text-amber-700 bg-amber-50 p-3 border border-amber-200 rounded-lg text-center w-full font-semibold">
            ⚠️ Google Sign-In is not configured.<br/>
            Add <code className="font-mono bg-amber-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> to your Vercel environment variables.
          </div>
        )}
      </div>

      <div className="relative flex py-4 items-center mb-2">
        <div className="flex-grow border-t border-slate-200"/>
        <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold uppercase tracking-widest">Or use email</span>
        <div className="flex-grow border-t border-slate-200"/>
      </div>

      <form onSubmit={handleManualSubmit} className="space-y-4">
        {isSignUp && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5">Full Name</label>
            <input
              type="text" name="fullName" required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all font-medium text-slate-800"
              placeholder="Your Name"
              value={formData.fullName}
              onChange={handleInputChange}
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5">Email Address</label>
          <input
            type="email" name="email" required
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all font-medium text-slate-800"
            placeholder="name@example.com"
            value={formData.email}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5">Password</label>
          <input
            type="password" name="password" required
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all font-medium text-slate-800"
            placeholder="Min. 6 characters"
            value={formData.password}
            onChange={handleInputChange}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white font-black p-3.5 rounded-lg transition-all duration-200 disabled:opacity-50 shadow-md active:scale-[0.98]"
        >
          {loading ? "Processing…" : isSignUp ? "Create My Account" : "Sign In"}
        </button>
      </form>

      <div className="mt-8 text-center">
        <button
          onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
          className="text-sm font-semibold text-sky-600 hover:text-sky-700 hover:underline transition-colors"
        >
          {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Create One"}
        </button>
      </div>
    </div>
  );
}

// ── Main LandingView ──────────────────────────────────────────────────────────
export default function LandingView({ navigateTo }) {
  // Ping the Render backend as soon as the landing page loads.
  // Render free tier sleeps after 15 min; this wakes it up before the user
  // submits the form so they don't mistake a cold-start delay for a failure.
  useEffect(() => {
    axios.get(`${API_BASE}/health`).catch(() => {});
  }, []);

  const handleLoginSuccess = (userData) => {
    localStorage.setItem("userEmail",       userData.email);
    localStorage.setItem("userName",        userData.name);
    localStorage.setItem("isAuthenticated", "true");
    navigateTo("user", { email: userData.email, name: userData.name });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/70 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm sm:text-base tracking-tight">DermaScan</span>
              <span className="hidden sm:inline text-slate-400 text-xs ml-1 font-light">AI Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"/>
              System Online
            </span>
            <button onClick={() => navigateTo("admin")} className="text-xs text-slate-400 hover:text-sky-600 transition-colors font-medium">
              Admin
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-12 lg:items-start">

          {/* Hero + Stats */}
          <div className="lg:col-span-7 xl:col-span-8 order-1 mb-10 lg:mb-0">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 bg-sky-600/10 text-sky-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-sky-200 mb-4">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                AI-Powered Early Detection
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-3">
                Skin Health <br className="hidden sm:block"/>
                <span className="text-sky-600">Intelligence</span> Platform
              </h1>
              <p className="text-slate-500 text-base lg:text-lg leading-relaxed max-w-2xl">
                Upload a photo, get an instant AI-assisted analysis, and connect with certified dermatologists near you.
                <span className="font-medium text-slate-700"> Early detection saves lives.</span>
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Scans Analyzed", value: "2.4M+" },
                { label: "Accuracy Rate",  value: "94.7%" },
                { label: "Partner Clinics", value: "1,200+" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200 shadow-sm text-center">
                  <div className="text-xl sm:text-2xl font-black text-sky-600">{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Auth Card */}
          <div className="lg:col-span-5 xl:col-span-4 lg:row-span-2 lg:sticky lg:top-24 order-2 mb-12 lg:mb-0 w-full">
            <AuthScreen onLoginSuccess={handleLoginSuccess}/>
            <div className="mt-6 text-center">
              <p className="text-xs text-slate-400">
                Healthcare provider?{" "}
                <button
                  onClick={() => navigateTo("admin")}
                  className="text-slate-500 hover:text-sky-600 font-semibold underline underline-offset-2 transition-colors"
                >
                  Admin Login →
                </button>
              </p>
            </div>
            <div className="mt-8 flex items-center justify-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                256-bit SSL
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                HIPAA Compliant
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                GDPR Ready
              </span>
            </div>
          </div>

          {/* Prevention Guide */}
          <div className="lg:col-span-7 xl:col-span-8 order-3">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
              Skin Cancer Prevention Guide
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRECAUTIONS.map((p) => (
                <div key={p.title} className="flex items-start gap-3.5 p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className={`p-2 rounded-lg border ${p.color} shrink-0`}>{p.icon}</div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm mb-1">{p.title}</div>
                    <div className="text-slate-500 text-xs leading-relaxed">{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}