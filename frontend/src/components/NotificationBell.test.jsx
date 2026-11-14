// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationBell from './NotificationBell.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ user: null, channel: 'sideload', update: null, sheets: [] }))
vi.mock('../store/useStore.js', () => ({ useStore: sel => sel({ user: mocks.user }) }))
vi.mock('../store/useUI.js', () => ({ useUI: sel => sel({ openSheet: render => { mocks.sheets.push(render) } }) }))
vi.mock('../lib/channel.js', () => ({ getChannel: async () => mocks.channel }))
vi.mock('../lib/update.js', () => ({ checkForUpdate: async () => mocks.update, APP_DOWNLOAD: 'https://example.invalid/Fitrix.apk' }))

const mounted = []
async function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  await act(async () => { root.render(el) })
  return host
}
beforeEach(() => { mocks.user = { id: 'u' }; mocks.channel = 'sideload'; mocks.update = null; mocks.sheets.length = 0 })
afterEach(() => { act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

describe('the notification bell', () => {
  it('has no dot and says "all caught up" when there is nothing to tell', async () => {
    const page = await mount(<NotificationBell />)
    expect(page.querySelector('.tab-dot')).toBeNull()
    page.querySelector('button').click()
    const sheet = await mount(mocks.sheets[0](() => {}))
    expect(sheet.textContent).toContain("You're all caught up.")
  })

  it('shows a dot and the warning when the access is about to end', async () => {
    mocks.user = { id: 'u', expiresAt: new Date(Date.now() + 3 * 86400000).toISOString() }
    const page = await mount(<NotificationBell />)
    expect(page.querySelector('.tab-dot')).toBeTruthy()
    page.querySelector('button').click()
    const sheet = await mount(mocks.sheets[0](() => {}))
    expect(sheet.textContent).toContain('Your access ends in')
  })

  it('offers the newest app on the downloaded Android app, and opens the download link', async () => {
    mocks.update = { hasUpdate: true, latestVersion: '1.4.7' }
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const page = await mount(<NotificationBell />)
    page.querySelector('button').click()
    const close = vi.fn()
    const sheet = await mount(mocks.sheets[0](close))
    expect(sheet.textContent).toContain('Fitrix 1.4.7 is ready')
    await act(async () => { [...sheet.querySelectorAll('button')].find(b => b.textContent === 'Download').click() })
    expect(open).toHaveBeenCalledWith('https://example.invalid/Fitrix.apk', '_blank', 'noopener')
    expect(close).toHaveBeenCalled()
    open.mockRestore()
  })

  it('does not check for updates on the web version or a store app', async () => {
    mocks.channel = 'web'
    mocks.update = { hasUpdate: true, latestVersion: '1.4.7' }
    const page = await mount(<NotificationBell />)
    expect(page.querySelector('.tab-dot')).toBeNull()
  })
})
