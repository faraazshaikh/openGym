import { describe, expect, it } from 'vitest'
import { lengthKey, logBodyFat, measurementSeries, measurementUnit } from './measurements.js'

describe('lengthKey', () => {
  it('follows the weight unit until a tape-measure unit is chosen', () => {
    expect(lengthKey({ unit: 'kg' })).toBe('kg')
    expect(lengthKey({ unit: 'lb' })).toBe('lb')
    expect(lengthKey({})).toBe('kg')
  })
  it('lets kg go with inches, and lb with centimetres', () => {
    expect(measurementUnit(lengthKey({ unit: 'kg', lengthUnit: 'in' }))).toBe('in')
    expect(measurementUnit(lengthKey({ unit: 'lb', lengthUnit: 'cm' }))).toBe('cm')
  })
  it('shows a stored waist in inches for a kg profile that chose inches', () => {
    const state = { unit: 'kg', lengthUnit: 'in', measurements: [{ d: '2026-11-01', t: 1, waist: 91.44 }] }
    expect(measurementSeries(state, 'waist')[0].y).toBe(36)
  })
})

describe('logBodyFat', () => {
  const base = () => ({ unit: 'kg', measurements: [], customMeasurements: [] })
  it('starts a check-in for the day', () => {
    const s = base()
    expect(logBodyFat(s, 15.64, '2026-11-14', 5)).toBe(true)
    expect(s.measurements).toHaveLength(1)
    expect(s.measurements[0]).toMatchObject({ d: '2026-11-14', bodyFat: 15.6, t: 5, waist: null })
  })
  it('keeps the rest of that day and other days', () => {
    const s = base()
    s.measurements = [{ d: '2026-11-13', t: 1, waist: 80 }, { d: '2026-11-14', t: 2, waist: 81, chest: 100 }]
    logBodyFat(s, 18, '2026-11-14', 9)
    expect(s.measurements.map(e => e.d)).toEqual(['2026-11-13', '2026-11-14'])
    expect(s.measurements[1]).toMatchObject({ waist: 81, chest: 100, bodyFat: 18, t: 9 })
    expect(s.measurements[0].waist).toBe(80)
  })
  it('refuses a number that is not a percentage', () => {
    const s = base()
    expect(logBodyFat(s, 120, '2026-11-14')).toBe(false)
    expect(logBodyFat(s, '', '2026-11-14')).toBe(false)
    expect(logBodyFat(s, 20, 'today')).toBe(false)
    expect(s.measurements).toEqual([])
  })
})
