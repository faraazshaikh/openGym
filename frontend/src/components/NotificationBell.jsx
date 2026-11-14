import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { getChannel } from '../lib/channel.js'
import { checkForUpdate, APP_DOWNLOAD } from '../lib/update.js'
import { buildNotices } from '../lib/notices.js'
import Icon from './Icon.jsx'

// The bell on Home: a dot when there is something to read, and a sheet that lists it. What it can
// say is decided in lib/notices.js. The update notice is only for the app installed from the
// download (channel 'sideload'): the web version updates with its server, and the stores update
// their own apps. The download goes straight to the newest release, so it never goes stale.
function NoticeSheet({ notices, close }) {
  return <>
    <h3>Notifications</h3>
    {notices.length ? notices.map(n => <div key={n.id} className="card" style={{ margin: '10px 0', textAlign: 'start' }}>
      <div style={{ fontWeight: 600 }}>{n.title}</div>
      <div className="muted small" style={{ margin: '4px 0 0', lineHeight: 1.5 }}>{n.text}</div>
      {/* window.open, as the update row in Settings does: in the phone app it hands the link to the system browser, which downloads the file. */}
      {n.action && <button className="btn primary" style={{ marginTop: 10 }} onClick={() => { window.open(n.action.href, '_blank', 'noopener'); close() }}>{n.action.label}</button>}
    </div>) : <div className="muted small" style={{ margin: '14px 0' }}>You're all caught up.</div>}
  </>
}

export default function NotificationBell() {
  const user = useStore(s => s.user)
  const openSheet = useUI(s => s.openSheet)
  const [update, setUpdate] = useState(null)
  useEffect(() => {
    let live = true
    getChannel().then(ch => ch === 'sideload' && checkForUpdate()).then(info => { if (live && info) setUpdate(info) }).catch(() => {})
    return () => { live = false }
  }, [])
  const notices = buildNotices({ user, update, downloadUrl: APP_DOWNLOAD })
  return <button className="iconbtn" data-tour="notifications" aria-label={notices.length ? `Notifications, ${notices.length} new` : 'Notifications'}
    onClick={() => openSheet(close => <NoticeSheet notices={notices} close={close} />)}>
    <Icon name="bell" />{notices.length > 0 && <span className="tab-dot" aria-hidden="true" />}
  </button>
}
