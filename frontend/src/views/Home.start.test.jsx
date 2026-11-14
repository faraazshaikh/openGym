// @vitest-environment happy-dom
// The tab bar lost its Start button (Home, Plan, Progress, You), so Home carries the one big Start,
// and the bulb in the header flips light and dark.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { startFlow } from '../sheets.jsx'
import Home from './Home.jsx'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
}))

const routines = [{ id: 'r1', name: 'Push', emoji: null, ex: [{ id: '0025' }] }]
const week = { 0: ['r1'], 1: ['r1'], 2: ['r1'], 3: ['r1'], 4: ['r1'], 5: ['r1'], 6: ['r1'] }

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  nav.mockClear(); startFlow.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); delete document.documentElement.dataset.theme })

const setS = (over = {}) => useStore.setState(s => ({
  S: { ...s.S, routines, dayPlan: {}, workouts: [], active: null, weighIn: false, week, ...over },
  user: null,
}))
const mount = () => act(() => root.render(<Home />))
const startBtn = () => host.querySelector('.home-start')
const bulb = () => host.querySelector('[data-tour="theme-bulb"]')

describe('Home — the big Start button', () => {
  it('starts today’s plan when there is one', () => {
    setS(); mount()
    expect(startBtn().textContent).toBe('Start')
    act(() => startBtn().click())
    expect(startFlow).toHaveBeenCalledWith(['r1'])
    expect(nav).not.toHaveBeenCalled()
  })

  it('opens the Start screen on a day with nothing planned', () => {
    setS({ week: {}, routines: [] }); mount()
    act(() => startBtn().click())
    expect(startFlow).not.toHaveBeenCalled()
    expect(nav).toHaveBeenCalledWith('/workout')
  })

  it('reads Resume with a session running and brings you back to it, never starting another', () => {
    setS({ active: { id: 'a', name: 'Push', entries: [], cur: 0 } }); mount()
    expect(startBtn().textContent).toBe('Resume')
    expect(startBtn().className).toContain('rec')
    act(() => startBtn().click())
    expect(nav).toHaveBeenCalledWith('/workout')
    expect(startFlow).not.toHaveBeenCalled()
  })

  it('shows the running time, still named Resume', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 10, 14, 18, 0, 0))
      setS({ active: { id: 'a', name: 'Push', entries: [], cur: 0, start: Date.now() - 754_000 } }); mount()
      expect(startBtn().textContent).toBe('12:34')
      expect(startBtn().getAttribute('aria-label')).toBe('Resume')
    } finally { vi.useRealTimers() }
  })

  it('says Edit workout while a saved workout is being edited', () => {
    setS({ active: { id: 'a', name: 'Push', entries: [], cur: 0, editingWorkoutId: 'w1' } }); mount()
    expect(startBtn().textContent).toBe('Edit workout')
  })
})

describe('Home — the light and dark bulb', () => {
  it('sits in the header beside the gear and flips dark to light and back', () => {
    setS({ theme: 'dark' }); mount()
    document.documentElement.dataset.theme = 'dark'
    expect(bulb().closest('.hdr')).not.toBeNull()
    act(() => bulb().click())
    expect(useStore.getState().S.theme).toBe('light')
    document.documentElement.dataset.theme = 'light'
    act(() => bulb().click())
    expect(useStore.getState().S.theme).toBe('dark')
  })

  it('on System, flips away from whatever the phone is showing', () => {
    setS({ theme: 'system' }); mount()
    document.documentElement.dataset.theme = 'light'
    act(() => bulb().click())
    expect(useStore.getState().S.theme).toBe('dark')
  })
})
