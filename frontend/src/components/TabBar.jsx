import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { useConnectionTrouble } from './SyncBanner.jsx'
import { retapTab } from '../lib/scroll-top.js'

// Module scope, not TabBar's render body. Declared inside it, `Tab` was a new function on every
// render, so React saw a different component type each time and threw the button away and built a
// fresh one — on a bar that is fixed on screen, and once a second for the whole of a rest. The
// state it took with it is the DOM node itself: focus, the :active tint, any in-flight transition.
function Tab({ active, icon, label, onClick, dot, tour }) {
  return (
    <button className={active ? 'on' : ''} onClick={onClick} data-tour={tour} aria-label={dot ? label + ', ' + t('Connection problem') : undefined}>
      <span className="tab-ic"><Icon name={icon} />{dot && <span className="tab-dot" aria-hidden="true" />}</span><span>{label}</span>
    </button>
  )
}

export default function TabBar() {
  const nav = useNavigate()
  const loc = useLocation()
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  // With the connection banner switched off, a sync problem shows as a dot on You, the tab
  // Settings lives under (#369, #330).
  const trouble = useConnectionTrouble()
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  // The four tabs are Home, Plan, Progress (the Stats screen) and You (Settings). A screen without
  // a tab of its own lights the tab it is opened from: the Exercises library and the muscle map
  // open from Plan, the rest from Progress, the check-in from Home.
  const PARENT = { stats: 'progress', history: 'progress', 'structural-balance': 'progress', 'progress-photos': 'progress', measurements: 'progress', settings: 'you', admin: 'you', checkin: 'home', library: 'plan', muscles: 'plan' }
  const parent = cur === 'muscles' && loc.state?.from === '/stats' ? 'progress' : PARENT[cur]
  const on = k => cur === k || parent === k

  // Root tabs are peers, not another level to unwind with Android Back. The tab you are already
  // on takes you to the top of its page instead (lib/scroll-top.js).
  const switchTab = path => {
    if (loc.pathname !== path || loc.search) nav(path, { replace: true })
    else retapTab(path)
  }

  return (
    <nav id="tabbar">
      <Tab active={on('home')} icon="house" label={t('Home')} onClick={() => switchTab('/home')} tour="tab-home" />
      <Tab active={on('plan')} icon="calendar" label={t('Plan')} onClick={() => switchTab('/plan')} tour="tab-plan" />
      <Tab active={on('progress')} icon="chart" label={t('Progress')} onClick={() => switchTab('/stats')} tour="tab-stats" />
      <Tab active={on('you')} icon="personCircle" label={t('You')} dot={trouble} onClick={() => switchTab('/settings')} tour="tab-you" />
    </nav>
  )
}
