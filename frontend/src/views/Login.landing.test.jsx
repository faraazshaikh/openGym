// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* The sign-in screen of an invite-only server is a landing page: what Fitrix is, a box for the
   invite code, and a small way back in. The code box only collects the code; the sheet it opens
   asks for the name and the email the invite was made for. */
const mocks = vi.hoisted(() => {
  const state = { webauthn: true, config: null, sheets: [], toasts: [] }
  state.snapshot = () => ({
    config: state.config, S: {},
    setUser: vi.fn(), adoptProfile: vi.fn(), setGuest: vi.fn(), loadConfig: vi.fn(async () => state.config),
    pushState: vi.fn(), pullState: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: m => mocks.toasts.push(m), openSheet: render => { mocks.sheets.push(render); return {} } })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('../lib/api.js', () => ({
  webauthnOK: () => mocks.webauthn, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), BIO: 'your fingerprint', bio: () => 'your fingerprint',
  api: vi.fn(), passkeyAssertion: vi.fn(), passwordLogin: vi.fn(), passwordRegister: vi.fn(), passwordResetRedeem: vi.fn(),
}))
vi.mock('../lib/demo.js', () => ({ DEMO: false, REPO: 'https://example.invalid' }))
vi.mock('../sheets.jsx', () => ({ askAddDeviceData: vi.fn(), confirmSheet: vi.fn() }))

const mounted = []
function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(el))
  return host
}
const buttons = host => [...host.querySelectorAll('button')].map(b => b.textContent)
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent === text)
const type = (input, value) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})

beforeEach(() => { mocks.webauthn = true; mocks.config = null; mocks.sheets.length = 0; mocks.toasts.length = 0 })
afterEach(() => { act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

describe('the landing page of an invite-only server', () => {
  it('shows the invite box, what Fitrix is about, and a small sign-in area', () => {
    mocks.config = { invite_only: true, password_login: true }
    const page = mount(<Login />)
    expect(page.textContent).toContain('Fitrix')
    expect(page.textContent).toContain('Have an invite code?')
    expect(page.textContent).toContain('What Fitrix is about')
    expect(page.querySelector('input[placeholder="Invite code"]')).toBeTruthy()
    expect(buttons(page)).toEqual(expect.arrayContaining(['Continue', 'Sign in with passkey', 'Sign in with password', 'Lost access?']))
    expect(buttons(page)).not.toContain('Create new profile')
  })

  it('a server that is open to everyone keeps the old sign-in screen', () => {
    mocks.config = { invite_only: false }
    const page = mount(<Login />)
    expect(page.textContent).not.toContain('What Fitrix is about')
    expect(buttons(page)).toContain('Create new profile')
  })

  it('Continue with no code asks for one, and with a code opens the sign-up sheet with it filled in', () => {
    mocks.config = { invite_only: true }
    const page = mount(<Login />)
    act(() => button(page, 'Continue').click())
    expect(mocks.sheets).toHaveLength(0)
    expect(mocks.toasts).toContain('Enter your invite code')

    type(page.querySelector('input[placeholder="Invite code"]'), 'ab12cd34')
    act(() => button(page, 'Continue').click())
    expect(mocks.sheets).toHaveLength(1)
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(sheet.querySelector('input[placeholder="Invite code"]').value).toBe('AB12CD34')
    expect(sheet.querySelector('input[placeholder="E-mail address"]')).toBeTruthy()
    expect(sheet.querySelector('input[placeholder="Your name"]')).toBeTruthy()
  })
})

describe('the app download on the landing page', () => {
  it('appears once a code is typed and always points at the newest release', () => {
    mocks.config = { invite_only: true }
    const page = mount(<Login />)
    expect(page.textContent).not.toContain('Get the Android app')
    type(page.querySelector('input[placeholder="Invite code"]'), 'abc')
    expect(page.textContent).toContain('Get the Android app')
    const link = [...page.querySelectorAll('a')].find(a => a.textContent === 'Download Fitrix for Android')
    expect(link.getAttribute('href')).toBe('https://github.com/faraazshaikh/openGym/releases/latest/download/Fitrix.apk')
  })

  it('an iPhone gets the Add to Home Screen steps instead of the Android file', () => {
    const ua = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
    try {
      mocks.config = { invite_only: true }
      const page = mount(<Login />)
      type(page.querySelector('input[placeholder="Invite code"]'), 'abc')
      expect(page.textContent).toContain('Put Fitrix on your iPhone')
      expect(page.textContent).toContain('Add to Home Screen')
      expect(page.textContent).not.toContain('Download Fitrix for Android')
    } finally { ua.mockRestore() }
  })
})

describe('an invite link', () => {
  it('opens the landing page with the code filled in and the app download showing', () => {
    window.history.pushState({}, '', '/?invite=ab12cd34')
    try {
      mocks.config = { invite_only: true }
      const page = mount(<Login />)
      expect(page.querySelector('input[placeholder="Invite code"]').value).toBe('AB12CD34')
      expect(page.textContent).toContain('Get the Android app')
    } finally { window.history.pushState({}, '', '/') }
  })
})
