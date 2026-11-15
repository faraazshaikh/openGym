import { useState } from 'react'
import { useUI } from '../store/useUI.js'
import { Button } from './ui.jsx'
import { APP_DOWNLOAD, RELEASES_PAGE } from '../lib/update.js'
import { inviteFromSearch } from '../lib/invite-message.js'

// The page a signed-out visitor sees on an invite-only server: what Fitrix is, a box for the
// invite code, and a small way back in for people who already have a profile.
//
// Deliberately English-only, like the admin dashboard: this is the server owner's own page, so
// the copy below is theirs to edit and is not part of the translated app strings. The code box
// only collects the code; the sign-up sheet that opens next asks for the name and the email the
// invite was made for, and the server checks both.

const ABOUT = [
  ['Log every session', 'Pick a plan or build your own, log sets and reps, and let the rest timer count you in. Fitrix works out what to lift next as you progress.'],
  ['See it move', 'Personal records, lifting volume, body weight and measurements, charted over time so the trend is clear.'],
  ['Yours alone', 'Your data lives on this server, not with an advertising company. No tracking, nothing sold.'],
  ['On your phone', 'On iPhone, open this page in Safari and use Share, then Add to Home Screen. On Android you can do the same or install the app, which can also read steps, sleep and calories from Health Connect.'],
]

// iPhones and iPads (iPadOS says it is a Mac, with a touch screen). There is no iPhone app for
// Fitrix, so they get the Home Screen steps instead of the Android file.
export const isIOS = () => typeof navigator !== 'undefined'
  && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export default function Landing({ head, tagline, onContinue, signin }) {
  // An invite link (/?invite=CODE) arrives with the code filled in, and the app download showing.
  const [code, setCode] = useState(() => inviteFromSearch(typeof location !== 'undefined' ? location.search : ''))
  const go = ev => {
    ev?.preventDefault()
    const c = code.trim()
    if (!c) { useUI.getState().toast('Enter your invite code'); return }
    onContinue(c)
  }
  return (
    <div className="narrow" style={{ textAlign: 'center', padding: '8vh 0 40px' }}>
      {head}
      <div className="muted" style={{ marginBottom: 26 }}>{tagline}</div>

      <form className="card" onSubmit={go} style={{ textAlign: 'start' }}>
        <h2 style={{ margin: '0 0 4px' }}>Have an invite code?</h2>
        <div className="dim small" style={{ marginBottom: 12 }}>Fitrix is private. You need a code from the person who runs it, and it only works with the email address it was made for.</div>
        <input className="input" placeholder="Invite code" maxLength={40} value={code} autoCapitalize="characters" autoCorrect="off" aria-label="Invite code"
          onChange={e => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: '.14em', fontWeight: 600, textAlign: 'center' }} />
        <div style={{ height: 12 }} />
        <Button type="submit" variant="primary" icon="plusCircle">Continue</Button>
      </form>

      {/* Shown once a code is typed. The link always points at the newest release, so it never
          needs editing when a version ships. */}
      {code.trim() && isIOS() && <div className="card" style={{ textAlign: 'start', marginTop: 12 }}>
        <h2 style={{ margin: '0 0 4px' }}>Put Fitrix on your iPhone</h2>
        <div className="dim small">There is no App Store app, but the web version works like one. Sign up with the code above, then open this page in Safari, tap Share, and choose Add to Home Screen. It opens full screen from then on, and your data syncs with your other devices.</div>
      </div>}
      {code.trim() && !isIOS() && <div className="card" style={{ textAlign: 'start', marginTop: 12 }}>
        <h2 style={{ margin: '0 0 4px' }}>Get the Android app</h2>
        <div className="dim small" style={{ marginBottom: 12 }}>Always the newest version. Open the file after it downloads and allow the install if your phone asks. Sign up with the code above, then pair the app from Settings.</div>
        <a className="btn" href={APP_DOWNLOAD} style={{ textDecoration: 'none' }}>Download Fitrix for Android</a>
        <div className="dim small" style={{ marginTop: 8 }}><a href={RELEASES_PAGE} target="_blank" rel="noopener">What changed in the newest version</a></div>
      </div>}

      <div style={{ textAlign: 'start', marginTop: 30 }}>
        <h2 style={{ margin: '0 0 6px' }}>What Fitrix is about</h2>
        <div className="muted" style={{ marginBottom: 14 }}>A private gym and body-weight tracker. It keeps your training in one place, on a server you can trust.</div>
        {ABOUT.map(([title, text]) => <div key={title} style={{ margin: '0 0 12px' }}>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <div className="muted small" style={{ lineHeight: 1.5 }}>{text}</div>
        </div>)}
      </div>

      <div style={{ marginTop: 26 }}>
        <div className="dim small" style={{ marginBottom: 6 }}>Already have a profile?</div>
        {signin}
      </div>
    </div>
  )
}
