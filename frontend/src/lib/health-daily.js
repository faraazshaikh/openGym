// The daily numbers other apps save to the phone's health hub, for the calendar: steps, sleep and
// resting heart rate, from Health Connect on Android (Mi Fitness, Zepp, Google Fit and the rest
// write there). Pure: lib/health-sync.js reads the hub and hands the raw records over; this turns
// them into one number per day. Kept on this phone only (in the health file, never in the log),
// since it is a view of what the hub holds and can be read again.
//
//   - A day is the phone's own local day.
//   - Steps are counted on the day a record starts. Two apps often write the same steps (the
//     phone's own counter and a band), so the day takes the numbers of ONE app: the one with the
//     most, never the sum of both.
//   - Sleep belongs to the day you wake up, and counts time asleep only: with stages, light, deep,
//     REM and plain "sleeping"; awake time in bed is left out. Without stages, the whole session.
//     As with steps, one app's sleep per day: the longest.
//   - Resting heart rate is the day's last reading, from the app with the most readings.
import { isoOf } from './format.js'

// Health Connect's SleepSessionRecord stage types that are sleep: sleeping, light, deep, REM.
const ASLEEP = new Set([2, 4, 5, 6])
const STEPS_MAX = 200000          // a day beyond this is a faulty record, not a walk
const SLEEP_MAX_MIN = 20 * 60     // a session longer than this is a faulty record
const BPM_MIN = 25, BPM_MAX = 250
export const KEEP_DAYS = 90

const dayOf = ms => isoOf(new Date(ms))
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : NaN }

// The origin with the biggest total: { [origin]: total } -> the total, or 0 for none.
const best = totals => Object.values(totals).reduce((m, v) => Math.max(m, v), 0)

/**
 * One number per day from a raw read: `raw` is { steps, sleep, rhr } as the native plugin
 * answers (lib: health-sync.js readDaily). Days before `fromDay` ('YYYY-MM-DD') are left out, as
 * a read that starts mid-day would hold only part of them. Returns { [day]: { steps?, sleep?, rhr? } },
 * sleep in minutes. A metric with no valid record that day is missing, not zero.
 */
export function dailyFromHub(raw, { fromDay = '' } = {}) {
  const out = {}
  const put = (day, key, value) => { if (day >= fromDay) (out[day] = out[day] || {})[key] = value }

  const steps = {}       // day -> origin -> steps
  for (const r of Array.isArray(raw?.steps) ? raw.steps : []) {
    const [s, e, n, o] = Array.isArray(r) ? r.map(num) : []
    if (!(s > 0) || !(e >= s) || !(n > 0) || n > STEPS_MAX) continue
    const d = dayOf(s), by = steps[d] = steps[d] || {}
    by[o] = (by[o] || 0) + n
  }
  for (const [d, by] of Object.entries(steps)) { const v = best(by); if (v > 0 && v <= STEPS_MAX) put(d, 'steps', Math.round(v)) }

  const sleep = {}       // wake-up day -> origin -> minutes
  for (const r of Array.isArray(raw?.sleep) ? raw.sleep : []) {
    const s = num(r?.s), e = num(r?.e), o = num(r?.o)
    if (!(s > 0) || !(e > s) || (e - s) / 60000 > SLEEP_MAX_MIN) continue
    const stages = Array.isArray(r.st) ? r.st : []
    let ms = e - s
    if (stages.length) {
      ms = 0
      for (const g of stages) {
        const [gs, ge, type] = Array.isArray(g) ? g.map(num) : []
        if (ge > gs && ASLEEP.has(type)) ms += Math.min(ge, e) - Math.max(gs, s)
      }
    }
    const min = Math.round(ms / 60000)
    if (!(min > 0)) continue
    const d = dayOf(e), by = sleep[d] = sleep[d] || {}
    by[o] = (by[o] || 0) + min
  }
  for (const [d, by] of Object.entries(sleep)) { const v = best(by); if (v > 0) put(d, 'sleep', v) }

  const rhr = {}         // day -> origin -> [{ t, bpm }]
  for (const r of Array.isArray(raw?.rhr) ? raw.rhr : []) {
    const [t, bpm, o] = Array.isArray(r) ? r.map(num) : []
    if (!(t > 0) || !(bpm >= BPM_MIN && bpm <= BPM_MAX)) continue
    const d = dayOf(t), by = rhr[d] = rhr[d] || {}
    ;(by[o] = by[o] || []).push({ t, bpm })
  }
  for (const [d, by] of Object.entries(rhr)) {
    const list = Object.values(by).sort((a, b) => b.length - a.length)[0] || []
    const last = list.reduce((m, x) => (!m || x.t > m.t ? x : m), null)
    if (last) put(d, 'rhr', Math.round(last.bpm))
  }
  return out
}

/** The first day a read starting `daysBack` days ago can hold whole: its own midnight, local. */
export function firstFullDay(now, daysBack) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysBack)
  return isoOf(d)
}

/** Where a read for `fromDay` starts: half a day earlier, so a night that began the evening before still counts. */
export function readSince(fromDay) {
  return new Date(fromDay + 'T00:00:00').getTime() - 12 * 3600e3
}

/**
 * The days read now put over the days kept: a day that came in replaces the kept one (the read
 * recounts it whole), older days stay, and days beyond `keep` back from `now` are dropped.
 */
export function mergeDaily(kept, fresh, { now = Date.now(), keep = KEEP_DAYS } = {}) {
  const cut = firstFullDay(now, keep)
  const out = {}
  for (const [d, v] of Object.entries({ ...(kept || {}), ...(fresh || {}) })) {
    if (d >= cut && v && typeof v === 'object') out[d] = v
  }
  return out
}

/** Averages over the days of a month (`mo` 0-11) that have each number: { steps, sleep, rhr, days }, a metric `null` with none. */
export function monthSummary(daily, y, mo) {
  const prefix = y + '-' + String(mo + 1).padStart(2, '0') + '-'
  const rows = Object.entries(daily || {}).filter(([d]) => d.startsWith(prefix)).map(([, v]) => v)
  const avg = key => {
    const xs = rows.map(r => r?.[key]).filter(v => Number.isFinite(v) && v > 0)
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null
  }
  return { steps: avg('steps'), sleep: avg('sleep'), rhr: avg('rhr'), days: rows.length }
}
