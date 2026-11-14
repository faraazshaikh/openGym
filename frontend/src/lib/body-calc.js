// The two body calculators (Measurements → Calculators): body fat from a tape measure, and the
// energy the body burns at rest. Pure: lengths in cm, mass in kg, as everything is stored.
//
// Body fat is the US Navy tape method. It is an estimate: it reads waist, neck and height (and
// hips for women) and is usually a few points off a scan, but it needs nothing but a tape.
// BMR uses Katch-McArdle when a body fat percentage is known (it works from lean mass) and
// Mifflin-St Jeor when it is not.

export const SEXES = ['male', 'female']

// What you do in a week, from the usual activity factors.
export const ACTIVITY_LEVELS = [
  { value: 'none', factor: 1.2, label: 'Little or no exercise' },
  { value: 'light', factor: 1.375, label: '1 to 3 times a week' },
  { value: 'moderate', factor: 1.55, label: '3 to 5 times a week' },
  { value: 'high', factor: 1.725, label: '6 to 7 times a week' },
  { value: 'extreme', factor: 1.9, label: 'Twice a day or a physical job' },
]
export const DEFAULT_ACTIVITY = 'moderate'

const num = v => (v === '' || v == null ? NaN : Number(v))
const pos = v => Number.isFinite(v) && v > 0

/**
 * Body fat in percent, to one decimal, or null when the numbers cannot give a sensible one.
 * `hipCm` is only used for women. A waist at or under the neck, or a result outside 2 to 60 percent,
 * means a mismeasure and returns null rather than a number that looks real.
 */
export function navyBodyFat({ sex, waistCm, neckCm, heightCm, hipCm }) {
  const waist = num(waistCm), neck = num(neckCm), height = num(heightCm), hip = num(hipCm)
  if (!pos(waist) || !pos(neck) || !pos(height)) return null
  let pct
  if (sex === 'female') {
    if (!pos(hip) || waist + hip - neck <= 0) return null
    pct = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(height)) - 450
  } else {
    if (waist - neck <= 0) return null
    pct = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450
  }
  if (!Number.isFinite(pct) || pct < 2 || pct > 60) return null
  return Math.round(pct * 10) / 10
}

/**
 * Resting energy in kcal a day (whole number) and the daily total for an activity level, or null
 * when the inputs are not enough. `fatPct` (0 to 100) switches to the lean-mass formula; leave it
 * null or empty for the age, height and weight one. `formula` says which one was used.
 */
export function bmrResult({ sex, age, weightKg, heightCm, fatPct, activity = DEFAULT_ACTIVITY }) {
  const a = num(age), w = num(weightKg), h = num(heightCm), f = num(fatPct)
  if (!pos(w) || !(a >= 10 && a <= 120)) return null
  let bmr, formula
  if (Number.isFinite(f) && f > 0 && f < 100) {
    bmr = 370 + 21.6 * w * (1 - f / 100)
    formula = 'katch-mcardle'
  } else {
    if (!pos(h)) return null
    bmr = 10 * w + 6.25 * h - 5 * a + (sex === 'female' ? -161 : 5)
    formula = 'mifflin-st-jeor'
  }
  if (!Number.isFinite(bmr) || bmr <= 0) return null
  const level = ACTIVITY_LEVELS.find(l => l.value === activity) || ACTIVITY_LEVELS.find(l => l.value === DEFAULT_ACTIVITY)
  return { bmr: Math.round(bmr), formula, daily: Math.round(bmr * level.factor) }
}

const CM_PER_IN = 2.54
/** Feet and inches to cm, or null for nothing entered. */
export const feetInchesToCm = (ft, inch) => {
  const f = num(ft), i = num(inch)
  const total = (Number.isFinite(f) ? f : 0) * 12 + (Number.isFinite(i) ? i : 0)
  return total > 0 ? Math.round(total * CM_PER_IN * 10) / 10 : null
}
/** cm to whole feet and inches (inches 0 to 11). */
export const cmToFeetInches = cm => {
  if (!pos(num(cm))) return { ft: 0, inch: 0 }
  const total = Math.round(num(cm) / CM_PER_IN)
  return { ft: Math.floor(total / 12), inch: total % 12 }
}
