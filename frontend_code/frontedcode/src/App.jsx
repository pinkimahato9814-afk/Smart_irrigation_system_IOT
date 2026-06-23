import React, { useEffect, useRef, useState } from "react";
import SensorView from "./components/SensorView.jsx";
import MotorStatus from "./components/MotorStatus.jsx";
import SensorGraph from "./components/SensorGraph.jsx";
import { db } from "./lib/firebase";
import {
  ref,
  onValue,
  query,
  orderByChild,
  limitToLast,
} from "firebase/database";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch (_) {}
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches)
      return "dark";
    return "light";
  });

  // Detect mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch (_) {}
  }, [theme]);

  // Online indicator
  const [online, setOnline] = useState(false);
  const lastSeenRef = useRef(0);
  const serverOffsetRef = useRef(0);

  useEffect(() => {
    console.log("🟢 [App] Setting up connection monitor...");

    const offRef = ref(db, ".info/serverTimeOffset");
    const unsubOff = onValue(offRef, (snap) => {
      const off = snap.val();
      if (typeof off === "number") serverOffsetRef.current = off;
    });

    const q = query(
      ref(db, "moisture_readings"),
      orderByChild("ts_epoch"),
      limitToLast(1),
    );
    const unsub = onValue(q, (snap) => {
      let reading = null;
      snap.forEach((c) => {
        reading = c.val();
      });

      const ts = reading?.ts_epoch ? reading.ts_epoch * 1000 : null;
      if (ts) {
        lastSeenRef.current = ts;
        const serverNow = Date.now() + serverOffsetRef.current;
        setOnline(serverNow - ts < 5000);
      }
    });

    const interval = setInterval(() => {
      const serverNow = Date.now() + serverOffsetRef.current;
      setOnline(serverNow - lastSeenRef.current < 5000);
    }, 1000);

    return () => {
      clearInterval(interval);
      unsub();
      unsubOff();
    };
  }, []);

  return (
    <div className="app-shell">
      <header
        className="app-header"
        style={isMobile ? { padding: "0.6rem 1rem" } : undefined}
      >
        <h1 style={isMobile ? { fontSize: "1.1rem" } : undefined}>
          {isMobile ? "🌿 SIS" : "🌿 Smart Watering System"}
          <span
            className={online ? "status-dot online" : "status-dot offline"}
            title={online ? "ESP32 Online" : "ESP32 Offline"}
          />
        </h1>

        <div className="header-right" ref={profileRef}>
          <button
            type="button"
            className="theme-toggle"
            role="switch"
            aria-checked={theme === "dark"}
            aria-label="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            style={isMobile ? { width: "48px", height: "24px" } : undefined}
          >
            <span className="switch-track" />
            <span
              className="switch-thumb"
              style={
                isMobile
                  ? { width: "16px", height: "16px", top: "2px", left: "2px" }
                  : undefined
              }
            />
          </button>

          <button
            type="button"
            className="profile-button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            style={
              isMobile
                ? { width: "36px", height: "36px", borderRadius: "12px" }
                : undefined
            }
          >
            <span
              className="profile-avatar"
              style={isMobile ? { fontSize: "1rem" } : undefined}
            >
              👤
            </span>
          </button>

          {menuOpen && (
            <div className="profile-menu" role="menu">
              <button className="menu-item" onClick={() => setMenuOpen(false)}>
                👤 Profile
              </button>
              <button className="menu-item" onClick={() => setMenuOpen(false)}>
                ⚙️ Settings
              </button>
              <button className="menu-item" onClick={() => setMenuOpen(false)}>
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main
        className="app-main"
        style={isMobile ? { padding: "0.75rem" } : undefined}
      >
        <div className="main-grid">
          {/* Full width graph */}
          <div style={{ gridColumn: "1 / -1" }}>
            <SensorGraph />
          </div>

          {/* Status cards side by side */}
          <SensorView />
          <MotorStatus />
        </div>
      </main>

      <footer
        className="app-footer"
        style={isMobile ? { padding: "1rem", fontSize: "0.75rem" } : undefined}
      >
        <span>🌱 {isMobile ? "SIS" : "Smart Irrigation System"}</span>
        <span style={{ margin: "0 0.5rem" }}>•</span>
        <span>ESP32 + Firebase</span>
        <span style={{ margin: "0 0.5rem" }}>•</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
