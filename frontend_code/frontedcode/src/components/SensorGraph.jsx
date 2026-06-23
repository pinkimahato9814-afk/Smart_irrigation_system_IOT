import React, { useEffect, useMemo, useState } from "react";
import { db } from "../lib/firebase";
import {
  ref,
  onValue,
  query,
  orderByChild,
  limitToLast,
} from "firebase/database";

export default function SensorGraph() {
  const [readings, setReadings] = useState([]);
  const [limit, setLimit] = useState("50");
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Detect mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    console.log("📊 [SensorGraph] Loading data...");

    const readingsRef = ref(db, "moisture_readings");
    const num = limit === "lifetime" ? 1000 : parseInt(limit, 10) || 50;
    const qRef = query(readingsRef, orderByChild("ts_epoch"), limitToLast(num));

    const unsub = onValue(qRef, (snap) => {
      const arr = [];
      snap.forEach((child) => {
        const v = child.val();
        if (v && typeof v.raw === "number" && typeof v.ts_epoch === "number") {
          arr.push({
            raw: v.raw,
            status: v.status,
            pump_on: v.pump_on,
            ts_epoch: v.ts_epoch,
            ts_iso: v.ts_iso,
          });
        }
      });
      arr.sort((a, b) => a.ts_epoch - b.ts_epoch);
      console.log("📊 [SensorGraph] Loaded", arr.length, "readings");
      setReadings(arr);
    });

    return () => unsub();
  }, [limit]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!readings.length) return null;
    const values = readings.map((r) => r.raw);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const current = readings[readings.length - 1]?.raw || 0;
    const pumpActivations = readings.filter((r) => r.pump_on).length;
    const pumpPercentage = Math.round(
      (pumpActivations / readings.length) * 100,
    );

    const firstTime = readings[0]?.ts_iso?.split(" ")[1] || "--:--";
    const lastTime =
      readings[readings.length - 1]?.ts_iso?.split(" ")[1] || "--:--";

    return {
      min,
      max,
      avg,
      current,
      pumpActivations,
      pumpPercentage,
      firstTime,
      lastTime,
      count: readings.length,
    };
  }, [readings]);

  // Responsive SVG dimensions
  const w = 900;
  const h = isMobile ? 280 : 220;
  const pad = {
    left: isMobile ? 45 : 55,
    top: isMobile ? 25 : 20,
    right: isMobile ? 15 : 20,
    bottom: isMobile ? 40 : 35,
  };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  // Responsive sizes - MOBILE: +10% line, +20% dots
  const lineWidth = isMobile ? 4.4 : 2;
  const dotRadius = isMobile ? 7.2 : 2.5;
  const dotRadiusHover = isMobile ? 12 : 5;
  const fontSize = isMobile ? 14 : 10;
  const gridWidth = isMobile ? 1.5 : 1;

  // Calculate axis bounds with padding
  const { minVal, maxVal } = useMemo(() => {
    if (!readings.length) return { minVal: 0, maxVal: 4095 };
    let min = Math.min(...readings.map((r) => r.raw));
    let max = Math.max(...readings.map((r) => r.raw));
    if (min === max) {
      min -= 100;
      max += 100;
    }
    const range = max - min;
    return {
      minVal: Math.max(0, min - range * 0.08),
      maxVal: Math.min(4095, max + range * 0.08),
    };
  }, [readings]);

  // Map readings to XY coordinates
  const points = useMemo(() => {
    if (!readings.length) return [];
    return readings.map((r, i) => {
      const x = pad.left + (i / Math.max(1, readings.length - 1)) * innerW;
      const norm = (r.raw - minVal) / (maxVal - minVal);
      const y = pad.top + (1 - norm) * innerH;
      return { x, y, ...r, index: i };
    });
  }, [readings, minVal, maxVal, innerW, innerH, pad]);

  // Status colors
  const getColor = (status) => {
    if (status === "RED") return "#f87171";
    if (status === "YELLOW") return "#fbbf24";
    return "#4ade80";
  };

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const ticks = [];
    const count = isMobile ? 3 : 4;
    for (let i = 0; i <= count; i++) {
      const val = Math.round(minVal + (i / count) * (maxVal - minVal));
      const y = pad.top + (1 - i / count) * innerH;
      ticks.push({ val, y });
    }
    return ticks;
  }, [minVal, maxVal, innerH, isMobile, pad]);

  // Line path
  const lineD = useMemo(() => {
    if (points.length < 2) return "";
    return (
      `M ${points[0].x} ${points[0].y} ` +
      points
        .slice(1)
        .map((p) => `L ${p.x} ${p.y}`)
        .join(" ")
    );
  }, [points]);

  // Area path
  const areaD = useMemo(() => {
    if (points.length < 2) return "";
    return (
      `M ${points[0].x} ${pad.top + innerH} L ${points[0].x} ${points[0].y} ` +
      points
        .slice(1)
        .map((p) => `L ${p.x} ${p.y}`)
        .join(" ") +
      ` L ${points[points.length - 1].x} ${pad.top + innerH} Z`
    );
  }, [points, innerH, pad]);

  return (
    <section
      className="card"
      style={{ padding: isMobile ? "1rem" : "1.25rem" }}
    >
      {/* Header with stats */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: isMobile ? "0.95rem" : "1rem",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            📈 Moisture Trend
          </h3>
          {stats && (
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                marginTop: "0.25rem",
              }}
            >
              {stats.count} readings • {stats.firstTime} → {stats.lastTime}
            </div>
          )}
        </div>

        <select
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-glass)",
            borderRadius: "8px",
            padding: isMobile ? "0.5rem 0.75rem" : "0.4rem 0.8rem",
            fontSize: isMobile ? "0.85rem" : "0.8rem",
            cursor: "pointer",
          }}
        >
          <option value="20">Last 20</option>
          <option value="50">Last 50</option>
          <option value="100">Last 100</option>
          <option value="200">Last 200</option>
          <option value="lifetime">All</option>
        </select>
      </div>

      {/* Stats bar */}
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "repeat(2, 1fr)"
              : "repeat(auto-fit, minmax(100px, 1fr))",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: "10px",
              padding: "0.5rem 0.6rem",
            }}
          >
            <div
              style={{
                fontSize: "0.6rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Current
            </div>
            <div
              style={{
                fontSize: isMobile ? "1rem" : "1.1rem",
                fontWeight: 600,
                color: "var(--accent-primary)",
              }}
            >
              {stats.current}
            </div>
          </div>
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: "10px",
              padding: "0.5rem 0.6rem",
            }}
          >
            <div
              style={{
                fontSize: "0.6rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Average
            </div>
            <div
              style={{
                fontSize: isMobile ? "1rem" : "1.1rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {stats.avg}
            </div>
          </div>
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: "10px",
              padding: "0.5rem 0.6rem",
            }}
          >
            <div
              style={{
                fontSize: "0.6rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Min / Max
            </div>
            <div
              style={{
                fontSize: isMobile ? "1rem" : "1.1rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {stats.min} / {stats.max}
            </div>
          </div>
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: "10px",
              padding: "0.5rem 0.6rem",
            }}
          >
            <div
              style={{
                fontSize: "0.6rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Pump Active
            </div>
            <div
              style={{
                fontSize: isMobile ? "1rem" : "1.1rem",
                fontWeight: 600,
                color:
                  stats.pumpPercentage > 50 ? "#f87171" : "var(--text-primary)",
              }}
            >
              {stats.pumpPercentage}%
            </div>
          </div>
        </div>
      )}

      {/* Graph */}
      {readings.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          📡 Waiting for sensor data...
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            width="100%"
            style={{ display: "block" }}
          >
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--accent-primary)"
                  stopOpacity="0.3"
                />
                <stop
                  offset="100%"
                  stopColor="var(--accent-primary)"
                  stopOpacity="0"
                />
              </linearGradient>
              <linearGradient id="lineColor" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {yTicks.map(({ y }, i) => (
              <line
                key={i}
                x1={pad.left}
                y1={y}
                x2={w - pad.right}
                y2={y}
                stroke="var(--graph-grid)"
                strokeWidth={gridWidth}
                opacity="0.5"
              />
            ))}

            {/* Y-axis labels */}
            {yTicks.map(({ val, y }, i) => (
              <text
                key={i}
                x={pad.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={fontSize}
                fontWeight="500"
                fill="var(--text-muted)"
              >
                {val}
              </text>
            ))}

            {/* Area fill */}
            <path d={areaD} fill="url(#areaFill)" />

            {/* Main line - THICKER on mobile */}
            <path
              d={lineD}
              fill="none"
              stroke="url(#lineColor)"
              strokeWidth={lineWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points - BIGGER on mobile */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={hoveredPoint === i ? dotRadiusHover : dotRadius}
                fill={getColor(p.status)}
                style={{ cursor: "pointer", transition: "r 0.15s" }}
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
                onTouchStart={() => setHoveredPoint(i)}
                onTouchEnd={() => setTimeout(() => setHoveredPoint(null), 1500)}
              />
            ))}

            {/* Hover tooltip */}
            {hoveredPoint !== null && points[hoveredPoint] && (
              <g
                transform={`translate(${Math.min(points[hoveredPoint].x, w - 60)}, ${Math.max(points[hoveredPoint].y - 15, 40)})`}
              >
                <rect
                  x="-50"
                  y="-32"
                  width="100"
                  height="28"
                  rx="6"
                  fill="var(--bg-card)"
                  stroke="var(--border-glass)"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="-14"
                  textAnchor="middle"
                  fontSize={isMobile ? 13 : 11}
                  fontWeight="600"
                  fill="var(--text-primary)"
                >
                  {points[hoveredPoint].raw} • {points[hoveredPoint].status}
                </text>
              </g>
            )}
          </svg>
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: isMobile ? "1rem" : "1.5rem",
          marginTop: "0.75rem",
          fontSize: isMobile ? "0.75rem" : "0.7rem",
          color: "var(--text-muted)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span
            style={{
              width: isMobile ? 10 : 8,
              height: isMobile ? 10 : 8,
              borderRadius: "50%",
              background: "#4ade80",
            }}
          ></span>
          Moist
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span
            style={{
              width: isMobile ? 10 : 8,
              height: isMobile ? 10 : 8,
              borderRadius: "50%",
              background: "#f87171",
            }}
          ></span>
          Dry (Pump)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span
            style={{
              width: isMobile ? 10 : 8,
              height: isMobile ? 10 : 8,
              borderRadius: "50%",
              background: "#fbbf24",
            }}
          ></span>
          Warning
        </span>
      </div>
    </section>
  );
}
