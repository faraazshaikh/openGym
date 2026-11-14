import { describe, expect, it } from 'vitest'
import { dailyFromHub, firstFullDay, mergeDaily, monthSummary, readSince } from './health-daily.js'

const at = (day, h = 12, m = 0) => new Date(day + 'T00:00:00').setHours(h, m, 0, 0)
const MIN = 60000

describe('dailyFromHub steps', () => {
  it('takes one app per day, the one with the most, and never adds two apps together', () => {
    const raw = { steps: [
      [at('2026-11-10', 8), at('2026-11-10', 9), 3000, 0],
      [at('2026-11-10', 10), at('2026-11-10', 11), 4200, 0],
      [at('2026-11-10', 9), at('2026-11-10', 12), 6100, 1],
    ] }
    expect(dailyFromHub(raw)['2026-11-10'].steps).toBe(7200)
  })

  it('counts a record on the day it starts and drops absurd ones', () => {
    const raw = { steps: [
      [at('2026-11-10', 23, 50), at('2026-11-11', 0, 10), 500, 0],
      [at('2026-11-11', 9), at('2026-11-11', 10), 9_999_999, 0],
      [at('2026-11-11', 9), at('2026-11-11', 10), -5, 0],
    ] }
    const out = dailyFromHub(raw)
    expect(out['2026-11-10'].steps).toBe(500)
    expect(out['2026-11-11']).toBeUndefined()
  })
})

describe('dailyFromHub sleep', () => {
  it('belongs to the wake-up day and counts only the time asleep', () => {
    const s = at('2026-11-09', 23), e = at('2026-11-10', 7)
    const raw = { sleep: [{ s, e, o: 0, st: [
      [s, s + 30 * MIN, 1],              // awake
      [s + 30 * MIN, s + 270 * MIN, 4],  // light, 240 min
      [s + 270 * MIN, s + 390 * MIN, 5], // deep, 120 min
      [s + 390 * MIN, e, 6],             // REM, 90 min
    ] }] }
    const out = dailyFromHub(raw)
    expect(out['2026-11-10'].sleep).toBe(450)
    expect(out['2026-11-09']).toBeUndefined()
  })

  it('without stages takes the whole session, and with two apps the longest', () => {
    const s = at('2026-11-09', 23), e = at('2026-11-10', 6)
    const raw = { sleep: [
      { s, e, o: 0, st: [] },
      { s: s + 30 * MIN, e, o: 1, st: [] },
    ] }
    expect(dailyFromHub(raw)['2026-11-10'].sleep).toBe(420)
  })

  it('ignores a session that is longer than a day could hold', () => {
    const raw = { sleep: [{ s: at('2026-11-08', 1), e: at('2026-11-10', 1), o: 0, st: [] }] }
    expect(dailyFromHub(raw)).toEqual({})
  })
})

describe('dailyFromHub resting heart rate', () => {
  it('takes the last reading of the app with the most, within a plausible range', () => {
    const raw = { rhr: [
      [at('2026-11-10', 6), 58, 0],
      [at('2026-11-10', 18), 61, 0],
      [at('2026-11-10', 12), 99, 1],
      [at('2026-11-10', 13), 5, 0],
    ] }
    expect(dailyFromHub(raw)['2026-11-10'].rhr).toBe(61)
  })
})

describe('dailyFromHub window and bad input', () => {
  it('leaves out days before fromDay', () => {
    const raw = { steps: [[at('2026-11-08'), at('2026-11-08', 13), 100, 0], [at('2026-11-09'), at('2026-11-09', 13), 200, 0]] }
    expect(Object.keys(dailyFromHub(raw, { fromDay: '2026-11-09' }))).toEqual(['2026-11-09'])
  })

  it('survives nothing, junk and missing parts', () => {
    expect(dailyFromHub(null)).toEqual({})
    expect(dailyFromHub({ steps: 'x', sleep: [null, 3], rhr: [[]] })).toEqual({})
  })

  it('reads from half a day before the first whole day', () => {
    expect(readSince('2026-11-09')).toBe(new Date('2026-11-09T00:00:00').getTime() - 12 * 3600e3)
    expect(firstFullDay(new Date('2026-11-14T10:00:00').getTime(), 2)).toBe('2026-11-12')
  })
})

describe('mergeDaily and monthSummary', () => {
  const now = new Date('2026-11-14T10:00:00').getTime()

  it('replaces a day that was read again, keeps the older ones and drops the very old', () => {
    const kept = { '2026-11-12': { steps: 100 }, '2026-11-13': { steps: 200 }, '2026-06-01': { steps: 5 } }
    const out = mergeDaily(kept, { '2026-11-13': { steps: 900, rhr: 60 } }, { now, keep: 90 })
    expect(out).toEqual({ '2026-11-12': { steps: 100 }, '2026-11-13': { steps: 900, rhr: 60 } })
  })

  it('averages the days that have each number', () => {
    const daily = {
      '2026-11-01': { steps: 6000, sleep: 420 },
      '2026-11-02': { steps: 8000, sleep: 480, rhr: 60 },
      '2026-11-03': { rhr: 64 },
      '2026-10-31': { steps: 99999 },
    }
    expect(monthSummary(daily, 2026, 10)).toEqual({ steps: 7000, sleep: 450, rhr: 62, days: 3 })
    expect(monthSummary(daily, 2026, 8)).toEqual({ steps: null, sleep: null, rhr: null, days: 0 })
  })
})
