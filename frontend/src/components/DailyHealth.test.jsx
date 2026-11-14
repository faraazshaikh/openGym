// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'

// The calendar's strip of daily numbers. MOBILE is a build flag, so the phone build is stubbed in
// before anything loads, and the health file is played by a plain object.
const h = vi.hoisted(() => {
  vi.stubEnv('VITE_MOBILE', '1')
  return { file: { readDaily: true, daily: {} }, listeners: new Set() }
})
vi.mock('../lib/health-sync.js', () => ({
  loadHealth: async () => h.file,
  onHealthChange: cb => { h.listeners.add(cb); return () => h.listeners.delete(cb) },
}))

import DailyHealthStrip, { useDailyHealth } from './DailyHealth.jsx'

const mounted = []
function Probe({ y = 2026, mo = 10 }) {
  const daily = useDailyHealth()
  return <div id="out"><DailyHealthStrip daily={daily} y={y} mo={mo} /></div>
}
async function render(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  await act(async () => { root.render(el) })
  return host
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  document.body.innerHTML = ''
  h.listeners.clear()
  h.file = { readDaily: true, daily: {
    '2026-11-01': { steps: 6000, sleep: 420 },
    '2026-11-02': { steps: 8000, sleep: 480, rhr: 60 },
  } }
})
afterEach(() => { act(() => { mounted.splice(0).forEach(r => r.unmount()) }) })

describe('DailyHealthStrip', () => {
  it('shows the month averages, with a label under each', async () => {
    const host = await render(<Probe />)
    const text = host.textContent
    expect(text).toContain('7,000')
    expect(text).toContain('7h 30m')
    expect(text).toContain('60 bpm')
    expect(text).toContain('Steps')
    expect(text).toContain('Sleep')
    expect(text).toContain('Resting heart rate')
    expect(text).toContain('Daily average')
  })

  it('marks the resting heart rate with a ~ when it was estimated', async () => {
    h.file = { readDaily: true, daily: { '2026-11-01': { rhr: 54, rhrEst: true } } }
    const host = await render(<Probe />)
    expect(host.textContent).toContain('~54 bpm')
  })

  it('leaves out a number no day has', async () => {
    h.file = { readDaily: true, daily: { '2026-11-01': { steps: 5000 } } }
    const host = await render(<Probe />)
    expect(host.textContent).toContain('5,000')
    expect(host.textContent).not.toContain('Sleep')
    expect(host.textContent).not.toContain('bpm')
  })

  it('shows nothing when the switch is off or the month is empty', async () => {
    h.file = { readDaily: false, daily: { '2026-11-01': { steps: 5000 } } }
    expect((await render(<Probe />)).querySelector('.dh-strip')).toBeNull()
    h.file = { readDaily: true, daily: { '2026-11-01': { steps: 5000 } } }
    expect((await render(<Probe y={2026} mo={9} />)).querySelectorAll('.dh-strip').length).toBe(0)
  })

  it('follows the file when it changes', async () => {
    const host = await render(<Probe />)
    expect(host.querySelector('.dh-strip')).toBeTruthy()
    await act(async () => { h.listeners.forEach(cb => cb({ readDaily: false, daily: {} })) })
    expect(host.querySelector('.dh-strip')).toBeNull()
  })
})
