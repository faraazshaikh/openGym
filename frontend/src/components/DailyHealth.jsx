import { useEffect, useState } from 'react'
import { MOBILE } from '../lib/mobile.js'
import { loadHealth, onHealthChange } from '../lib/health-sync.js'
import { monthSummary } from '../lib/health-daily.js'
import { fmtDur, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

/**
 * The daily numbers read from the phone's health hub (steps, sleep, resting heart rate), or null
 * while that switch is off, on the web, or before the file is read. Lives on this phone only.
 */
export function useDailyHealth() {
  const [daily, setDaily] = useState(null)
  useEffect(() => {
    if (!MOBILE) return undefined
    let gone = false
    const take = f => { if (!gone) setDaily(f?.readDaily ? f.daily || {} : null) }
    loadHealth().then(take).catch(() => {})
    const off = onHealthChange(take)
    return () => { gone = true; off() }
  }, [])
  return daily
}

// The month's averages under the calendar's own summary. Nothing at all for a month without a
// single reading, so an empty strip never sits there.
export default function DailyHealthStrip({ daily, y, mo }) {
  if (!daily) return null
  const m = monthSummary(daily, y, mo)
  if (m.steps == null && m.sleep == null && m.rhr == null) return null
  const cell = (icon, tint, value, label) => value == null ? null : (
    <div className="dh-cell">
      <Icon name={icon} size={16} style={{ color: tint }} />
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
  return (
    <div className="dh-strip" role="group" aria-label={t('Daily average')}>
      {cell('steps', 'var(--green)', m.steps != null ? fmtNum(m.steps) : null, t('Steps'))}
      {cell('moon', 'var(--indigo)', m.sleep != null ? fmtDur(m.sleep * 60000) : null, t('Sleep'))}
      {cell('heart', 'var(--red)', m.rhr != null ? m.rhr + ' bpm' : null, t('Resting heart rate'))}
      <div className="dh-cap">{t('Daily average')}</div>
    </div>
  )
}
