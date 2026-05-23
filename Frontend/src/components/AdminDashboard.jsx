import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || "https://skincancerdetector-vwlq.onrender.com";

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN LOGIN GATE
// ─────────────────────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError("");

  try {
    // 1. Send the typed passkey to your backend server
    const response = await axios.post(`${API_BASE}/admin/login`, { 
      passkey: passkey 
    });

    // 2. If the backend verifies it against the .env file, log in!
    if (response.data.success) {
      onLogin();
    } else {
      setError("Invalid administrative passkey.");
      setPasskey("");
    }
  } catch (err) {
    // 3. Catch invalid password or network errors gracefully
    setError(err.response?.data?.detail || "Authentication failed. Please try again.");
    setPasskey("");
  } finally {
    setLoading(false);
  }
};
  

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl">
        <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/30">
          <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        </div>
        <h2 className="text-2xl font-black text-white text-center mb-2">System Admin</h2>
        <p className="text-slate-400 text-sm text-center mb-8 font-medium">Command Center Authentication</p>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <input
            type="password"
            value={passkey}
            onChange={(e) => setPasskey(e.target.value)}
            placeholder="Enter Master Passkey..."
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3.5 focus:outline-none focus:border-indigo-500"
          />
          {error && <p className="text-rose-400 text-xs font-bold text-center">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-black rounded-xl py-3.5 transition-colors flex justify-center items-center">
            {loading ? <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : "Access Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard({ onExit }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Real State Variables
  const [systemHealth, setSystemHealth] = useState({ s3: "CHECKING", db: "CHECKING", modelAccuracy: 0, accuracyTrend: 0 });
  const [trafficData, setTrafficData] = useState([]);
  const [feedbackData, setFeedbackData] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);

  // Fetch all dashboard data from the FastAPI backend
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // ⚠️ Make sure this endpoint exists in your FastAPI backend!
      const res = await axios.get(`${API_BASE}/admin/dashboard-stats`);
      
      setSystemHealth(res.data.health || { s3: "ERROR", db: "ERROR", modelAccuracy: 0, accuracyTrend: 0 });
      setTrafficData(res.data.traffic || []);
      
      // Add colors to feedback data dynamically for the pie chart
      const coloredFeedback = (res.data.feedback || []).map(f => {
        if (f.name === 'Happy') return { ...f, color: '#10b981' };
        if (f.name === 'Neutral') return { ...f, color: '#f59e0b' };
        if (f.name === 'Sad') return { ...f, color: '#f43f5e' };
        return { ...f, color: '#94a3b8' };
      });
      setFeedbackData(coloredFeedback);
      
      setLoginLogs(res.data.logs || []);
    } catch (err) {
      console.error("Failed to fetch real admin stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
      // Optional: Auto-refresh data every 60 seconds
      const interval = setInterval(fetchDashboardData, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchDashboardData]);

  if (!isAuthenticated) {
    return <AdminLogin onLogin={() => setIsAuthenticated(true)} />;
  }

  // Calculate total feedback for percentage display
  const totalFeedback = feedbackData.reduce((acc, curr) => acc + curr.value, 0);
  const happyFeedback = feedbackData.find(f => f.name === 'Happy')?.value || 0;
  const happyPercentage = totalFeedback > 0 ? Math.round((happyFeedback / totalFeedback) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* ── Admin Header ── */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
          </div>
          <h1 className="font-black text-sm tracking-wide">DermaScan <span className="text-indigo-400">COMMAND CENTER</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={fetchDashboardData} className="text-slate-400 hover:text-white transition-colors">
             <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button onClick={onExit} className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 transition-colors">
            Exit Command
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 overflow-y-auto">
        
        {/* ── ROW 1: System Health Monitors ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* AWS S3 Status */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${systemHealth.s3 === 'ONLINE' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">AWS S3 Bucket</p>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3"><span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${systemHealth.s3 === 'ONLINE' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span><span className={`relative inline-flex rounded-full h-3 w-3 ${systemHealth.s3 === 'ONLINE' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span></span>
                <p className="text-xl font-black text-slate-800">{systemHealth.s3}</p>
              </div>
            </div>
          </div>

          {/* Model Accuracy */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0 relative z-10">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            </div>
            <div className="relative z-10">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">CNN Accuracy</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-black text-slate-800">{systemHealth.modelAccuracy}%</p>
                <p className={`text-xs font-bold mb-1 flex items-center ${systemHealth.accuracyTrend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {systemHealth.accuracyTrend >= 0 ? (
                    <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                  ) : (
                    <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                  )}
                  {Math.abs(systemHealth.accuracyTrend)}%
                </p>
              </div>
            </div>
            <svg className="absolute bottom-0 right-0 w-32 h-16 text-indigo-100 opacity-50" preserveAspectRatio="none" viewBox="0 0 100 100"><path fill="currentColor" d="M0 100 C 20 80, 40 90, 60 50 C 80 10, 100 20, 100 20 L 100 100 Z" /></svg>
          </div>

          {/* Database Status */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${systemHealth.db === 'ONLINE' ? 'bg-sky-50 text-sky-500' : 'bg-rose-50 text-rose-500'}`}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">MySQL Database</p>
              <div className="flex items-center gap-2">
                 <span className="relative flex h-3 w-3"><span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${systemHealth.db === 'ONLINE' ? 'bg-sky-400' : 'bg-rose-400'}`}></span><span className={`relative inline-flex rounded-full h-3 w-3 ${systemHealth.db === 'ONLINE' ? 'bg-sky-500' : 'bg-rose-500'}`}></span></span>
                 <p className="text-xl font-black text-slate-800">{systemHealth.db}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 2: Graphs & Analytics ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Active Users Graph */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2">
              User Logins (Today)
              {loading && <span className="text-xs font-normal text-slate-400 animate-pulse">Syncing...</span>}
            </h3>
            <div className="h-64 w-full">
              {trafficData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dx={-10} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Line type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">No traffic data available.</div>
              )}
            </div>
          </div>

          {/* Feedback Pie Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="font-black text-slate-800 mb-2">User Satisfaction</h3>
            <div className="flex-1 flex items-center justify-center relative">
              {feedbackData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={feedbackData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                        {feedbackData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-800">{happyPercentage}%</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Happy</span>
                  </div>
                </>
              ) : (
                <div className="text-slate-400 font-medium">No feedback yet.</div>
              )}
            </div>
            {feedbackData.length > 0 && (
              <div className="flex justify-center gap-4 mt-2">
                {feedbackData.map(item => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs font-bold text-slate-500">{item.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── ROW 3: Security & Login Logs ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
              Security Access Logs
            </h3>
            <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded-md">Live Sync</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-400 text-xs uppercase tracking-wider">User / Email</th>
                  <th className="px-6 py-4 font-bold text-slate-400 text-xs uppercase tracking-wider">IP Address</th>
                  <th className="px-6 py-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loginLogs.length > 0 ? (
                  loginLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700">{log.email}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{log.ip}</td>
                      <td className="px-6 py-4">
                        <span className="text-slate-800 font-medium">{log.date}</span>
                        <span className="text-slate-400 ml-2 text-xs">{log.time}</span>
                      </td>
                      <td className="px-6 py-4">
                        {log.status === "Success" ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">Success</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-700">Failed Attempt</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-10 text-center text-slate-400">
                      {loading ? "Fetching secure logs..." : "No security logs recorded yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}