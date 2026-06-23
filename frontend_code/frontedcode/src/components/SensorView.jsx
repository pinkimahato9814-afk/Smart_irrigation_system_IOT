import React, { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import {
  ref,
  onValue,
  query,
  orderByChild,
  limitToLast,
} from "firebase/database";

export default function SensorView() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    console.log("🌱 [SensorView] Setting up listener...");

    const readingsRef = ref(db, "moisture_readings");

    // Get last 10 readings for trend
    const q = query(readingsRef, orderByChild("ts_epoch"), limitToLast(10));

    const unsubscribe = onValue(
      q,
      (snap) => {
        if (!snap.exists()) {
          setStatus("No data available");
          return;
        }

        const arr = [];
        snap.forEach((child) => {
          arr.push(child.val());
        });
        arr.sort((a, b) => a.ts_epoch - b.ts_epoch);

        if (arr.length > 0) {
          setLatest(arr[arr.length - 1]);
          setHistory(arr);
          setStatus("Connected");
        }
      },
      (error) => {
        console.error("❌ [SensorView]", error);
        setStatus("Error");
      },
    );

    return () => unsubscribe();
  }, []);

  // Calculate trend
  const trend = React.useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0].raw;
    const last = history[history.length - 1].raw;
    const diff = last - first;
    if (Math.abs(diff) < 50)
      return { dir: "stable", icon: "→", color: "var(--text-muted)" };
    if (diff > 0) return { dir: "drying", icon: "↑", color: "#f87171" };
    return { dir: "wetting", icon: "↓", color: "#4ade80" };
  }, [history]);

  if (!latest) {
    return (
      <section className="card compact">
        <h2>🌱 Soil Sensor</h2>
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          {status}
        </div>
      </section>
    );
  }

  const { raw, status: sensorStatus, ts_iso, ts_epoch, pump_on } = latest;
  const percentage = Math.round((raw / 4095) * 100);

  // Status config
  const statusConfig = {
    GREEN: {
      class: "green",
      icon: "💧",
      label: "Optimal",
      desc: "Moisture level is good",
    },
    RED: { class: "red", icon: "🔥", label: "Dry", desc: "Needs water" },
    YELLOW: {
      class: "yellow",
      icon: "⚠️",
      label: "Warning",
      desc: "Check sensor",
    },
  };
  const config = statusConfig[sensorStatus] || statusConfig.GREEN;

  return (
    <section className="card compact">
      <h2>🌱 Soil Sensor</h2>

      <div className={`status-panel ${config.class}`}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ fontSize: "2rem" }}>{config.icon}</div>
            <div
              style={{
                fontSize: "1.3rem",
                fontWeight: 700,
                marginTop: "0.25rem",
              }}
            >
              {config.label}
            </div>
            <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
              {config.desc}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700 }}>
              {percentage}%
            </div>
            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>Raw: {raw}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginTop: "1rem",
            height: "6px",
            background: "rgba(255,255,255,0.2)",
            borderRadius: "3px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${100 - percentage}%`,
              height: "100%",
              background: "rgba(255,255,255,0.8)",
              borderRadius: "3px",
              transition: "width 0.5s",
            }}
          ></div>
        </div>

        {/* Details grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
            marginTop: "1rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.65rem",
                opacity: 0.7,
                textTransform: "uppercase",
              }}
            >
              Pump
            </div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              {pump_on ? "🟢 Active" : "⚪ Idle"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: "0.65rem",
                opacity: 0.7,
                textTransform: "uppercase",
              }}
            >
              Trend
            </div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              {trend ? (
                <span style={{ color: trend.color }}>
                  {trend.icon} {trend.dir}
                </span>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div
              style={{
                fontSize: "0.65rem",
                opacity: 0.7,
                textTransform: "uppercase",
              }}
            >
              Updated
            </div>
            <div style={{ fontSize: "0.85rem" }}>
              {ts_iso || new Date(ts_epoch * 1000).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
