import { describe, expect, it } from 'vitest'
import { ACTIVITY_LEVELS, bmrResult, cmToFeetInches, feetInchesToCm, navyBodyFat } from './body-calc.js'

describe('navyBodyFat', () => {
  it('gives a man the US Navy figure', () => {
    // 85 cm waist, 38 cm neck, 185 cm tall: the published formula gives about 15.6 percent.
    expect(navyBodyFat({ sex: 'male', waistCm: 85, neckCm: 38, heightCm: 185 })).toBeCloseTo(15.6, 0)
  })
  it('uses the hips for a woman', () => {
    const v = navyBodyFat({ sex: 'female', waistCm: 75, neckCm: 32, heightCm: 168, hipCm: 98 })
    expect(v).toBeGreaterThan(24)
    expect(v).toBeLessThan(30)
    expect(navyBodyFat({ sex: 'female', waistCm: 75, neckCm: 32, heightCm: 168 })).toBeNull()
  })
  it('rises with the waist and falls with the neck', () => {
    const base = { sex: 'male', heightCm: 180, neckCm: 38 }
    expect(navyBodyFat({ ...base, waistCm: 95 })).toBeGreaterThan(navyBodyFat({ ...base, waistCm: 85 }))
    expect(navyBodyFat({ sex: 'male', heightCm: 180, waistCm: 90, neckCm: 42 })).toBeLessThan(navyBodyFat({ ...base, waistCm: 90 }))
  })
  it('says nothing for a missing, zero or impossible measurement', () => {
    expect(navyBodyFat({ sex: 'male', waistCm: 0, neckCm: 38, heightCm: 180 })).toBeNull()
    expect(navyBodyFat({ sex: 'male', waistCm: '', neckCm: 38, heightCm: 180 })).toBeNull()
    expect(navyBodyFat({ sex: 'male', waistCm: 36, neckCm: 38, heightCm: 180 })).toBeNull()
    expect(navyBodyFat({ sex: 'male', waistCm: 200, neckCm: 20, heightCm: 150 })).toBeNull()
  })
})

describe('bmrResult', () => {
  it('uses lean mass when a body fat percentage is given (Katch-McArdle)', () => {
    // 80 kg at 20 percent: lean mass 64 kg, 370 + 21.6 * 64 = 1752.4.
    expect(bmrResult({ sex: 'male', age: 37, weightKg: 80, heightCm: 185, fatPct: 20 })).toMatchObject({ bmr: 1752, formula: 'katch-mcardle' })
  })
  it('falls back to Mifflin-St Jeor without one', () => {
    // 10 * 81 + 6.25 * 185.4 - 5 * 37 + 5 = 1788.75
    expect(bmrResult({ sex: 'male', age: 37, weightKg: 81, heightCm: 185.4 })).toMatchObject({ bmr: 1789, formula: 'mifflin-st-jeor' })
    expect(bmrResult({ sex: 'female', age: 30, weightKg: 60, heightCm: 165, fatPct: '' }).bmr).toBe(Math.round(600 + 1031.25 - 150 - 161))
  })
  it('multiplies by the activity level, moderate by default', () => {
    const base = { sex: 'male', age: 37, weightKg: 80, heightCm: 185, fatPct: 20 }
    const factor = v => ACTIVITY_LEVELS.find(l => l.value === v).factor
    expect(bmrResult({ ...base, activity: 'high' }).daily).toBe(Math.round(1752.4 * factor('high')))
    expect(bmrResult(base).daily).toBe(Math.round(1752.4 * factor('moderate')))
    expect(bmrResult({ ...base, activity: 'nonsense' }).daily).toBe(bmrResult(base).daily)
  })
  it('needs a weight and an age, and a height when there is no body fat', () => {
    expect(bmrResult({ sex: 'male', age: 37, weightKg: 0, heightCm: 180 })).toBeNull()
    expect(bmrResult({ sex: 'male', age: '', weightKg: 80, heightCm: 180 })).toBeNull()
    expect(bmrResult({ sex: 'male', age: 37, weightKg: 80, heightCm: 0 })).toBeNull()
    expect(bmrResult({ sex: 'male', age: 37, weightKg: 80, heightCm: 0, fatPct: 20 }).bmr).toBe(1752)
  })
})

describe('feet and inches', () => {
  it('converts both ways', () => {
    expect(feetInchesToCm(6, 1)).toBe(185.4)
    expect(feetInchesToCm(0, 0)).toBeNull()
    expect(feetInchesToCm('', '')).toBeNull()
    expect(cmToFeetInches(185.4)).toEqual({ ft: 6, inch: 1 })
    expect(cmToFeetInches(null)).toEqual({ ft: 0, inch: 0 })
  })
})
