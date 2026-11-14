// @vitest-environment happy-dom
/* The body fat and BMR calculators as a person uses them: open one from the sheet, type, press
 * Calculate, read the number, save it. The maths itself is tested in lib/body-calc.test.js. */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', async importOriginal => ({ ...(await importOriginal()), api: vi.fn(() => Promise.reject(new Error('offline'))), beacon: vi.fn() }))

import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO } from '../lib/format.js'
import { bmrSheet, bodyFatSheet } from './BodyCalc.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const mounted = []
function render(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(el))
  return host
}
const topSheet = () => { const s = useUI.getState().sheets.at(-1); return s ? render(s.render(() => useUI.getState().closeSheet(s.id))) : null }
const setValue = (input, v) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, v)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
})
const field = (host, label) => [...host.querySelectorAll('.measure-field')].find(l => l.textContent.startsWith(label)).querySelectorAll('input')
const click = (host, text) => act(() => { [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text).click() })
const seed = extra => useStore.setState({ S: Object.assign(clone(DEF), { unit: 'kg', measurements: [], bodyweight: [], ...extra }), user: null })

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useUI.setState({ sheets: [], toastMsg: '' })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(r => r.unmount()) }) })

describe('body fat calculator', () => {
  it('works out a figure in inches for a kg profile, and saves it to today', () => {
    seed({ lengthUnit: 'in' })
    act(() => { bodyFatSheet() })
    const host = topSheet()
    setValue(field(host, 'Waist')[0], '33.5')
    setValue(field(host, 'Neck')[0], '15')
    const [ft, inch] = field(host, 'Height')
    setValue(ft, '6'); setValue(inch, '1')
    click(host, 'Calculate')
    const shown = host.querySelector('.calc-result .big').textContent
    expect(parseFloat(shown)).toBeGreaterThan(8)
    expect(parseFloat(shown)).toBeLessThan(20)
    click(host, 'Save to measurements')
    const entry = useStore.getState().S.measurements.find(e => e.d === todayISO())
    expect(entry.bodyFat).toBe(parseFloat(shown))
  })

  it('says so instead of showing a number when the measurements do not add up', () => {
    seed()
    act(() => { bodyFatSheet() })
    const host = topSheet()
    setValue(field(host, 'Waist')[0], '30')
    setValue(field(host, 'Neck')[0], '40')
    setValue(field(host, 'Height')[0], '180')
    click(host, 'Calculate')
    expect(host.querySelector('.calc-result').textContent).toContain('do not give a sensible result')
    expect(host.querySelector('.calc-result .big')).toBeNull()
  })

  it('asks for the hips only for a woman', () => {
    seed()
    act(() => { bodyFatSheet() })
    const host = topSheet()
    expect(host.textContent).not.toContain('Hips')
    click(host, 'Female')
    expect(host.textContent).toContain('Hips')
  })

  it('starts from the latest waist and remembers the height next time', () => {
    seed({ measurements: [{ d: '2026-11-01', t: 1, waist: 86.4, neck: 38.1 }] })
    act(() => { bodyFatSheet() })
    let host = topSheet()
    expect(field(host, 'Waist')[0].value).toBe('86.4')
    setValue(field(host, 'Height')[0], '185')
    click(host, 'Calculate')
    act(() => { bodyFatSheet() })
    host = topSheet()
    expect(field(host, 'Height')[0].value).toBe('185')
  })
})

describe('BMR calculator', () => {
  it('uses the latest weigh-in and a body fat figure, and shows both numbers', () => {
    seed({ bodyweight: [{ d: '2026-11-01', w: 80 }], measurements: [{ d: '2026-11-01', t: 1, bodyFat: 20 }] })
    act(() => { bmrSheet() })
    const host = topSheet()
    expect(field(host, 'Weight')[0].value).toBe('80')
    expect(field(host, 'My fat percentage')[0].value).toBe('20')
    setValue(field(host, 'Age')[0], '37')
    click(host, 'Calculate')
    const nums = [...host.querySelectorAll('.calc-result .big')].map(n => parseInt(n.textContent.replace(/\D/g, ''), 10))
    expect(nums[0]).toBe(1752)
    expect(nums[1]).toBeGreaterThan(nums[0])
    expect(host.textContent).toContain('Katch-McArdle')
  })

  it('falls back to age, height and weight when the fat percentage is empty', () => {
    seed({ bodyweight: [{ d: '2026-11-01', w: 81 }] })
    act(() => { bmrSheet() })
    const host = topSheet()
    setValue(field(host, 'Age')[0], '37')
    setValue(field(host, 'Height')[0], '185.4')
    click(host, 'Calculate')
    expect(host.textContent).toContain('Mifflin-St Jeor')
    expect(parseInt(host.querySelector('.calc-result .big').textContent.replace(/\D/g, ''), 10)).toBe(1789)
  })

  it('reads a pound weight as pounds', () => {
    seed({ unit: 'lb', bodyweight: [{ d: '2026-11-01', w: 176.4 }] })
    act(() => { bmrSheet() })
    const host = topSheet()
    setValue(field(host, 'Age')[0], '37')
    setValue(field(host, 'Height')[0], '185')
    click(host, 'Calculate')
    // 176.4 lb is 80 kg: 10 * 80 + 6.25 * 185 - 5 * 37 + 5 = 1776 (rounded).
    expect(parseInt(host.querySelector('.calc-result .big').textContent.replace(/\D/g, ''), 10)).toBeGreaterThanOrEqual(1775)
  })

  it('asks for what is missing', () => {
    seed()
    act(() => { bmrSheet() })
    const host = topSheet()
    click(host, 'Calculate')
    expect(host.querySelector('.calc-result').textContent).toContain('Enter your age')
  })
})
