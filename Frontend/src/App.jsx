import { useState } from "react";
import LandingView from "./components/LandingView";
import UserDashboard from "./components/UserDashboard";
import AdminDashboard from "./components/AdminDashboard";

export default function App() {
  const [view, setView] = useState("landing");
  const [user, setUser] = useState(null);

  const navigateTo = (target, userData = null) => {
    setView(target);
    if (userData) setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    setView("landing");
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {view === "landing" && (
        <LandingView navigateTo={navigateTo} />
      )}
      {view === "user" && (
        <UserDashboard user={user} onLogout={handleLogout} />
      )}
      {view === "admin" && (
        <AdminDashboard onExit={handleLogout} />
      )}
    </div>
  );
}