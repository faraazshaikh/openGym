// What the home screen's rings and health cards show for one day, from the log and the daily
// numbers read from the phone's health hub (lib/health-daily.js). Pure: no store, no clock.

export const STEPS_GOAL = 10000
export const SLEEP_GOAL_MIN = 480      // 8 h
export const WORKOUT_GOAL_MIN = 45

// A single session longer than this is a forgotten timer, not training.
const SESSION_MAX_MIN = 6 * 60

/** How full a ring is, 0 to 1: `value` against `goal`. No value, or no goal, is empty. */
export function ringFill(value, goal) {
  const v = Number(value), g = Number(goal)
  if (!(v > 0) || !(g > 0)) return 0
  return Math.min(1, v / g)
}

/** Minutes trained on `day` ('YYYY-MM-DD'): the logged sessions with a start and an end. */
export function workoutMinutesOn(S, day) {
  let total = 0
  for (const w of Array.isArray(S?.workouts) ? S.workouts : []) {
    if (!w || w.d !== day) continue
    const start = Number(w.start), end = Number(w.end)
    if (!(start > 0) || !(end > start)) continue
    total += Math.min((end - start) / 60000, SESSION_MAX_MIN)
  }
  return Math.round(total)
}

/** The latest day on or before `day` that has `key`, as { day, value }, looking back `limit` days. */
function latest(daily, key, day, limit = 14) {
  const days = Object.keys(daily || {}).filter(d => d <= day && daily[d]?.[key] != null).sort().reverse()
  const d = days[0]
  if (d == null) return null
  const gap = (Date.parse(day + 'T00:00:00Z') - Date.parse(d + 'T00:00:00Z')) / 864e5
  return gap <= limit ? { day: d, value: daily[d][key], est: !!daily[d].rhrEst } : null
}

/**
 * The home screen's numbers for `day`. `daily` is null while the health read is off (or on the
 * web): `connected` is then false and the screen offers to connect. Rings: steps, sleep and
 * workout minutes, each with its value, goal and fill.
 */
export function homeToday(S, daily, day) {
  const connected = daily != null
  const steps = connected ? daily[day]?.steps ?? null : null
  const sleep = connected ? daily[day]?.sleep ?? null : null
  const workout = workoutMinutesOn(S, day)
  const rhr = connected ? latest(daily, 'rhr', day) : null
  const ring = (key, value, goal) => ({ key, value, goal, fill: ringFill(value, goal) })
  return {
    connected,
    rings: [
      ring('steps', steps, STEPS_GOAL),
      ring('sleep', sleep, SLEEP_GOAL_MIN),
      ring('workout', workout, WORKOUT_GOAL_MIN),
    ],
    rhr: rhr ? { value: rhr.value, est: rhr.est, today: rhr.day === day } : null,
  }
}
