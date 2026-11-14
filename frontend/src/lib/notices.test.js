import { describe, expect, it } from 'vitest'
import { buildNotices, daysLeft, EXPIRY_WARN_DAYS } from './notices.js'

const NOW = Date.parse('2026-11-14T12:00:00Z')
const inDays = n => new Date(NOW + n * 86400000).toISOString()

describe('buildNotices', () => {
  it('says nothing for an account without an end date and no update', () => {
    expect(buildNotices({ user: { id: 'a' }, update: { hasUpdate: false, latestVersion: '1.4.6' }, now: NOW })).toEqual([])
    expect(buildNotices({ now: NOW })).toEqual([])
  })

  it('warns in the last two weeks and not before', () => {
    expect(buildNotices({ user: { expiresAt: inDays(EXPIRY_WARN_DAYS + 1) }, now: NOW })).toEqual([])
    const [n] = buildNotices({ user: { expiresAt: inDays(EXPIRY_WARN_DAYS) }, now: NOW })
    expect(n.id).toBe('expiry')
    expect(n.title).toBe('Your access ends in 14 days')
  })

  it('counts a part day as a day, and says tomorrow for the last one', () => {
    expect(daysLeft(inDays(2.2), NOW)).toBe(3)
    expect(buildNotices({ user: { expiresAt: inDays(0.5) }, now: NOW })[0].title).toBe('Your access ends tomorrow')
  })

  it('says it has ended once the date has passed, and that the data is kept', () => {
    const [n] = buildNotices({ user: { expiresAt: inDays(-1) }, now: NOW })
    expect(n.title).toBe('Your access has ended')
    expect(n.text).toContain('data is kept')
  })

  it('offers the download when a newer version exists, and only when there is somewhere to download it', () => {
    const update = { hasUpdate: true, latestVersion: '1.4.7' }
    expect(buildNotices({ update, now: NOW })).toEqual([])
    const [n] = buildNotices({ update, downloadUrl: 'https://example.invalid/Fitrix.apk', now: NOW })
    expect(n).toMatchObject({ id: 'update', title: 'Fitrix 1.4.7 is ready', action: { label: 'Download', href: 'https://example.invalid/Fitrix.apk' } })
  })

  it('puts the expiry first when both apply, and ignores an unreadable date', () => {
    const both = buildNotices({ user: { expiresAt: inDays(3) }, update: { hasUpdate: true, latestVersion: '1.4.7' }, downloadUrl: 'x', now: NOW })
    expect(both.map(n => n.id)).toEqual(['expiry', 'update'])
    expect(buildNotices({ user: { expiresAt: 'soon' }, now: NOW })).toEqual([])
  })
})
