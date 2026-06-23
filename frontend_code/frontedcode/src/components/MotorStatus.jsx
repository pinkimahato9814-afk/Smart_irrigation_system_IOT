import React, { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import {
  ref,
  onValue,
  query,
  orderByChild,
  limitToLast,
} from "firebase/database";

export default function MotorStatus() {
  const [pumpOn, setPumpOn] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [pumpHistory, setPumpHistory] = useState({ total: 0, active: 0 });

  useEffect(() => {
    console.log("🔧 [MotorStatus] Setting up listener...");

    const readingsRef = ref(db, "moisture_readings");

    // Get last 50 readings to calculate pump usage stats
    const q = query(readingsRef, orderByChild("ts_epoch"), limitToLast(50));

    const unsubscribe = onValue(q, (snap) => {
      if (!snap.exists()) return;

      const arr = [];
      snap.forEach((child) => {
        arr.push(child.val());
      });
      arr.sort((a, b) => a.ts_epoch - b.ts_epoch);

      if (arr.length > 0) {
        const latest = arr[arr.length - 1];
        setPumpOn(latest.pump_on);
        setLastUpdate(
          latest.ts_iso || new Date(latest.ts_epoch * 1000).toLocaleString(),
        );

        // Calculate pump usage
        const activeCount = arr.filter((r) => r.pump_on).length;
        setPumpHistory({ total: arr.length, active: activeCount });
      }
    });

    return () => unsubscribe();
  }, []);

  const isOn = pumpOn === true;
  const panelClass = pumpOn === null ? "gray" : isOn ? "blue" : "gray";
  const usagePercent =
    pumpHistory.total > 0
      ? Math.round((pumpHistory.active / pumpHistory.total) * 100)
      : 0;

  return (
    <section className="card compact">
      <h2>💧 Water Pump</h2>

      <div className={`status-panel ${panelClass}`}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ fontSize: "2rem" }}>{isOn ? "🌊" : "⏸️"}</div>
            <div
              style={{
                fontSize: "1.3rem",
                fontWeight: 700,
                marginTop: "0.25rem",
              }}
            >
              {pumpOn === null ? "Loading" : isOn ? "RUNNING" : "STANDBY"}
            </div>
            <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
              {isOn ? "Watering in progress" : "Ready when needed"}
            </div>
          </div>

          {isOn && (
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#fff",
                animation: "pulse-online 1s infinite",
              }}
            ></div>
          )}
        </div>

        {/* Usage stats */}
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
              Usage (50 readings)
            </div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              {usagePercent}% active
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
              Activations
            </div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              {pumpHistory.active} / {pumpHistory.total}
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
              Last Update
            </div>
            <div style={{ fontSize: "0.85rem" }}>{lastUpdate || "—"}</div>
          </div>
        </div>

        {/* Usage bar */}
        <div style={{ marginTop: "0.75rem" }}>
          <div
            style={{
              height: "4px",
              background: "rgba(255,255,255,0.2)",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${usagePercent}%`,
                height: "100%",
                background:
                  usagePercent > 60 ? "#fbbf24" : "rgba(255,255,255,0.7)",
                borderRadius: "2px",
                transition: "width 0.5s",
              }}
            ></div>
          </div>
          <div
            style={{
              fontSize: "0.6rem",
              opacity: 0.6,
              marginTop: "0.25rem",
              textAlign: "center",
            }}
          >
            {usagePercent > 60
              ? "⚠️ High pump usage"
              : usagePercent > 30
                ? "Normal usage"
                : "Low usage"}
          </div>
        </div>
      </div>
    </section>
  );
}
