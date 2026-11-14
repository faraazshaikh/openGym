import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { MOBILE } from '../lib/mobile.js'
import { enableRead } from '../lib/health-sync.js'
import { homeToday } from '../lib/home-today.js'
import { fmtDur, fmtNum, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { useDailyHealth } from './DailyHealth.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

// Three rings, one inside the other: the outer is steps, then sleep, then workout minutes.
const R = [84, 62, 40]
const W = 16
const circ = r => 2 * Math.PI * r

function Rings({ rings, label }) {
  return (
    <svg className="ht-rings" viewBox="0 0 200 200" role="img" aria-label={label}>
      {rings.map((g, i) => (
        <g key={g.key}>
          <circle cx="100" cy="100" r={R[i]} fill="none" strokeWidth={W} className="ht-track" />
          {g.fill > 0 && <circle cx="100" cy="100" r={R[i]} fill="none" strokeWidth={W} strokeLinecap="round"
            className={'ht-ring ht-r' + (i + 1)} strokeDasharray={`${circ(R[i]) * g.fill} ${circ(R[i])}`} transform="rotate(-90 100 100)" />}
        </g>
      ))}
    </svg>
  )
}

/**
 * The top of the home screen: today's rings (steps, sleep, workout minutes) with the resting heart
 * rate beside them, or, on a phone that has not been connected yet, one card to connect the health
 * data. Nothing on the web, where there is no health hub to read.
 */
export default function HomeToday() {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const daily = useDailyHealth()
  const [busy, setBusy] = useState(false)
  const h = homeToday(S, daily, todayISO())

  if (!h.connected) {
    if (!MOBILE) return null
    const connect = async () => {
      setBusy(true)
      try {
        const r = await enableRead('daily', () => useStore.getState().S)
        if (!r.ok) toast(r.reason === 'denied' ? t('Health Connect permission not granted') : t('Health Connect is not available on this phone'))
      } catch { toast(t('Health Connect is not available on this phone')) }
      setBusy(false)
    }
    return (
      <div className="card ht-connect">
        <span className="ht-ico" aria-hidden="true"><Icon name="heart" /></span>
        <div className="ht-ctitle">{t('Connect your health data')}</div>
        <div className="ht-csub">{t('See your steps, sleep and heart rate here from Mi Fitness, Zepp and others, through Health Connect. They stay on this phone.')}</div>
        <Button variant="primary" disabled={busy} onClick={connect}>{t('Connect')}</Button>
      </div>
    )
  }

  const [steps, sleep, workout] = h.rings
  const val = (g, text, unit) => (
    <div className="ht-stat">
      <div className="ht-lbl"><span className={'ht-dot ht-d' + (g.key === 'steps' ? 1 : g.key === 'sleep' ? 2 : 3)} aria-hidden="true" />{g.name}</div>
      <div className="ht-val">{g.value ? text : '–'}{g.value ? <span>{unit}</span> : null}</div>
    </div>
  )
  steps.name = t('Steps'); sleep.name = t('Sleep'); workout.name = t('Workout')
  const aria = [steps, sleep, workout].map(g => g.name + ' ' + Math.round(g.fill * 100) + '%').join(', ')
  return (
    <div className="card ht-card">
      <div className="ht-top">
        <Rings rings={h.rings} label={aria} />
        <div className="ht-stats">
          {val(steps, fmtNum(steps.value), ' / ' + fmtNum(steps.goal))}
          {val(sleep, fmtDur(sleep.value * 60000), '')}
          {val(workout, String(workout.value), ' ' + t('min'))}
        </div>
      </div>
      {h.rhr && (
        <div className="ht-rhr"><Icon name="heart" style={{ color: 'var(--red)' }} />
          <span>{t('Resting heart rate')}</span><b>{(h.rhr.est ? '~' : '') + h.rhr.value} bpm</b></div>
      )}
    </div>
  )
}
