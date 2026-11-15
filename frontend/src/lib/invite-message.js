// The message an admin sends with an invite, and the link inside it. The link is the server's own
// address with the code in the query (`/?invite=CODE`): the landing page reads it, fills the code
// box and shows the app download, so the person has nothing to type. The query sits before the
// `#` of the app's hash routes, so it survives the router. A code is single-use and tied to one
// email, so having it in a link adds little risk.

export const inviteLink = (base, code) => String(base || '').replace(/\/+$/, '') + '/?invite=' + encodeURIComponent(code)

// The code in a page address (`?invite=...`), cleaned up; '' for anything that is not a plain code.
export function inviteFromSearch(search) {
  const v = new URLSearchParams(search || '').get('invite')
  return v && /^[A-Za-z0-9_-]{1,40}$/.test(v.trim()) ? v.trim().toUpperCase() : ''
}

const howLong = months => (months > 0
  ? `You get ${months} ${months === 1 ? 'month' : 'months'}, counted from the day you sign up.`
  : 'Your access has no end date.')

export function inviteMessage({ base, invite }) {
  const hi = invite.name ? `Hi ${invite.name}, you` : 'You'
  return [
    `${hi}'re invited to Fitrix, a private gym and body-weight tracker.`,
    '',
    `1. Open ${inviteLink(base, invite.code)}`,
    invite.email ? `2. Sign up with ${invite.email}. The invite only works with that email address.` : '2. Sign up with your name.',
    '3. Android: download the app from that page. iPhone: tap Share, then Add to Home Screen.',
    '',
    `Your code, if the link does not fill it in: ${invite.code}`,
    howLong(invite.months),
  ].join('\n')
}
