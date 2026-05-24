import { useState, useEffect } from "react";
import LandingView from "./components/LandingView";
import UserDashboard from "./components/UserDashboard";
import AdminDashboard from "./components/AdminDashboard";

export default function App() {
  // Restore session from localStorage on every page load.
  // If the user was logged in and refreshes, they stay logged in.
  const [view, setView] = useState(() =>
    localStorage.getItem("isAuthenticated") === "true" ? "user" : "landing"
  );

  const [user, setUser] = useState(() => {
    const email = localStorage.getItem("userEmail");
    const name  = localStorage.getItem("userName");
    return email ? { email, name: name || email.split("@")[0] } : null;
  });

  // Keep isAuthenticated flag in sync whenever view changes to "user"
  useEffect(() => {
    if (view === "user") localStorage.setItem("isAuthenticated", "true");
  }, [view]);

  const navigateTo = (target, userData = null) => {
    setView(target);
    if (userData) {
      setUser(userData);
      localStorage.setItem("userEmail", userData.email);
      localStorage.setItem("userName",  userData.name || userData.email.split("@")[0]);
    }
  };

  // Wipe everything from localStorage so the next visitor can't auto-login
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