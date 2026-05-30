import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_BASE || "https://skincancerdetector-vwlq.onrender.com";

// Colours used across charts
const FEEDBACK_COLORS   = { Happy: "#10b981", Neutral: "#f59e0b", Sad: "#f43f5e" };
const BREAKDOWN_COLORS  = { Benign: "#10b981", Malignant: "#f43f5e", Uncertain: "#f59e0b" };
const WEEKLY_BAR_COLOR  = "#6366f1";

// ─────────────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function Pill({ children, color = "slate" }) {
  const map = {
    emerald: "bg-emerald-900/40 text-emerald-400 border-emerald-700/50",
    rose:    "bg-rose-900/40    text-rose-400    border-rose-700/50",
    amber:   "bg-amber-900/40   text-amber-400   border-amber-700/50",
    indigo:  "bg-indigo-900/40  text-indigo-400  border-indigo-700/50",
    slate:   "bg-slate-700/60   text-slate-300   border-slate-600",
    sky:     "bg-sky-900/40     text-sky-400     border-sky-700/50",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${map[color] ?? map.slate}`}>
      {children}
    </span>
  );
}

function MethodBadge({ method }) {
  if (method === "google") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-sky-900/40 border border-sky-700/50 text-sky-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
      </svg>
      Email
    </span>
  );
}

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-slate-700/50 rounded-lg ${className}`}/>;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent = "indigo", loading }) {
  const ring = {
    indigo:  "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    sky:     "bg-sky-500/20    text-sky-400    border-sky-500/30",
    amber:   "bg-amber-500/20  text-amber-400  border-amber-500/30",
    rose:    "bg-rose-500/20   text-rose-400   border-rose-500/30",
    violet:  "bg-violet-500/20 text-violet-400 border-violet-500/30",
  };
  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700/50 p-5 flex items-center gap-4 hover:border-slate-600 transition-colors">
      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${ring[accent] ?? ring.indigo}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
        {loading
          ? <Skeleton className="h-7 w-20 mb-1"/>
          : <p className="text-2xl font-black text-white tabular-nums">{value ?? "—"}</p>
        }
        {sub && !loading && <p className="text-xs text-slate-500 font-medium mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN LOGIN GATE
// ─────────────────────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [passkey, setPasskey] = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE}/admin/login`, { passkey });
      if (res.data.success) {
        onLogin();
      } else {
        setError("Invalid administrative passkey.");
        setPasskey("");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Authentication failed. Please try again.");
      setPasskey("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl">
        <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/30">
          <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
        </div>
        <h2 className="text-2xl font-black text-white text-center mb-1">System Admin</h2>
        <p className="text-slate-400 text-sm text-center mb-8">Command Center Authentication</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            value={passkey}
            onChange={(e) => setPasskey(e.target.value)}
            placeholder="Enter Master Passkey…"
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3.5 focus:outline-none focus:border-indigo-500 transition-colors"
            required
          />
          {error && (
            <p className="text-rose-400 text-xs font-bold text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-black rounded-xl py-3.5 transition-colors flex justify-center items-center gap-2"
          >
            {loading
              ? <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : "Access Dashboard"
            }
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL = 30; // seconds

export default function AdminDashboard({ onExit }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  // ── Data state ─────────────────────────────────────────────────────────
  const [health,       setHealth]       = useState({ s3: "CHECKING", db: "CHECKING", modelAccuracy: 0, accuracyTrend: 0 });
  const [summary,      setSummary]      = useState(null);
  const [traffic,      setTraffic]      = useState([]);
  const [feedback,     setFeedback]     = useState([]);
  const [breakdown,    setBreakdown]    = useState([]);
  const [weeklyTrend,  setWeeklyTrend]  = useState([]);
  const [loginLogs,    setLoginLogs]    = useState([]);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [methodFilter, setMethodFilter] = useState("All");

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/dashboard-stats`);
      const d   = res.data;

      setHealth(d.health || { s3: "OFFLINE", db: "OFFLINE", modelAccuracy: 0, accuracyTrend: 0 });
      setSummary(d.summary || null);
      setTraffic(d.traffic || []);
      setWeeklyTrend(d.weekly_trend || []);
      setBreakdown(d.scan_breakdown || []);
      setLoginLogs(d.logs || []);

      // Add chart colours to feedback rows
      setFeedback(
        (d.feedback || []).map((f) => ({
          ...f,
          color: FEEDBACK_COLORS[f.name] ?? "#94a3b8",
        }))
      );
      setLastSync(new Date());
      setCountdown(REFRESH_INTERVAL);
    } catch (err) {
      console.error("Admin stats fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchDashboardData]);

  // Countdown timer (counts down from 30 to 0)
  useEffect(() => {
    if (!isAuthenticated) return;
    const tick = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL : c - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [isAuthenticated]);

  // ── Guard ──────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <AdminLogin onLogin={() => setIsAuthenticated(true)}/>;
  }

  // ── Derived values ─────────────────────────────────────────────────────
  const totalFeedback    = feedback.reduce((a, b) => a + b.value, 0);
  const happyFeedback    = feedback.find((f) => f.name === "Happy")?.value || 0;
  const happyPct         = totalFeedback > 0 ? Math.round((happyFeedback / totalFeedback) * 100) : 0;

  const filteredLogs = loginLogs.filter((log) => {
    const matchSearch = !searchQuery
      || log.email.toLowerCase().includes(searchQuery.toLowerCase())
      || log.ip.includes(searchQuery);
    const matchMethod = methodFilter === "All" || log.method === methodFilter.toLowerCase();
    return matchSearch && matchMethod;
  });

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col text-slate-100">

      {/* ── HEADER ── */}
      <header className="bg-slate-800/90 backdrop-blur border-b border-slate-700/60 px-5 py-3.5 flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
            </svg>
          </div>
          <div>
            <h1 className="font-black text-sm tracking-wide leading-none">
              DermaScan <span className="text-indigo-400">COMMAND CENTER</span>
            </h1>
            {lastSync && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                Last sync {lastSync.toLocaleTimeString()} · next in{" "}
                <span className={countdown <= 5 ? "text-amber-400 font-bold" : "text-slate-400"}>
                  {countdown}s
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* LIVE indicator */}
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"/>
            </span>
            LIVE
          </span>

          {/* Manual refresh */}
          <button
            onClick={fetchDashboardData}
            title="Refresh now"
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-700"
          >
            <svg className={`w-4.5 h-4.5 w-5 h-5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>

          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-700 hover:bg-rose-600 px-3 py-2 rounded-lg border border-slate-600 hover:border-rose-500 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">

        {/* ── ROW 1 — 6 Summary Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard loading={loading} label="Total Users" value={summary?.total_users?.toLocaleString()} accent="indigo"
            sub={summary?.new_users_today ? `+${summary.new_users_today} today` : "all time"}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
          />
          <StatCard loading={loading} label="Total Scans" value={summary?.total_scans?.toLocaleString()} accent="sky"
            sub="all time"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" strokeWidth={2}/></svg>}
          />
          <StatCard loading={loading} label="Logins Today" value={summary?.logins_today?.toLocaleString()} accent="emerald"
            sub="since midnight UTC"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>}
          />
          <StatCard loading={loading} label="Scans Today" value={summary?.scans_today?.toLocaleString()} accent="violet"
            sub="since midnight UTC"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
          />
          <StatCard loading={loading} label="New Users Today" value={summary?.new_users_today?.toLocaleString()} accent="amber"
            sub="registered today"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>}
          />
          <StatCard loading={loading} label="Malignant Detected" value={summary?.malignant_total?.toLocaleString()} accent="rose"
            sub="all time"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
          />
        </div>

        {/* ── ROW 2 — System Health ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* S3 */}
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${health.s3 === "ONLINE" ? "bg-emerald-500/20 text-emerald-400" : health.s3 === "CHECKING" ? "bg-slate-700 text-slate-400" : "bg-rose-500/20 text-rose-400"}`}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">AWS S3 Bucket</p>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${health.s3 === "ONLINE" ? "bg-emerald-400" : "bg-rose-400"}`}/>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${health.s3 === "ONLINE" ? "bg-emerald-500" : "bg-rose-500"}`}/>
                </span>
                <p className="text-xl font-black text-white">{health.s3}</p>
              </div>
            </div>
          </div>

          {/* Model accuracy */}
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 flex items-center gap-4 relative overflow-hidden">
            <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 relative z-10">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            </div>
            <div className="relative z-10">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">CNN Accuracy</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-black text-white">{health.modelAccuracy}%</p>
                <p className={`text-xs font-bold mb-1 flex items-center ${health.accuracyTrend >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {health.accuracyTrend >= 0
                    ? <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                    : <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
                  }
                  {Math.abs(health.accuracyTrend)}%
                </p>
              </div>
            </div>
            <svg className="absolute bottom-0 right-0 w-32 h-16 text-indigo-500/10" preserveAspectRatio="none" viewBox="0 0 100 100">
              <path fill="currentColor" d="M0 100 C 20 80, 40 90, 60 50 C 80 10, 100 20, 100 20 L 100 100 Z"/>
            </svg>
          </div>

          {/* DB */}
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${health.db === "ONLINE" ? "bg-sky-500/20 text-sky-400" : health.db === "CHECKING" ? "bg-slate-700 text-slate-400" : "bg-rose-500/20 text-rose-400"}`}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">PostgreSQL RDS</p>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${health.db === "ONLINE" ? "bg-sky-400" : "bg-rose-400"}`}/>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${health.db === "ONLINE" ? "bg-sky-500" : "bg-rose-500"}`}/>
                </span>
                <p className="text-xl font-black text-white">{health.db}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 3 — Login Traffic + Feedback Pie ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Hourly Login Traffic */}
          <div className="lg:col-span-2 bg-slate-800 p-5 rounded-2xl border border-slate-700/50">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-white">Hourly Login Traffic</h3>
                <p className="text-xs text-slate-400 mt-0.5">Real events from login_logs table · today</p>
              </div>
              {loading && <span className="text-xs text-slate-500 animate-pulse">Syncing…</span>}
            </div>
            <div className="h-56">
              {loading ? (
                <div className="h-full flex flex-col justify-end gap-2 pb-4">
                  {[40, 60, 30, 80, 55, 70, 45].map((h, i) => (
                    <div key={i} className="flex-1 flex items-end gap-1">
                      <Skeleton className={`w-full`} style={{ height: `${h}%` }}/>
                    </div>
                  ))}
                </div>
              ) : traffic.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={traffic} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155"/>
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={8}/>
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dx={-4} allowDecimals={false}/>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, color: "#fff", fontSize: 12 }}
                      labelStyle={{ color: "#94a3b8" }}
                      formatter={(v) => [v, "Logins"]}
                    />
                    <Line type="monotone" dataKey="logins" stroke="#6366f1" strokeWidth={3}
                      dot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: "#818cf8" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                  <p className="text-sm font-semibold">No logins recorded today yet</p>
                </div>
              )}
            </div>
          </div>

          {/* User Satisfaction Donut */}
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 flex flex-col">
            <div className="mb-3">
              <h3 className="font-black text-white">User Satisfaction</h3>
              <p className="text-xs text-slate-400 mt-0.5">Real feedback from users</p>
            </div>
            <div className="flex-1 flex items-center justify-center relative">
              {feedback.some((f) => f.value > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={feedback} innerRadius={55} outerRadius={75}
                        paddingAngle={4} dataKey="value" stroke="none">
                        {feedback.map((entry, i) => (
                          <Cell key={i} fill={entry.color}/>
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, fontSize: 12, color: "#fff" }}
                        formatter={(v, n) => [v, n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-white">{happyPct}%</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Happy</span>
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-500">
                  <span className="text-3xl mb-2 block">😶</span>
                  <p className="text-sm font-semibold">No feedback yet</p>
                </div>
              )}
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {feedback.map((f) => (
                <div key={f.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.color }}/>
                  <span className="text-xs font-bold text-slate-400">{f.name}</span>
                  <span className="text-xs text-slate-500">({f.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ROW 4 — Weekly Trend + Scan Breakdown ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Weekly Scan Trend */}
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50">
            <div className="mb-5">
              <h3 className="font-black text-white">Weekly Scan Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">Scans per day — last 7 days</p>
            </div>
            <div className="h-48">
              {weeklyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155"/>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }}/>
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false}/>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, fontSize: 12, color: "#fff" }}
                      formatter={(v) => [v, "Scans"]}
                    />
                    <Bar dataKey="scans" fill={WEEKLY_BAR_COLOR} radius={[6, 6, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">
                  <p className="text-sm font-semibold">No scan data in the last 7 days</p>
                </div>
              )}
            </div>
          </div>

          {/* Scan Result Breakdown */}
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50">
            <div className="mb-5">
              <h3 className="font-black text-white">Scan Result Breakdown</h3>
              <p className="text-xs text-slate-400 mt-0.5">All-time prediction distribution</p>
            </div>
            {breakdown.length > 0 ? (
              <div className="space-y-4 pt-2">
                {breakdown.map((item) => {
                  const total = breakdown.reduce((a, b) => a + b.count, 0);
                  const pct   = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  const color = BREAKDOWN_COLORS[item.name] ?? "#94a3b8";
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-bold text-slate-300">{item.name}</span>
                        <span className="font-black tabular-nums" style={{ color }}>
                          {item.count.toLocaleString()} <span className="text-slate-500 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-slate-500">
                <p className="text-sm font-semibold">No scans recorded yet</p>
              </div>
            )}
          </div>
        </div>

        {/* ── ROW 5 — Security Login Logs ── */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700/50 overflow-hidden">

          {/* Table header */}
          <div className="px-5 py-4 border-b border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/80">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              <h3 className="font-black text-white">Security Access Logs</h3>
              <Pill color="emerald">Live Sync</Pill>
            </div>
            <div className="flex gap-2">
              {/* Search */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search email or IP…"
                  className="bg-transparent text-sm text-slate-300 placeholder-slate-600 outline-none w-36 sm:w-48"
                />
              </div>
              {/* Method filter */}
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none"
              >
                {["All", "Email", "Google"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-700/60">
                  {["User Email", "Method", "IP Address", "Date & Time", "Status"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <Skeleton className="h-4 w-28"/>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredLogs.length > 0 ? (
                  filteredLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                      {/* Email */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-black text-slate-300 shrink-0">
                            {log.email[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-slate-200">{log.email}</span>
                        </div>
                      </td>
                      {/* Method badge */}
                      <td className="px-5 py-3.5">
                        <MethodBadge method={log.method}/>
                      </td>
                      {/* IP */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-slate-400">{log.ip}</span>
                      </td>
                      {/* Date & Time */}
                      <td className="px-5 py-3.5">
                        <span className="text-slate-300 font-medium">{log.date}</span>
                        <span className="text-slate-500 ml-2 text-xs font-mono">{log.time}</span>
                      </td>
                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <Pill color="emerald">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>
                          Success
                        </Pill>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-500">
                        <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        <p className="text-sm font-semibold">
                          {loginLogs.length === 0 ? "No login events recorded yet" : "No results match your search"}
                        </p>
                        <p className="text-xs">Logins are recorded each time a user signs in via email or Google</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          {!loading && filteredLogs.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredLogs.length} of {loginLogs.length} records</span>
              <span>Auto-refreshes every {REFRESH_INTERVAL}s</span>
            </div>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-3 flex items-center justify-between text-xs text-slate-600">
        <span>DermaScan Admin Console</span>
        <span>All data pulled live from AWS RDS PostgreSQL</span>
      </footer>
    </div>
  );
}