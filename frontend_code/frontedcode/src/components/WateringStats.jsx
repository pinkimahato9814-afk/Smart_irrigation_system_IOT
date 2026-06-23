import React, { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/firebase'
import { ref, onValue, query, orderByChild, startAt } from 'firebase/database'

const DEVICE_ID = 'esp32-01' // must match ESP32

// Thresholds for detecting watering events
// Moisture scale: higher value = drier, lower value = wetter (per firmware)
// Detect a watering when either:
//  - the reading falls sharply by >= DELTA_TRIGGER between consecutive samples, or
//  - the status transitions from dry/no_probe -> moist
const DRY_HIGH = 3000
const MOIST_LOW = 2000
const DELTA_TRIGGER = 500 // counts as watering if prev - curr >= 500
const EVENT_GAP_MS = 2 * 60 * 1000 // minimum gap between events to avoid double counting (2 minutes)

function startOfDayTs(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function startOfWeekTs(d = new Date()) {
  const x = new Date(d)
  const day = x.getDay() // 0=Sun..6=Sat
  const diff = (day + 6) % 7 // make Monday=0
  x.setDate(x.getDate() - diff)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function startOfMonthTs(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

export default function WateringStats() {
  const [readings, setReadings] = useState([])

  useEffect(() => {
    // Subscribe starting from earliest window (week vs month)
    const since = Math.min(startOfWeekTs(), startOfMonthTs())
    const r = query(ref(db, `devices/${DEVICE_ID}/readings`), orderByChild('ts'), startAt(since))
    const unsub = onValue(r, (snap) => {
      const arr = []
      snap.forEach((c) => { const v = c.val(); if (v && typeof v.ts === 'number') arr.push(v) })
      arr.sort((a, b) => a.ts - b.ts)
      setReadings(arr)
    })
    return () => unsub()
  }, [])

  const { dayCount, weekCount, monthCount } = useMemo(() => {
    const now = new Date()
    const sDay = startOfDayTs(now)
    const sWeek = startOfWeekTs(now)
    const sMonth = startOfMonthTs(now)

    // Count watering events (possibly multiple per day) using delta and status transition
    let prev = null
    let lastEventTs = -Infinity
    const events = [] // push timestamps of detected waterings

    for (const r of readings) {
      if (!r || typeof r.ts !== 'number') continue
      const t = r.ts
      const m = typeof r.moisture === 'number' ? r.moisture : null
      const s = typeof r.status === 'string' ? r.status : null
      if (prev && m !== null) {
        const pm = typeof prev.moisture === 'number' ? prev.moisture : null
        const ps = typeof prev.status === 'string' ? prev.status : null
        const fellSharply = pm !== null && (pm - m) >= DELTA_TRIGGER
        const statusImproved = (ps === 'dry' || ps === 'no_probe') && s === 'moist'

        if ((fellSharply || statusImproved) && (t - lastEventTs >= EVENT_GAP_MS)) {
          events.push(t)
          lastEventTs = t
        }
      }
      prev = r
    }

    const day = events.filter((t) => t >= sDay).length
    const week = events.filter((t) => t >= sWeek).length
    const month = events.filter((t) => t >= sMonth).length

    return { dayCount: day, weekCount: week, monthCount: month }
  }, [readings])

  return (
    <section className="card compact smaller" aria-label="Watering statistics">
      <h2>Watering Stats</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--panel-alt)', borderRadius: 10, padding: 9, border: '1px solid var(--border)' }}>
          <div className="muted">Today</div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{dayCount}</div>
        </div>
        <div style={{ background: 'var(--panel-alt)', borderRadius: 10, padding: 9, border: '1px solid var(--border)' }}>
          <div className="muted">This Week</div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{weekCount}</div>
        </div>
        <div style={{ background: 'var(--panel-alt)', borderRadius: 10, padding: 9, border: '1px solid var(--border)' }}>
          <div className="muted">This Month</div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{monthCount}</div>
        </div>
      </div>
    </section>
  )
}

