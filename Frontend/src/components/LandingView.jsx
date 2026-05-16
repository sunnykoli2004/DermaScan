import axios from'axios';
import { useState } from "react";

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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
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

export default function LandingView({ navigateTo }) {
  const [authMode, setAuthMode] = useState("signin");
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState("");
  const [formData, setFormData] = useState({ email: "", password: "", name: "" });
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!formData.email.includes("@")) e.email = "Enter a valid email.";
    if (formData.password.length < 6) e.password = "Password must be at least 6 characters.";
    if (authMode === "register" && !formData.name.trim()) e.name = "Name is required.";
    return e;
  };

  const handleSubmit = async (e) => {
    // 1. Prevent accidental page reloads
    if (e && e.preventDefault) e.preventDefault();

    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    
    setErrors({});
    setIsLoading(true);

    try {
        if (authMode === "signin") {
            // LOGIN FLOW
            const res = await axios.post(`http://127.0.0.1:8000/login`, {
                email: formData.email,
                password: formData.password,
            });

            if (res.data.success || res.status === 200) {
                localStorage.setItem("userEmail", res.data.email);
                localStorage.setItem("isAuthenticated", "true");
                navigateTo("user"); 
            }
        } else {
            // REGISTRATION FLOW -> Triggers OTP
            const res = await axios.post(`http://127.0.0.1:8000/register`, {
                name: formData.name,
                email: formData.email,
                password: formData.password,
            });
            // Show the OTP screen
            setShowOTP(true);
        }
    } catch (error) {
        console.error("Auth failed:", error);
        setErrors({ auth: error.response?.data?.detail || "Invalid credentials or server error" });
    } finally {
        setIsLoading(false);
    }
  };


    const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
        const res = await axios.post(`http://127.0.0.1:8000/verify-otp`, {
            email: formData.email,
            otp: otp
        });

        if (res.data.success || res.status === 200) {
            // OTP is correct! Log them in.
            localStorage.setItem("userEmail", formData.email);
            localStorage.setItem("isAuthenticated", "true");
            navigateTo("user");
        }
    } catch (error) {
        setErrors({ auth: "Invalid or expired verification code." });
    } finally {
        setIsLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    setFormData((p) => ({ ...p, [field]: e.target.value }));
    setErrors((p) => ({ ...p, [field]: undefined }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100">
      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/70 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shadow-md">
              <svg className="w-4.5 h-4.5 text-white w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
            <button
              onClick={() => navigateTo("admin")}
              className="text-xs text-slate-400 hover:text-sky-600 transition-colors font-medium"
            >
              Admin
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-12 lg:gap-12 lg:items-start">

          {/* ── LEFT COLUMN: Hero + Cards ───────────────────── */}
          <div className="lg:col-span-7 xl:col-span-8 mb-10 lg:mb-0">
            {/* Hero */}
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

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { label: "Scans Analyzed", value: "2.4M+" },
                { label: "Accuracy Rate", value: "94.7%" },
                { label: "Partner Clinics", value: "1,200+" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200 shadow-sm text-center">
                  <div className="text-xl sm:text-2xl font-black text-sky-600">{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Precaution Cards */}
            <div>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                Skin Cancer Prevention Guide
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRECAUTIONS.map((p) => (
                  <div
                    key={p.title}
                    className={`flex items-start gap-3.5 p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow duration-200`}
                  >
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

          {/* ── RIGHT COLUMN: Auth Form ──────────────────────── */}
          <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24">
            {showOTP ? (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden p-8 text-center animate-fade-in">
                <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-sky-500">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">Check your email</h2>
                <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">
                  We've sent a 6-digit verification code to <br/>
                  <span className="font-bold text-slate-800">{formData.email}</span>
                </p>

                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  <div>
                    <input
                      type="text"
                      maxLength="6"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full text-center text-3xl font-black tracking-[0.5em] text-slate-800 bg-slate-50 border border-slate-200 rounded-xl py-4 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                    />
                  </div>
                  {errors.auth && <p className="text-rose-500 text-xs font-bold">{errors.auth}</p>}
                  <button type="submit" disabled={isLoading || otp.length !== 6} className="w-full bg-slate-900 text-white font-black rounded-xl py-4 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50">
                    {isLoading ? "Verifying..." : "Verify Account"}
                  </button>
                </form>
                <button onClick={() => setShowOTP(false)} className="mt-6 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2">
                  Wrong email address? Go back.
                </button>
              </div>
            ) : (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
              {/* Form header */}
              <div className="bg-gradient-to-r from-sky-600 to-sky-500 px-6 py-5">
                <h2 className="text-white font-bold text-xl tracking-tight">
                  {authMode === "signin" ? "Welcome Back" : "Create Account"}
                </h2>
                <p className="text-sky-100 text-sm mt-0.5">
                  {authMode === "signin" ? "Sign in to access your dashboard" : "Join DermaScan today — it's free"}
                </p>
              </div>

              {/* Toggle tabs */}
              <div className="flex border-b border-slate-100">
                {["signin", "register"].map((m) => (
                  <button
                    key={m}
                    onClick={() => { setAuthMode(m); setErrors({}); setDisclaimerChecked(false); }}
                    className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                      authMode === m
                        ? "text-sky-600 border-b-2 border-sky-600 bg-sky-50/50"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              <div className="p-6 space-y-4">
                {/* Name field (register only) */}
                {authMode === "register" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={handleChange("name")}
                      placeholder="Sunny Koli"
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 transition ${
                        errors.name ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-slate-50 focus:bg-white"
                      }`}
                    />
                    {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name}</p>}
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={handleChange("email")}
                    placeholder="you@example.com"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 transition ${
                      errors.email ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-slate-50 focus:bg-white"
                    }`}
                  />
                  {errors.email && <p className="text-rose-500 text-xs mt-1">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={handleChange("password")}
                    placeholder="Min. 6 characters"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 transition ${
                      errors.password ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-slate-50 focus:bg-white"
                    }`}
                  />
                  {errors.password && <p className="text-rose-500 text-xs mt-1">{errors.password}</p>}
                </div>

                {/* Medical Disclaimer */}
                <div className={`rounded-xl border p-3.5 transition-colors ${disclaimerChecked ? "border-sky-300 bg-sky-50" : "border-amber-200 bg-amber-50"}`}>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={disclaimerChecked}
                        onChange={(e) => setDisclaimerChecked(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        disclaimerChecked ? "bg-sky-600 border-sky-600" : "border-amber-400 bg-white group-hover:border-amber-500"
                      }`}>
                        {disclaimerChecked && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <span className="font-bold text-slate-800">Medical Disclaimer: </span>
                      I understand this AI tool is for{" "}
                      <span className="font-semibold text-amber-700">educational purposes</span>, can make mistakes, and is{" "}
                      <span className="font-semibold text-rose-600">NOT a substitute</span> for a qualified doctor's clinical diagnosis.
                    </p>
                  </label>
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!disclaimerChecked || isLoading}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 shadow-sm ${
                    disclaimerChecked && !isLoading
                      ? "bg-sky-600 hover:bg-sky-700 text-white shadow-sky-200 hover:shadow-md active:scale-[0.99]"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Authenticating…
                    </span>
                  ) : authMode === "signin" ? "Sign In to Dashboard" : "Create My Account"}
                </button>

                {!disclaimerChecked && (
                  <p className="text-center text-xs text-slate-400">
                    ☝️ Accept the disclaimer above to enable sign-in
                  </p>
                )}
              </div>

              {/* Admin link */}
              <div className="px-6 pb-5 text-center">
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
            </div>
            )}

            {/* Trust badge */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                256-bit SSL
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                HIPAA Compliant
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                GDPR Ready
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}