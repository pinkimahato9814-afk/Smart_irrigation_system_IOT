import React, { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/firebase'
import { ref, onValue, query, orderByChild, startAt } from 'firebase/database'

const DEVICE_ID = 'esp32-01'

function startOfWeekTs(d = new Date()) {
  const x = new Date(d)
  const day = x.getDay()
  const diff = (day + 6) % 7
  x.setDate(x.getDate() - diff)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function startOfMonthTs(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function human(ms) {
  if (!ms || ms < 1000) return '0s'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const mm = m % 60, ss = s % 60, hh = h % 24
  if (d > 0) return `${d}d ${hh}h`
  if (h > 0) return `${h}h ${mm}m`
  if (m > 0) return `${m}m ${ss}s`
  return `${s}s`
}

export default function EventDurations() {
  const [readings, setReadings] = useState([])

  useEffect(() => {
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

  const { longestDryMs, longestNoProbeMs, lastWateringAt } = useMemo(() => {
    let longestDry = 0
    let longestNo = 0
    let lastWaterTs = null
    let runStatus = null
    let runStartTs = null
    let prev = null

    const DELTA_TRIGGER = 500
    const EVENT_GAP_MS = 2 * 60 * 1000
    let lastEventTs = -Infinity

    for (const r of readings) {
      const s = r.status
      const t = r.ts
      if (runStatus == null) { runStatus = s; runStartTs = t }
      if (s !== runStatus) {
        const dur = t - runStartTs
        if (runStatus === 'dry' && dur > longestDry) longestDry = dur
        if (runStatus === 'no_probe' && dur > longestNo) longestNo = dur
        runStatus = s
        runStartTs = t
      }

      // watering event detection (sharp drop or status improve)
      if (prev) {
        const pm = typeof prev.moisture === 'number' ? prev.moisture : null
        const m = typeof r.moisture === 'number' ? r.moisture : null
        const ps = prev.status
        const fellSharply = pm !== null && m !== null && (pm - m) >= DELTA_TRIGGER
        const statusImproved = (ps === 'dry' || ps === 'no_probe') && s === 'moist'
        if ((fellSharply || statusImproved) && (t - lastEventTs >= EVENT_GAP_MS)) {
          lastWaterTs = t
          lastEventTs = t
        }
      }
      prev = r
    }
    // Close the last run using last ts if available
    const lastTs = readings.length ? readings[readings.length - 1].ts : null
    if (lastTs && runStartTs && runStatus) {
      const dur = lastTs - runStartTs
      if (runStatus === 'dry' && dur > longestDry) longestDry = dur
      if (runStatus === 'no_probe' && dur > longestNo) longestNo = dur
    }
    return { longestDryMs: longestDry, longestNoProbeMs: longestNo, lastWateringAt: lastWaterTs }
  }, [readings])

  return (
    <section className="card compact smaller" aria-label="Event durations">
      <h2>Durations & Last Watering</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--panel-alt)', borderRadius: 10, padding: 9, border: '1px solid var(--border)' }}>
          <div className="muted">Largest Dry Time</div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{human(longestDryMs)}</div>
        </div>
        <div style={{ background: 'var(--panel-alt)', borderRadius: 10, padding: 9, border: '1px solid var(--border)' }}>
          <div className="muted">Longest Probe Undipped</div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{human(longestNoProbeMs)}</div>
        </div>
        <div style={{ background: 'var(--panel-alt)', borderRadius: 10, padding: 9, border: '1px solid var(--border)' }}>
          <div className="muted">Last Watering</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{lastWateringAt ? new Date(lastWateringAt).toLocaleString() : '-'}</div>
        </div>
      </div>
    </section>
  )
}
