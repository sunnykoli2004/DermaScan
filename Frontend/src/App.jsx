import { useState } from "react";
import LandingView from "./components/LandingView";
import UserDashboard from "./components/UserDashboard";
import AdminDashboard from "./components/AdminDashboard";

export default function App() {

  // ── Restore session from localStorage on every page load ──────────────────
  // If the user was already logged in and refreshes the page, they stay logged
  // in instead of being sent back to the landing page.
  const [view, setView] = useState(() => {
    return localStorage.getItem("isAuthenticated") === "true" ? "user" : "landing";
  });

  const [user, setUser] = useState(() => {
    const email = localStorage.getItem("userEmail");
    const name  = localStorage.getItem("userName");
    return email ? { email, name: name || email.split("@")[0] } : null;
  });

  const navigateTo = (target, userData = null) => {
    setView(target);
    if (userData) setUser(userData);
  };

  // ── Logout clears everything from localStorage ────────────────────────────
  // Without this, localStorage keeps stale data and the next visitor of the
  // device is auto-logged-in as the previous user.
  const handleLogout = () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("isAuthenticated");
    setUser(null);
    setView("landing");
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {view === "landing" && <LandingView navigateTo={navigateTo} />}
      {view === "user"    && <UserDashboard user={user} onLogout={handleLogout} />}
      {view === "admin"   && <AdminDashboard onExit={handleLogout} />}
    </div>
  );
}