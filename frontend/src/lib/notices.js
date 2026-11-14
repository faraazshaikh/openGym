// What the bell on Home tells the person. Pure: the user (whose `expiresAt` the server sends when
// an invite had a number of months), the answer of the update check, and the clock go in; a list
// of notices comes out, most urgent first. Anything new the app wants to say becomes one more
// entry here, so the bell and its badge need no change.
//
// English only on purpose, like the landing page: these lines are written by the server owner's
// app, not part of the translated app strings.

export const EXPIRY_WARN_DAYS = 14
const DAY = 86400000

// Whole days from `now` to `iso`, rounded up: "ends in 1 day" until the moment it ends.
export function daysLeft(iso, now = Date.now()) {
  const end = Date.parse(iso)
  if (Number.isNaN(end)) return null
  return Math.ceil((end - now) / DAY)
}

const longDate = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * @param {{ user?: { expiresAt?: string }, update?: { hasUpdate: boolean, latestVersion: string }|null,
 *           downloadUrl?: string, now?: number }} input
 * @returns {{ id: string, kind: string, title: string, text: string, action?: { label: string, href: string } }[]}
 */
export function buildNotices({ user, update, downloadUrl, now = Date.now() } = {}) {
  const out = []
  const left = user?.expiresAt ? daysLeft(user.expiresAt, now) : null
  if (left !== null && left <= EXPIRY_WARN_DAYS) {
    out.push(left <= 0
      ? { id: 'expiry', kind: 'expiry', title: 'Your access has ended', text: 'Ask the person who invited you to extend it. Your data is kept.' }
      : { id: 'expiry', kind: 'expiry', title: left === 1 ? 'Your access ends tomorrow' : `Your access ends in ${left} days`,
        text: `It runs until ${longDate(user.expiresAt)}. Ask the person who invited you to extend it so you don't lose access.` })
  }
  if (update?.hasUpdate && downloadUrl) {
    out.push({ id: 'update', kind: 'update', title: `Fitrix ${update.latestVersion} is ready`,
      text: 'Download the newest version of the app, then open the file to install it over this one. Your data stays.',
      action: { label: 'Download', href: downloadUrl } })
  }
  return out
}
