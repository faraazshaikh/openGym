import { describe, it, expect } from 'vitest'
import { ringFill, workoutMinutesOn, homeToday, STEPS_GOAL } from './home-today.js'

const MIN = 60000

describe('ringFill', () => {
  it('is the share of the goal, capped at 1', () => {
    expect(ringFill(5000, 10000)).toBe(0.5)
    expect(ringFill(25000, 10000)).toBe(1)
  })
  it('is empty without a value or a goal', () => {
    expect(ringFill(null, 10000)).toBe(0)
    expect(ringFill(0, 10000)).toBe(0)
    expect(ringFill(5000, 0)).toBe(0)
    expect(ringFill(NaN, 10000)).toBe(0)
  })
})

describe('workoutMinutesOn', () => {
  const t0 = Date.parse('2026-11-14T08:00:00Z')
  it('adds the sessions of that day', () => {
    const S = { workouts: [
      { d: '2026-11-14', start: t0, end: t0 + 30 * MIN },
      { d: '2026-11-14', start: t0 + 60 * MIN, end: t0 + 75 * MIN },
      { d: '2026-11-13', start: t0, end: t0 + 50 * MIN },
    ] }
    expect(workoutMinutesOn(S, '2026-11-14')).toBe(45)
  })
  it('skips a session without an end and caps a forgotten timer', () => {
    const S = { workouts: [
      { d: '2026-11-14', start: t0 },
      { d: '2026-11-14', start: t0, end: t0 + 20 * 60 * MIN },
    ] }
    expect(workoutMinutesOn(S, '2026-11-14')).toBe(360)
  })
  it('copes with no workouts at all', () => {
    expect(workoutMinutesOn({}, '2026-11-14')).toBe(0)
    expect(workoutMinutesOn(null, '2026-11-14')).toBe(0)
  })
})

describe('homeToday', () => {
  const day = '2026-11-14'
  it('is not connected while the read is off', () => {
    const h = homeToday({ workouts: [] }, null, day)
    expect(h.connected).toBe(false)
    expect(h.rhr).toBe(null)
    expect(h.rings.map(r => r.key)).toEqual(['steps', 'sleep', 'workout'])
    expect(h.rings[0].fill).toBe(0)
  })
  it('fills the rings from today and picks the latest resting heart rate', () => {
    const daily = {
      '2026-11-12': { rhr: 61 },
      '2026-11-13': { rhr: 59, rhrEst: true },
      [day]: { steps: 4000, sleep: 420 },
    }
    const h = homeToday({ workouts: [] }, daily, day)
    expect(h.connected).toBe(true)
    expect(h.rings[0]).toMatchObject({ value: 4000, goal: STEPS_GOAL, fill: 0.4 })
    expect(h.rings[1].fill).toBeCloseTo(0.875)
    expect(h.rhr).toEqual({ value: 59, est: true, today: false })
  })
  it('connected with an empty day is connected, with empty rings', () => {
    const h = homeToday({ workouts: [] }, {}, day)
    expect(h.connected).toBe(true)
    expect(h.rings.every(r => r.fill === 0)).toBe(true)
  })
  it('ignores a resting heart rate older than two weeks', () => {
    expect(homeToday({ workouts: [] }, { '2026-10-01': { rhr: 60 } }, day).rhr).toBe(null)
  })
})
